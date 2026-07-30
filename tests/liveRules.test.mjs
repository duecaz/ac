// LEY DE CONFIANZA §22 — las reglas de PocketBase, EJECUTABLES.
//
// Por qué existe: las reglas de acceso eran configuración de servidor que nadie
// verificaba. Dos fallos posibles, los dos silenciosos:
//   ① la regla es demasiado ABIERTA → un alumno con DevTools se auto-puntúa.
//   ② la regla es demasiado CERRADA → rompe al alumno de verdad, y se descubre
//      en mitad de una clase (el peor momento posible).
//
// Aquí se cierran los dos: un EVALUADOR mínimo de reglas PB (lo justo del
// dialecto que usamos) hace de servidor, y el ADAPTADOR REAL
// (adapters/pocketbase/realtime.js) juega contra él — el alumno anónimo debe
// poder jugar entero, y cada intento de trampa debe rebotar con 403.
//
// Run: node tests/liveRules.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';   // el settle del host necesita el scorer real
import { RULES } from '../core/pbRules.js';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';
import { evalRule } from './helpers/pbRuleEval.mjs';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// El evaluador se auto-verifica antes de arbitrar nada.
{
  assert.strictEqual(evalRule('', {}), true, "'' es abierto");
  assert.strictEqual(evalRule(null, {}), false, 'null es cerrado');
  assert.strictEqual(evalRule('@request.auth.id != ""', { auth: { id: 'u1' } }), true, 'con sesión');
  assert.strictEqual(evalRule('@request.auth.id != ""', {}), false, 'anónimo');
  assert.strictEqual(evalRule('@request.body.scored:isset = false', { body: { value: 1 } }), true, 'campo ausente');
  assert.strictEqual(evalRule('@request.body.scored:isset = false', { body: { scored: false } }), false, 'campo presente (aunque sea false)');
  assert.strictEqual(evalRule('@request.body.points = 0', { body: { points: 0 } }), true, 'literal numérico');
  assert.strictEqual(evalRule('owner = @request.auth.id', { auth: { id: 'u1' }, record: { owner: 'u1' } }), true, 'dueño');
  assert.strictEqual(evalRule('owner = @request.auth.id', { auth: { id: 'u2' }, record: { owner: 'u1' } }), false, 'no dueño');
  assert.strictEqual(evalRule('visibility = "public" || owner = @request.auth.id || @request.auth.role = "admin"',
    { auth: { id: 'u2' }, record: { visibility: 'unlisted', owner: 'u1' } }), false, 'ni público ni dueño ni admin');
  ok('el evaluador de reglas entiende el dialecto que usamos (10 casos)');
}

