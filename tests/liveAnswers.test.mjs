// Deuda F — upsert ATÓMICO de live_answers con el índice único (session,player,
// item). Si dos escrituras concurrentes de la MISMA celda chocan, la 2ª recibe
// 400 y debe RE-LEER + PATCHear la fila existente, NO crear una segunda. Sin
// server: fetch inyectado. Run: node tests/liveAnswers.test.mjs
import assert from 'node:assert';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const res = (status, obj) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });

// Escenario: al POST del progreso otro cliente ya creó la fila → 400 (índice
// único). El adaptador debe re-leer y PATCHear, sin un segundo POST.
{
  let posts = 0, patches = 0, rowExists = false;
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'POST' && url.includes('/live_answers/records')) {
      posts++;
      return res(400, { message: 'validation_not_unique' });   // choque del índice único
    }
    if (method === 'PATCH' && url.includes('/live_answers/records/')) { patches++; return res(200, {}); }
    // GET: probe de answersReady (sin filter) o getAnswerRow (con filter).
    if (url.includes('/live_answers/records') && !url.includes('filter=')) return res(200, { items: [], totalItems: 0 });
    if (url.includes('/live_answers/records')) {
      // Primera lectura: no hay fila. Tras el POST fallido: la fila ya existe.
      const items = rowExists ? [{ id: 'la1', player: 'p1', item: 0, correct: false }] : [];
      rowExists = true;   // el POST concurrente "aterrizó"
      return res(200, { items });
    }
    return res(200, {});
  };
  const rt = createPocketbaseRealtime({ userId: 'p1' });
  await rt.submitProgress('sess1', 'p1', { tubes: [] }, 5, 0);
  assert.strictEqual(posts, 1, 'un solo POST (que chocó)');
  assert.strictEqual(patches, 1, 'tras el conflicto, PATCHea la fila existente (no crea otra)');
  ok('submitProgress: conflicto del índice único → re-lee y PATCHea (sin fila duplicada)');
}

// Camino feliz: no hay fila → POST crea → sin PATCH.
{
  let posts = 0, patches = 0;
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'POST' && url.includes('/live_answers/records')) { posts++; return res(200, { id: 'la2' }); }
    if (method === 'PATCH') { patches++; return res(200, {}); }
    if (url.includes('/live_answers/records') && !url.includes('filter=')) return res(200, { items: [], totalItems: 0 });
    if (url.includes('/live_answers/records')) return res(200, { items: [] });
    return res(200, {});
  };
  const rt = createPocketbaseRealtime({ userId: 'p2' });
  await rt.submitProgress('sess1', 'p2', { tubes: [] }, 5, 0);
  assert.strictEqual(posts, 1, 'crea la fila');
  assert.strictEqual(patches, 0, 'sin conflicto → sin PATCH');
  ok('submitProgress: sin fila previa → POST crea (camino feliz)');
}

// ── C6 ANTI-TRAMPA: la carrera NUNCA persiste el veredicto/puntos del cliente ──
// Un móvil manipulado puede llamar submitRaceAttempt con correct:true y
// points:9999. La fila debe guardarse scored:false / points:0 — la verdad la
// pone el settle del HOST con la fórmula real (mentir solo mueve `value` a una
// respuesta mala, que el settle puntúa MAL).
{
  let postBody = null, patches = 0;
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'POST' && url.includes('/live_answers/records')) {
      postBody = JSON.parse(opts.body);
      return res(200, { id: 'la3' });
    }
    if (method === 'PATCH') { patches++; return res(200, {}); }
    if (url.includes('/live_answers/records') && !url.includes('filter=')) return res(200, { items: [], totalItems: 0 });
    if (url.includes('/live_answers/records')) return res(200, { items: [] });
    return res(200, {});
  };
  const rt = createPocketbaseRealtime({ userId: 'p3' });
  await rt.submitRaceAttempt('sess1', 'p3', 0, 'X', true, 9999, 50);   // cliente MIENTE
  assert.strictEqual(postBody.scored, false, 'la fila queda SIN liquidar (scored:false)');
  assert.strictEqual(postBody.points, 0, 'los puntos del cliente NO se persisten (0)');
  assert.strictEqual(postBody.c0, true, 'c0 (analítica del 1er intento) se conserva como hint');
  assert.strictEqual(patches, 0, 'sin fila previa no hay PATCH');
  ok('C6: submitRaceAttempt guarda scored:false/points:0 aunque el cliente reclame 9999');
}

// El reintento correcto AVANZA value pero sigue sin auto-puntuarse; y una fila ya
// liquidada por el host no se toca.
{
  let patchBody = null, patches = 0;
  let row = { id: 'la4', player: 'p4', item: 0, correct: false, scored: false };
  global.fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    if (method === 'PATCH' && url.includes('/live_answers/records/')) { patches++; patchBody = JSON.parse(opts.body); return res(200, {}); }
    if (url.includes('/live_answers/records') && !url.includes('filter=')) return res(200, { items: [], totalItems: 0 });
    if (url.includes('/live_answers/records')) return res(200, { items: [row] });
    return res(200, {});
  };
  const rt = createPocketbaseRealtime({ userId: 'p4' });
  await rt.submitRaceAttempt('sess1', 'p4', 0, 'bien', true, 500, 80);   // reintento correcto
  assert.strictEqual(patches, 1, 'el reintento correcto PATCHea la fila');
  assert.strictEqual(patchBody.value, 'bien', 'avanza el value');
  assert.strictEqual(patchBody.correct, true, 'marca el hint de avance');
  assert.strictEqual('points' in patchBody, false, 'pero NO escribe puntos');
  assert.strictEqual('scored' in patchBody, false, 'ni la marca como liquidada');
  // Fila ya liquidada por el host → intocable.
  row = { id: 'la5', player: 'p4', item: 0, correct: false, scored: true };
  patches = 0;
  await rt.submitRaceAttempt('sess1', 'p4', 0, 'tarde', true, 500, 80);
  assert.strictEqual(patches, 0, 'una fila ya liquidada por el host no se re-escribe');
  ok('C6: el reintento avanza value sin puntos; una fila liquidada es intocable');
}

delete global.fetch;
console.log(`\nliveAnswers.test: ${passed} checks passed`);
