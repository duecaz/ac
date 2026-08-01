// LA PRUEBA DE CARGA TIENE QUE SIMULAR AL ALUMNO DE VERDAD.
//
// Bug real (reportado en producción): "❌ Se cayó bajo carga · 100 alumnos ·
// 0 filas (esperadas 200)". No era la Pi. Desde §22-4 la regla de `live_answers`
// exige la CREDENCIAL DEL DISPOSITIVO (cabecera `X-WW-Claim`), y la prueba
// POSTeaba las respuestas a pelo: el servidor las rechazaba TODAS con 403. El
// informe lo contaba como filas perdidas y culpaba al hardware — se reprodujo
// contra un PocketBase local y ocioso, 200 rechazos en 439 ms.
//
// Dos normas, las dos aquí: el alumno simulado REGISTRA su credencial y la
// MANDA; y un rechazo se informa como rechazo (con su código HTTP), no como
// "fila perdida". Sin servidor: fetch inyectado.
// Run: node tests/stressClaim.test.mjs
import assert from 'node:assert';
import { runStressTest } from '../core/stressTest.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const res = (status, obj) => ({ status, ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });

// PocketBase de mentira con la REGLA de verdad: crear una respuesta exige la
// cabecera de credencial, igual que `ANON_ANSWER_CREATE` en core/pbRules.js.
function fakePb() {
  const rows = { live_players: [], live_answers: [], live_claims: [], assignment_attempts: [] };
  const secrets = new Map();          // player → secreto registrado
  let seq = 0;
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const coll = String(url).match(/\/api\/collections\/(\w+)\/records/)?.[1];
    if (method === 'POST') {
      const body = JSON.parse(opts.body || '{}');
      const id = `r${++seq}`;
      if (coll === 'live_claims') { secrets.set(body.player, body.secret); rows.live_claims.push(body); return res(200, { id }); }
      if (coll === 'live_answers') {
        const sent = opts.headers?.['X-WW-Claim'];
        // LA REGLA: sin el secreto de ESE jugador, 403.
        if (!sent || secrets.get(body.player) !== sent) return res(403, { message: 'forbidden' });
        rows.live_answers.push({ id, ...body });
        return res(200, { id });
      }
      if (coll === 'live_players') {
        if (rows.live_players.some(p => p.name === body.name)) return res(400, { message: 'not_unique' });
        rows.live_players.push({ id, ...body });
        return res(200, { id });
      }
      if (rows[coll]) rows[coll].push({ id, ...body });
      return res(200, { id });
    }
    if (method === 'DELETE') return res(204, {});
    // GET: listados por colección (probe de existencia y verificación final).
    return res(200, { items: (rows[coll] || []).map((r, i) => ({ id: r.id || `g${i}`, ...r })) });
  };
  return rows;
}

// ── 1. El alumno simulado registra credencial y la manda ⇒ las 2N respuestas entran
{
  fakePb();
  const r = await runStressTest({ pbUrl: 'http://pb.test', n: 4 });
  assert.strictEqual(r.live.claimsOk, 4, 'cada alumno registra la credencial de su dispositivo');
  assert.strictEqual(r.live.answerRows, 8, 'y sus respuestas ENTRAN (2 por alumno)');
  assert.deepStrictEqual(r.live.answerErrors, {}, 'sin rechazos');
  assert.ok(r.live.pass, 'la parte live pasa');
  ok('la carga simula al alumno real: credencial registrada y cabecera enviada');
}

// ── 2. CONTRA-PRUEBA: sin credencial, el informe DICE "rechazadas", no "perdidas"
{
  const rows = fakePb();
  const raw = global.fetch;
  global.fetch = async (url, opts = {}) => {
    // Servidor que no acepta credenciales (colección ausente) → todas las
    // respuestas caen. Es el escenario exacto que se vio en producción.
    if ((opts.method || 'GET') === 'POST' && String(url).includes('/live_claims/')) return res(404, {});
    return raw(url, opts);
  };
  const r = await runStressTest({ pbUrl: 'http://pb.test', n: 3 });
  assert.strictEqual(r.live.answerRows, 0);
  assert.strictEqual(r.live.answerErrors[403], 6, 'los 6 rechazos se cuentan por código HTTP');
  assert.ok(r.notes.some(n => /RECHAZADAS/.test(n)), 'el informe dice que fueron RECHAZADAS, no perdidas por carga');
  assert.ok(rows.live_answers.length === 0);
  ok('un rechazo por regla se informa como rechazo (con su HTTP), no como fallo de la Pi');
}

console.log(`\n  ${passed} stress-claim checks passed`);