// ── PocketBase de juguete que APLICA las reglas ──────────────────────────────
// Sirve /api/collections/<coll>/records con list/view/create/update/delete y
// deniega con 403 igual que el servidor real.
function makeFakePb({ auth = null } = {}) {
  const db = new Map();          // coll → [rows]
  let seq = 0;
  const denied = [];
  const rows = (c) => { if (!db.has(c)) db.set(c, []); return db.get(c); };
  const res = (status, obj) => ({ status, ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });

  // El servidor evalúa la regla con TODO el contexto de la petición: sesión,
  // cuerpo, fila, CABECERAS (§22-4: el secreto del dispositivo viaja ahí) y las
  // demás colecciones, que las reglas consultan por join.
  const check = (coll, action, ctx) => {
    const rule = RULES[coll]?.[`${action}Rule`];
    const allowed = evalRule(rule === undefined ? '' : rule, {
      auth, collections: Object.fromEntries(db), ...ctx,
    });
    if (!allowed) denied.push(`${action} ${coll}`);
    return allowed;
  };
  // PocketBase normaliza los nombres de cabecera: `X-WW-Claim` → `x_ww_claim`.
  const hdrs = (opts) => Object.fromEntries(Object.entries(opts.headers || {})
    .map(([k, v]) => [k.toLowerCase().replace(/-/g, '_'), v]));

  const fetchImpl = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const m = String(url).match(/\/api\/collections\/([\w_]+)\/records(?:\/([\w]+))?/);
    if (!m) return res(200, {});
    const [, coll, id] = m;
    const body = opts.body ? JSON.parse(opts.body) : {};

    if (method === 'GET') {
      if (!check(coll, id ? 'view' : 'list', { headers: hdrs(opts), record: id ? rows(coll).find(r => r.id === id) : undefined })) return res(403, { message: 'forbidden' });
      if (id) { const r = rows(coll).find(x => x.id === id); return r ? res(200, r) : res(404, {}); }
      // Filtro: solo lo que usan los adaptadores (session/item/player) — basta
      // con devolver todo y que el llamador filtre; los tests son de reglas.
      const f = decodeURIComponent(String(url).split('filter=')[1]?.split('&')[0] || '');
      let items = rows(coll);
      for (const [k, v] of [...f.matchAll(/(\w+)\s*=\s*'([^']*)'/g)].map(x => [x[1], x[2]])) items = items.filter(r => String(r[k]) === v);
      for (const [k, v] of [...f.matchAll(/(\w+)\s*=\s*(\d+)/g)].map(x => [x[1], Number(x[2])])) items = items.filter(r => Number(r[k]) === v);
      if (/scored=false/.test(f)) items = items.filter(r => r.scored === false);
      return res(200, { items, totalItems: items.length });
    }
    if (method === 'POST') {
      if (!check(coll, 'create', { body, headers: hdrs(opts) })) return res(403, { message: 'forbidden' });
      const row = { id: `r${++seq}`, ...body };
      // Índice único (session,player,item) de live_answers → 400 como el real.
      if (coll === 'live_answers' && rows(coll).some(r => r.session === row.session && r.player === row.player && r.item === row.item)) {
        return res(400, { message: 'validation_not_unique' });
      }
      // Índice único (session,player) de live_claims → el primero se queda el
      // jugador; nadie puede reclamar uno ya reclamado (§22-4).
      if (coll === 'live_claims' && rows(coll).some(r => r.session === row.session && r.player === row.player)) {
        return res(400, { message: 'validation_not_unique' });
      }
      rows(coll).push(row);
      return res(200, row);
    }
    if (method === 'PATCH') {
      const row = rows(coll).find(r => r.id === id);
      if (!check(coll, 'update', { body, record: row, headers: hdrs(opts) })) return res(403, { message: 'forbidden' });
      Object.assign(row || {}, body);
      return res(200, row || {});
    }
    if (method === 'DELETE') {
      const row = rows(coll).find(r => r.id === id);
      if (!check(coll, 'delete', { record: row, headers: hdrs(opts) })) return res(403, { message: 'forbidden' });
      db.set(coll, rows(coll).filter(r => r.id !== id));
      return res(204, null);
    }
    return res(200, {});
  };
  return { fetchImpl, db, denied, rows };
}

const ACTIVITY = {
  id: 'a1', template: 'quiz', title: 'T',
  content: { items: [{ id: 'q1', question: '2+2', answer: '4', options: ['3', '4'], points: 1 }] },
  scoring: { pointsPerCorrect: 1 }, live: {},
};

// Siembra una sala como la crearía el HOST (con sesión) y devuelve el fake.
function seedRoom() {
  const pb = makeFakePb({ auth: { id: 'teacher1' } });
  pb.rows('live_sessions').push({ id: 'sess1', code: 'CASA', activity: ACTIVITY,
    state: { status: 'running', phase: 'question', currentItem: 0, players: [], answers: {} }, ql: null });
  return pb;
}

// ── ① El ALUMNO ANÓNIMO debe poder jugar ENTERO con las reglas puestas ───────
{
  const pb = seedRoom();
  const anon = makeFakePb({ auth: null });          // mismo store, sin sesión
  anon.db.set('live_sessions', pb.rows('live_sessions'));
  global.fetch = anon.fetchImpl;
  const rt = createPocketbaseRealtime({ userId: 'anon1' });

  const join = await rt.joinSession('CASA', 'Emma');
  assert.ok(join.playerId, 'el alumno entra a la sala');

  await rt.submitAnswer('sess1', join.playerId, 0, '4', 1200);
  let row = anon.rows('live_answers')[0];
  assert.ok(row, 'su respuesta se guarda');
  assert.strictEqual(row.scored, false, 'nace SIN puntuar');
  assert.strictEqual(row.points, 0, 'nace con 0 puntos');

  // Carrera: reintento correcto avanza el valor (PATCH con value/ms/correct).
  await rt.submitRaceAttempt('sess1', join.playerId, 0, '4', true, 999, 800);
  // Tablero: progreso continuo (PATCH con value/ms, sin tocar veredicto).
  await rt.submitProgress('sess1', join.playerId, { tubes: [] }, 900, 0);
  row = anon.rows('live_answers')[0];
  assert.strictEqual(row.scored, false, 'tras reintento y progreso, sigue sin puntuar');
  assert.strictEqual(row.points, 0, 'y sin puntos');

  // Pedir la palabra (Pregunta en Vivo): escribe SOLO el campo `ql`.
  await rt.claimQuestion('sess1', { open: 2, question: '¿Capital?', by: join.playerId, byName: 'Emma' });
  const sess = anon.rows('live_sessions')[0];
  assert.strictEqual(sess.ql.open, 2, 'el alumno puede pedir la palabra');
  assert.strictEqual(sess.state.phase, 'question', 'y el blob de control queda intacto');

  assert.deepStrictEqual(anon.denied, [], `ninguna acción legítima del alumno fue denegada: ${anon.denied.join(', ')}`);
  ok('el ALUMNO anónimo juega entero con las reglas puestas (entrar · responder · carrera · tablero · pedir la palabra)');
}

