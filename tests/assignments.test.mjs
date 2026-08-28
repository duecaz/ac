// ASYNC (tareas) tests: pure rules + local driver flow. Run: node tests/assignments.test.mjs
import assert from 'node:assert';
import { normalizeCode, isPastDue, attemptsRemaining, assignmentGate } from '../core/assignmentRules.js';
import { createLocalAssignments } from '../adapters/local/assignments.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ---------- pure rules ----------
assert.strictEqual(normalizeCode(' ab12 '), 'AB12');
assert.strictEqual(isPastDue(null), false, 'no due date → never past due');
assert.strictEqual(isPastDue('2020-01-01', Date.parse('2026-01-01')), true);
assert.strictEqual(isPastDue('2030-01-01', Date.parse('2026-01-01')), false);
assert.strictEqual(attemptsRemaining(3, 1), 2);
assert.strictEqual(attemptsRemaining(undefined, 0), 1, 'maxAttempts defaults to 1');
assert.strictEqual(attemptsRemaining(1, 5), 0, 'never negative');
ok('rules: normalizeCode, isPastDue, attemptsRemaining');

const base = { status: 'open', due_at: null, max_attempts: 2 };
assert.deepStrictEqual(assignmentGate(null, 0), { allowed: false, reason: 'notFound' });
assert.deepStrictEqual(assignmentGate({ ...base, status: 'closed' }, 0), { allowed: false, reason: 'closed' });
assert.deepStrictEqual(assignmentGate({ ...base, due_at: '2020-01-01' }, 0, Date.parse('2026-01-01')), { allowed: false, reason: 'pastDue' });
assert.deepStrictEqual(assignmentGate(base, 2), { allowed: false, reason: 'noAttemptsLeft' });
assert.deepStrictEqual(assignmentGate(base, 1), { allowed: true, reason: null });
ok('assignmentGate: notFound → closed → pastDue → noAttemptsLeft → allowed');

// ---------- local driver flow ----------
function fakeKV() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
const kv = fakeKV();
const teacher = createLocalAssignments({ kv, userId: 'teacher' });
const student = createLocalAssignments({ kv, userId: 'student-1' }); // same store, another "tab"

const activity = { id: 'act1', title: 'Sumas', template: 'quiz', scoring: {}, content: { items: [{ id: 'q', answer: '4' }] } };
const { id, code } = await teacher.createAssignment(activity, { title: 'Tarea 1', maxAttempts: 2 });
assert.ok(code && code.length === 6, 'assignment gets a 6-char code');

// student finds it by code (case-insensitive)
const found = await student.findAssignmentByCode(code.toLowerCase());
assert.strictEqual(found.id, id);
assert.strictEqual(found.max_attempts, 2);
ok('teacher creates a task; student finds it by code (shared store, case-insensitive)');

// attempts gating across "tabs"
assert.strictEqual(await student.countOwnAttempts(id), 0);
await student.recordAttempt(id, activity.id, 'Ana', 1, 1, 30);
await student.recordAttempt(id, activity.id, 'Ana', 1, 1, 20);
assert.strictEqual(await student.countOwnAttempts(id), 2, 'own attempts counted');
assert.deepStrictEqual(assignmentGate(found, await student.countOwnAttempts(id)), { allowed: false, reason: 'noAttemptsLeft' });
ok('attempts recorded and gate blocks after max_attempts');

// a different student is independent
const other = createLocalAssignments({ kv, userId: 'student-2' });
assert.strictEqual(await other.countOwnAttempts(id), 0, 'attempts are per-user');
ok('attempts are scoped per user');

// teacher sees all attempts; closing blocks new ones
const all = await teacher.listAttempts(id);
assert.strictEqual(all.length, 2, 'teacher lists all attempts');
await teacher.closeAssignment(id);
assert.strictEqual((await student.findAssignmentByCode(code)).status, 'closed');
assert.deepStrictEqual(assignmentGate(await student.findAssignmentByCode(code), 0), { allowed: false, reason: 'closed' });
ok('teacher lists attempts and closes the task (then gate blocks)');

