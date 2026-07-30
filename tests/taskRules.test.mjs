// §22-3 — EL TOPE DE INTENTOS LO APLICA EL SERVIDOR.
//
// Antes el límite vivía ENTERO en el cliente: `countOwnAttempts` contaba y la
// vista decidía. Un POST a mano —o borrar `ww.anonId`— daba intentos infinitos, y
// una tarea CERRADA seguía aceptando entregas por API.
//
// Aquí el evaluador de reglas (tests/helpers/pbRuleEval.mjs) hace de servidor y el
// ADAPTADOR REAL entrega contra él, con las dos caras de la ley:
//   · demasiado ABIERTA → el 3º intento de un tope de 2 debe rebotar;
//   · demasiado CERRADA → el alumno legítimo debe poder entregar, incluso en una
//     tarea antigua sin `max_attempts` (semántica canónica: null ⇒ 1).
//
// Run: node tests/taskRules.test.mjs
import assert from 'node:assert';
import { RULES } from '../core/pbRules.js';
import { evalRule } from './helpers/pbRuleEval.mjs';
import { createPocketbaseAssignments } from '../adapters/pocketbase/assignments.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── PocketBase de juguete: aplica reglas + el índice ÚNICO ───────────────────
function makeFakePb({ assignments = [] } = {}) {
  const attempts = [];
  const denied = [];
  let seq = 0;
  const res = (status, obj) => ({ status, ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(obj ?? {}), json: async () => obj ?? {} });

  const fetchImpl = async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase();
    const m = String(url).match(/\/api\/collections\/([\w_]+)\/records/);
    if (!m) return res(200, {});
    const coll = m[1];
    const body = opts.body ? JSON.parse(opts.body) : {};

    if (method === 'GET') {
      if (coll === 'assignment_attempts') {
        // Filtro mínimo: (assignment_id, user_id) es lo único que consulta el
        // adaptador para contar.
        const q = decodeURIComponent(String(url));
        const asg = (q.match(/assignment_id='([^']*)'/) || [])[1];
        const user = (q.match(/user_id='([^']*)'/) || [])[1];
        const items = attempts.filter(r => (!asg || r.assignment_id === asg) && (!user || r.user_id === user));
        return res(200, { items, totalItems: items.length });
      }
      if (coll === 'assignments') return res(200, { items: assignments, totalItems: assignments.length });
      return res(200, { items: [], totalItems: 0 });
    }

    if (method === 'POST' && coll === 'assignment_attempts') {
      // 1) la REGLA (con el join a assignments, como en el servidor)
      const allowed = evalRule(RULES.assignment_attempts.createRule, {
        auth: null, body, collections: { assignments },
      });
      if (!allowed) { denied.push('create'); return res(403, { message: 'forbidden' }); }
      // 2) el ÍNDICE ÚNICO (assignment_id, user_id, attempt_no)
      const clash = attempts.some(r => r.assignment_id === body.assignment_id
        && r.user_id === body.user_id && r.attempt_no === body.attempt_no);
      if (clash) return res(400, { message: 'validation_not_unique' });
      const row = { id: 'att' + (++seq), ...body };
      attempts.push(row);
      return res(200, row);
    }
    return res(200, {});
  };
  return { fetchImpl, attempts, denied };
}

const drv = (fetchImpl, userId = 'anon1') => {
  global.fetch = fetchImpl;
  return createPocketbaseAssignments({ userId });
};

// ── 1. Tope de 2: entran dos, el tercero rebota ─────────────────────────────
{
  const asg = [{ id: 'a1', code: 'ABCDE', status: 'open', max_attempts: 2 }];
  const { fetchImpl, attempts } = makeFakePb({ assignments: asg });
  const d = drv(fetchImpl);
  await d.recordAttempt('a1', 'act1', 'Ana', 3, 5, 1000, []);
  await d.recordAttempt('a1', 'act1', 'Ana', 4, 5, 900, []);
  assert.deepStrictEqual(attempts.map(a => a.attempt_no), [1, 2], 'los dos intentos legítimos entran, numerados');
  await assert.rejects(() => d.recordAttempt('a1', 'act1', 'Ana', 5, 5, 800, []),
    (e) => e.status === 403 && /agotado|cerrada/i.test(e.message),
    'el TERCER intento debe rebotar en el servidor con un mensaje claro');
  assert.strictEqual(attempts.length, 2, 'y no debe quedar fila de más');
  ok('tope de 2: entran dos, el tercero lo rechaza el servidor (no el cliente)');
}