// ── ② Las TRAMPAS deben rebotar ─────────────────────────────────────────────
{
  const pb = seedRoom();
  pb.rows('live_answers').push({ id: 'la1', session: 'sess1', player: 'p1', item: 0, value: '3', ms: 10, scored: false, correct: false, points: 0 });
  pb.rows('live_players').push({ id: 'p1', session: 'sess1', name: 'Emma' });
  // Emma tiene su credencial de dispositivo (§22-4); el tramposo NO la conoce.
  pb.rows('live_claims').push({ id: 'cl1', session: 'sess1', player: 'p1', secret: 'cl_EMMA' });
  const anon = makeFakePb({ auth: null });
  for (const c of ['live_sessions', 'live_answers', 'live_players', 'live_claims']) anon.db.set(c, pb.rows(c));
  const f = anon.fetchImpl;
  const PB = 'https://pb.x/api/collections';
  const patch = (u, b) => f(u, { method: 'PATCH', body: JSON.stringify(b) });

  // (a) auto-puntuarse: el ataque que neutralizaba C6 por completo.
  let r = await patch(`${PB}/live_answers/records/la1`, { scored: true, correct: true, points: 9999 });
  assert.strictEqual(r.status, 403, 'auto-puntuarse desde DevTools → 403');
  assert.strictEqual(anon.rows('live_answers')[0].points, 0, 'la fila sigue en 0 puntos');

  // (b) inflar puntos sin declararse puntuado.
  r = await patch(`${PB}/live_answers/records/la1`, { points: 500 });
  assert.strictEqual(r.status, 403, 'inflar points → 403');

  // (c) crear una respuesta ya puntuada.
  r = await f(`${PB}/live_answers/records`, { method: 'POST', body: JSON.stringify({ session: 'sess1', player: 'pX', item: 5, scored: true, points: 777 }) });
  assert.strictEqual(r.status, 403, 'crear una respuesta ya puntuada → 403');

  // (d) controlar la sala: terminarla, saltar de pregunta, auto-otorgarse puntos.
  r = await patch(`${PB}/live_sessions/records/sess1`, { state: { status: 'ended', phase: 'ended' } });
  assert.strictEqual(r.status, 403, 'terminar la sala → 403');
  assert.strictEqual(anon.rows('live_sessions')[0].state.status, 'running', 'la sala sigue en marcha');

  // (e) expulsar a un compañero.
  r = await f(`${PB}/live_players/records/p1`, { method: 'DELETE' });
  assert.strictEqual(r.status, 403, 'expulsar a un compañero → 403');
  assert.strictEqual(anon.rows('live_players').length, 1, 'sigue en la sala');

  // (f) renombrarse (update cerrado del todo).
  r = await patch(`${PB}/live_players/records/p1`, { name: 'Otro' });
  assert.strictEqual(r.status, 403, 'renombrarse → 403');

  // (g) crear una sala a nombre de nadie.
  r = await f(`${PB}/live_sessions/records`, { method: 'POST', body: JSON.stringify({ code: 'FAKE' }) });
  assert.strictEqual(r.status, 403, 'crear sala sin sesión → 403');

  // (h) reabrir una tarea cerrada / subirse el tope de intentos.
  anon.rows('assignments').push({ id: 'asg1', code: 'T1', status: 'closed', max_attempts: 1 });
  r = await patch(`${PB}/assignments/records/asg1`, { status: 'open', max_attempts: 99 });
  assert.strictEqual(r.status, 403, 'reabrir tarea / subir intentos → 403');
  assert.strictEqual(anon.rows('assignments')[0].status, 'closed', 'la tarea sigue cerrada');

  // (j) §22-4 — RESPONDER EN NOMBRE DE OTRO. El `playerId` es público (la lista de
  // jugadores se lee sin cuenta), así que antes bastaba con verlo. Ahora hace falta
  // el secreto del dispositivo, que solo tiene Emma.
  r = await f(`${PB}/live_answers/records`, { method: 'POST',
    body: JSON.stringify({ session: 'sess1', player: 'p1', item: 3, value: 'X', ms: 1, scored: false, correct: false, points: 0 }) });
  assert.strictEqual(r.status, 403, 'responder como otro jugador (sin su credencial) → 403');
  r = await f(`${PB}/live_answers/records`, { method: 'POST',
    headers: { 'X-WW-Claim': 'cl_INVENTADO' },
    body: JSON.stringify({ session: 'sess1', player: 'p1', item: 4, value: 'X', ms: 1, scored: false, correct: false, points: 0 }) });
  assert.strictEqual(r.status, 403, 'con un secreto inventado tampoco → 403');
  assert.strictEqual(anon.rows('live_answers').length, 1, 'no entró ninguna respuesta falsa');

  // (k) PISAR la respuesta de otro (su fila, su valor).
  r = await patch(`${PB}/live_answers/records/la1`, { value: 'BORRADO' });
  assert.strictEqual(r.status, 403, 'editar la respuesta de otro → 403');
  assert.strictEqual(anon.rows('live_answers')[0].value, '3', 'la respuesta de Emma sigue intacta');

  // (l) ROBAR el jugador reclamando otra credencial para él (índice único + update
  // cerrado): ni se puede crear una segunda ni cambiar la existente.
  r = await f(`${PB}/live_claims/records`, { method: 'POST',
    body: JSON.stringify({ session: 'sess1', player: 'p1', secret: 'cl_LADRON' }) });
  assert.strictEqual(r.status, 400, 'reclamar un jugador ya reclamado → rechazado por el índice único');
  r = await patch(`${PB}/live_claims/records/cl1`, { secret: 'cl_LADRON' });
  assert.strictEqual(r.status, 403, 'cambiarle el secreto a otro → 403');
  // Y leer credenciales está cerrado del todo: el secreto no se puede espiar.
  r = await f(`${PB}/live_claims/records`);
  assert.strictEqual(r.status, 403, 'listar credenciales → 403');

  // Contra-prueba: EMMA, con su credencial, sí responde.
  r = await f(`${PB}/live_answers/records`, { method: 'POST',
    headers: { 'X-WW-Claim': 'cl_EMMA' },
    body: JSON.stringify({ session: 'sess1', player: 'p1', item: 7, value: '4', ms: 1, scored: false, correct: false, points: 0 }) });
  assert.strictEqual(r.status, 200, 'la dueña de la credencial sigue pudiendo responder');

  // (i) editar un intento ya entregado (append-only).
  anon.rows('assignment_attempts').push({ id: 'at1', assignment_id: 'asg1', score_auto: 1 });
  r = await patch(`${PB}/assignment_attempts/records/at1`, { score_auto: 10 });
  assert.strictEqual(r.status, 403, 'editar un intento entregado → 403');
  ok('14 intentos de trampa REBOTAN (auto-puntuarse · inflar · crear puntuada · terminar sala · expulsar · renombrar · crear sala · reabrir tarea · editar intento · responder como otro ×2 · pisar su respuesta · robar credencial ×2 · espiar credenciales) y la dueña sigue respondiendo');
}