// rotating the code invalidates the old one
const newCode = await teacher.rotateAssignmentCode(id);
assert.notStrictEqual(newCode, code, 'code rotated');
assert.strictEqual(await student.findAssignmentByCode(code), null, 'old code no longer resolves');
ok('rotateAssignmentCode issues a fresh code and retires the old');

// ── LAS TAREAS QUE VES SON LAS TUYAS ────────────────────────────────────────
// Desde v1.51.621 la tarjeta ofrece «Tarea» en toda la biblioteca, así que dos
// profes mandando de deberes la MISMA actividad publicada es el caso normal. El
// listado filtraba solo por `activity_id` y la colección tiene list/view
// abiertos (el alumno anónimo tiene que poder leer la suya), de modo que la
// pantalla enseñaba el PIN, los intentos y los botones de «Cerrar» y «Rotar
// PIN» de las tareas del OTRO profe — y `updateRule` es solo AUTH, así que el
// botón funcionaba de verdad.
{
  const otra = createLocalAssignments({ kv, userId: 'teacher-2' });
  const mia = await otra.createAssignment(activity, { title: 'La mía' });
  const suyas = await teacher.listAssignmentsForActivity('act1');
  assert.ok(!suyas.some(a => a.id === mia.id),
    'la tarea de otro profe sobre la misma actividad NO puede salir en mi pantalla');
  // CONTRA-PRUEBA: y las MÍAS siguen saliendo — un filtro de más deja al profe
  // sin ver el PIN que acaba de crear, con la clase esperando.
  const propias = await otra.listAssignmentsForActivity('act1');
  assert.ok(propias.some(a => a.id === mia.id), 'CONTRA-PRUEBA: cada profe sí ve las suyas');
  ok('la pantalla de tareas lista MIS tareas de esa actividad, no las de otro profe');
}

// ── «MÍA» ES DE LA CUENTA, NO DEL NAVEGADOR ─────────────────────────────────
// El primer arreglo filtró por `author_id`… que se sellaba con el id ANÓNIMO del
// navegador. O sea: «tareas creadas en ESTA pizarra». El mismo profe en otro
// aparato o tras limpiar la caché habría perdido de vista sus PIN y sus
// informes, sin recuperación — exactamente el fallo que este mismo trabajo
// acababa de arreglar para las actividades.
{
  const anonA = 'anon-pizarra-A', anonB = 'anon-portatil-B', cuenta = 'u_profe';
  const enA = createLocalAssignments({ kv, userId: () => cuenta, identities: () => [cuenta, anonA] });
  const { id: creada } = await enA.createAssignment(activity, { title: 'Desde la pizarra' });
  const enB = createLocalAssignments({ kv, userId: () => cuenta, identities: () => [cuenta, anonB] });
  assert.ok((await enB.listAssignmentsForActivity('act1')).some(a => a.id === creada),
    'el mismo profe en otro aparato tiene que seguir viendo su tarea (y su PIN)');
  // Y las de ANTES, selladas con el navegador, no se quedan huérfanas aquí.
  const legado = createLocalAssignments({ kv, userId: () => anonA, identities: () => [anonA] });
  const { id: vieja } = await legado.createAssignment(activity, { title: 'De antes de la cuenta' });
  assert.ok((await enA.listAssignmentsForActivity('act1')).some(a => a.id === vieja),
    'una tarea creada antes de entrar sigue siendo mía en el navegador donde nació');
  // CONTRA-PRUEBA: y en el otro aparato esa vieja NO aparece — es lo único que
  // el id del navegador puede afirmar, y afirmar de más sería el bug de antes.
  assert.ok(!(await enB.listAssignmentsForActivity('act1')).some(a => a.id === vieja),
    'CONTRA-PRUEBA: la tarea anónima de otra pizarra no es mía');
  ok('«mía» la decide la CUENTA (y el navegador para las de antes), no el id anónimo');
}

console.log(`\nassignments.test: ${passed} checks passed`);