// ── 2. Contra-prueba: tarea ANTIGUA sin max_attempts ───────────────────────
{
  const asg = [{ id: 'a1', code: 'ABCDE', status: 'open' }];   // sin max_attempts
  const { fetchImpl, attempts } = makeFakePb({ assignments: asg });
  const d = drv(fetchImpl);
  await d.recordAttempt('a1', 'act1', 'Ana', 3, 5, 1000, []);
  assert.strictEqual(attempts.length, 1, 'el alumno legítimo entrega: null ⇒ 1 intento (semántica canónica)');
  await assert.rejects(() => d.recordAttempt('a1', 'act1', 'Ana', 4, 5, 900, []),
    (e) => e.status === 403, 'y el segundo ya no: null NO significa ilimitado');
  ok('contra-prueba: una tarea sin max_attempts sigue admitiendo su intento (y solo uno)');
}

// ── 3. Tarea CERRADA: el servidor no acepta entregas ───────────────────────
{
  const asg = [{ id: 'a1', code: 'ABCDE', status: 'closed', max_attempts: 5 }];
  const { fetchImpl, attempts } = makeFakePb({ assignments: asg });
  const d = drv(fetchImpl);
  await assert.rejects(() => d.recordAttempt('a1', 'act1', 'Ana', 3, 5, 1000, []),
    (e) => e.status === 403, 'una tarea cerrada ya no acepta intentos por API');
  assert.strictEqual(attempts.length, 0);
  ok('tarea cerrada: el gateo deja de ser solo de cliente');
}

// ── 4. Choque del índice único → recuenta y reintenta ──────────────────────
{
  const asg = [{ id: 'a1', code: 'ABCDE', status: 'open', max_attempts: 3 }];
  const { fetchImpl, attempts } = makeFakePb({ assignments: asg });
  // Ya hay un intento nº1 (otra pestaña lo entregó y nuestra cuenta va desfasada).
  attempts.push({ id: 'pre', assignment_id: 'a1', user_id: 'anon1', attempt_no: 1 });
  const d = drv(fetchImpl);
  // La cuenta dice 1 → pide el 2; si alguien se le adelanta, el 400 le hace
  // recontar. Aquí el 2 está libre, así que entra a la primera.
  await d.recordAttempt('a1', 'act1', 'Ana', 3, 5, 1000, []);
  assert.deepStrictEqual(attempts.map(a => a.attempt_no).sort(), [1, 2], 'el intento entra con el siguiente número libre');
  ok('el índice único no duplica: el adaptador recuenta y usa el siguiente número');
}

// ── 5. El join es de la MISMA fila (no vale la tarea del vecino) ───────────
{
  // Otra tarea, generosa (tope 9) — no puede prestar su cupo a la nuestra.
  const asg = [
    { id: 'a1', code: 'ABCDE', status: 'open', max_attempts: 1 },
    { id: 'a2', code: 'FGHIJ', status: 'open', max_attempts: 9 },
  ];
  const allowed = evalRule(RULES.assignment_attempts.createRule, {
    body: { assignment_id: 'a1', attempt_no: 5 }, collections: { assignments: asg },
  });
  assert.strictEqual(allowed, false,
    'el tope debe salir de la tarea del intento, no de cualquier fila que cumpla una condición suelta');
  const allowedOwn = evalRule(RULES.assignment_attempts.createRule, {
    body: { assignment_id: 'a2', attempt_no: 5 }, collections: { assignments: asg },
  });
  assert.strictEqual(allowedOwn, true, 'y en su propia tarea generosa sí pasa');
  ok('el join va contra la MISMA tarea (alias), no contra cualquier fila');
}

// ── 6. Sigue sin exigir cuenta al alumno ───────────────────────────────────
{
  const asg = [{ id: 'a1', status: 'open', max_attempts: 1 }];
  assert.ok(!RULES.assignment_attempts.createRule.includes('@request.auth'),
    'el alumno es ANÓNIMO: la regla no puede pedir sesión');
  assert.strictEqual(evalRule(RULES.assignment_attempts.createRule,
    { auth: null, body: { assignment_id: 'a1', attempt_no: 1 }, collections: { assignments: asg } }), true,
    'un alumno sin cuenta entrega su primer intento');
  ok('el tope se aplica SIN pedirle cuenta al alumno');
}

console.log(`\ntaskRules.test: ${passed} checks passed`);