// ── ③ El HOST (con sesión) sí puede dirigir y liquidar ───────────────────────
{
  const pb = seedRoom();
  pb.rows('live_players').push({ id: 'p1', session: 'sess1', name: 'Emma' });
  pb.rows('live_answers').push({ id: 'la1', session: 'sess1', player: 'p1', item: 0, value: '4', ms: 500, scored: false, correct: false, points: 0 });
  global.fetch = pb.fetchImpl;
  const rt = createPocketbaseRealtime({ userId: 'teacher1' });

  await rt.settleItem('sess1', 0);
  const row = pb.rows('live_answers')[0];
  assert.strictEqual(row.scored, true, 'el settle del host SÍ puntúa');
  assert.strictEqual(row.correct, true, 'con el veredicto real');
  assert.ok(row.points > 0, 'y sus puntos');

  await rt.kickPlayer('sess1', 'p1');
  assert.strictEqual(pb.rows('live_players').length, 0, 'el host sí expulsa');

  await rt.endSession('sess1');
  assert.strictEqual(pb.rows('live_sessions')[0].state.status, 'ended', 'el host sí cierra la sala');
  assert.deepStrictEqual(pb.denied, [], `ninguna acción del host fue denegada: ${pb.denied.join(', ')}`);
  ok('el HOST con sesión dirige sin fricción (settle real · expulsar · cerrar)');
}

console.log(`\nliveRules.test: ${passed} checks passed`);
