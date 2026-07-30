// DEUDA D (R1) — UN REINTENTO NUNCA DUPLICA UNA ENTREGA.
//
// El escenario es siempre el mismo: el POST llega al servidor, el ACK se pierde
// en el blip de red, el cliente cree que falló y reintenta. Sin clave de
// idempotencia eso era:
//   · en `results`: fila duplicada (dos resultados del mismo juego);
//   · en `assignment_attempts`: PEOR — el reintento recontaba, entraba como
//     attempt_no+1 y le GASTABA un intento al alumno en falso.
// Ahora las dos rutas llevan `qid` acuñado ANTES del primer envío, y el índice
// único parcial del servidor convierte el reintento en no-op.
//
// Run: node tests/idempotency.test.mjs
import assert from 'node:assert';
import { RULES } from '../core/pbRules.js';
import { evalRule } from './helpers/pbRuleEval.mjs';
import { createPocketbaseAssignments } from '../adapters/pocketbase/assignments.js';
import { createPocketbaseRemoteStore } from '../adapters/pocketbase/remoteStore.js';
import { createOfflineQueue } from '../core/offlineQueue.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const res = (status, obj) => ({ status, ok: status >= 200 && status < 300,
  text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });

// PocketBase de juguete con los índices únicos de verdad y ACKs que se PIERDEN.
function makeFakePb({ assignments = [] } = {}) {
  const rows = { assignment_attempts: [], results: [] };
  let seq = 0;
  let dropAcks = 0;   // los próximos N POST exitosos responden con fallo de red
  const fetchImpl = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const m = String(url).match(/\/api\/collections\/([\w_]+)\/records/);
    if (!m) return res(200, {});
    const coll = m[1];
    const body = opts.body ? JSON.parse(opts.body) : {};

    if (method === 'GET') {
      if (coll === 'assignments') return res(200, { items: assignments, totalItems: assignments.length });
      const q = decodeURIComponent(String(url));
      const items = (rows[coll] || []).filter(r => {
        const asg = (q.match(/assignment_id='([^']*)'/) || [])[1];
        const user = (q.match(/user_id='([^']*)'/) || [])[1];
        const qid = (q.match(/qid='([^']*)'/) || [])[1];
        return (!asg || r.assignment_id === asg) && (!user || r.user_id === user) && (!qid || r.qid === qid);
      });
      return res(200, { items, totalItems: items.length });
    }

    if (method === 'POST' && rows[coll]) {
      if (coll === 'assignment_attempts') {
        const allowed = evalRule(RULES.assignment_attempts.createRule, { body, collections: { assignments } });
        if (!allowed) return res(403, { message: 'forbidden' });
        const clashNo = rows[coll].some(r => r.assignment_id === body.assignment_id
          && r.user_id === body.user_id && r.attempt_no === body.attempt_no);
        if (clashNo) return res(400, { message: 'validation_not_unique', data: { attempt_no: { code: 'validation_not_unique' } } });
      }
      // Índice único PARCIAL sobre qid (results y attempts).
      if (body.qid && rows[coll].some(r => r.qid === body.qid)) {
        return res(400, { message: 'validation_not_unique', data: { qid: { code: 'validation_not_unique' } } });
      }
      const row = { id: 'r' + (++seq), ...body };
      rows[coll].push(row);
      // ACK PERDIDO: la fila SÍ quedó guardada, pero el cliente ve un error.
      if (dropAcks > 0) { dropAcks--; throw Object.assign(new Error('network blip'), { status: 0 }); }
      return res(200, row);
    }
    return res(200, {});
  };
  return { fetchImpl, rows, dropAck: () => { dropAcks++; } };
}

// ── 1. INTENTO de tarea: ACK perdido + reintento = UNA fila, UN intento ─────
{
  const asg = [{ id: 'a1', code: 'ABCDE', status: 'open', max_attempts: 2 }];
  const pb = makeFakePb({ assignments: asg });
  global.fetch = pb.fetchImpl;
  const d = createPocketbaseAssignments({ userId: 'anon1' });

  pb.dropAck();   // el primer envío llega pero el ACK se pierde
  await assert.rejects(() => d.recordAttempt('a1', 'act1', 'Ana', 3, 5, 1000, [], 'at_QID1'),
    /blip/, 'el cliente ve el fallo de red (premisa del escenario)');
  assert.strictEqual(pb.rows.assignment_attempts.length, 1, 'pero la fila SÍ quedó en el servidor');

  // El reintento (la cola offline) llega con el MISMO qid → detecta la fila y NO duplica.
  await d.recordAttempt('a1', 'act1', 'Ana', 3, 5, 1000, [], 'at_QID1');
  assert.strictEqual(pb.rows.assignment_attempts.length, 1, 'el reintento NO crea una segunda fila');
  assert.strictEqual(pb.rows.assignment_attempts[0].attempt_no, 1, 'y no gasta attempt_no 2 en falso');

  // Contra-prueba: un intento NUEVO de verdad (otro qid) sí entra, con su número.
  await d.recordAttempt('a1', 'act1', 'Ana', 4, 5, 900, [], 'at_QID2');
  assert.strictEqual(pb.rows.assignment_attempts.length, 2, 'un intento nuevo real sí entra');
  assert.strictEqual(pb.rows.assignment_attempts[1].attempt_no, 2, 'con el siguiente número');
  ok('intento de tarea: ACK perdido + reintento = una fila (y el intento nuevo real sigue entrando)');
}

// ── 2. RESULTADO: ACK perdido + reintento de la cola = UNA fila ─────────────
{
  const pb = makeFakePb();
  global.fetch = pb.fetchImpl;
  const rs = createPocketbaseRemoteStore();

  pb.dropAck();
  await assert.rejects(() => rs.saveResult({ activityId: 'act1', playerName: 'Ana', scoreAuto: 5, _qid: 'q_R1' }),
    /blip/, 'el cliente ve el fallo de red');
  assert.strictEqual(pb.rows.results.length, 1, 'la fila quedó en el servidor');

  // Reintento de la cola con el mismo _qid → el índice único responde 400 → el
  // adaptador comprueba el qid y lo da por ENTREGADO (resuelve, no lanza).
  await rs.saveResult({ activityId: 'act1', playerName: 'Ana', scoreAuto: 5, _qid: 'q_R1' });
  assert.strictEqual(pb.rows.results.length, 1, 'el reintento no duplica el resultado');

  await rs.saveResult({ activityId: 'act1', playerName: 'Ana', scoreAuto: 7, _qid: 'q_R2' });
  assert.strictEqual(pb.rows.results.length, 2, 'un resultado nuevo real sí entra');
  assert.strictEqual(pb.rows.results[1].qid, 'q_R2', 'y viaja con su clave');
  ok('resultado: ACK perdido + reintento = una fila (contra-prueba: el nuevo entra)');
}

// ── 3. La cola de intentos conserva la identidad entre reintentos ───────────
{
  // Sin red primero, con red después: el MISMO item (mismo qid) sale de la cola.
  const sentQids = [];
  let online = false;
  const store = [];
  const q = createOfflineQueue({
    load: () => [...store],
    save: (arr) => { store.length = 0; store.push(...arr); },
    send: async (it) => { if (!online) throw new Error('offline'); sentQids.push(it.qid); },
    idOf: (it) => it.qid,
  });
  q.enqueue({ qid: 'at_X', score: 3 });
  await q.flush();
  assert.strictEqual(store.length, 1, 'sin red, el intento espera en la cola');
  online = true;
  await q.flush();
  assert.deepStrictEqual(sentQids, ['at_X'], 'con red, sale UNA vez con su MISMO qid');
  assert.strictEqual(store.length, 0, 'y la cola queda vacía');
  ok('la cola de intentos reenvía con la misma identidad (qid) y se vacía al confirmar');
}

// ── 4. views/studentTask usa la cola (no el transporte directo) ─────────────
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../views/studentTask.js', import.meta.url), 'utf8');
  assert.match(src, /submitAttempt\(\{/, 'la entrega pasa por la cola (core/attemptQueue.js)');
  assert.match(src, /flushAttempts\(\)/, 'al abrir una tarea se reenvía lo pendiente de otra sesión');
  assert.ok(!/\brecordAttempt\(/.test(src.replace(/\/\/[^\n]*/g, '')), 'la vista ya no llama al transporte directo');
  ok('studentTask entrega por la cola y reenvía pendientes al entrar');
}

console.log(`\nidempotency.test: ${passed} checks passed`);
