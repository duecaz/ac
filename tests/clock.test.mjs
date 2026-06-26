// Injectable clock (core/clock.js). Proves domain logic that reads "now" is
// deterministic once the clock is frozen — the whole point of the indirection.
// Run: node tests/clock.test.mjs
import assert from 'node:assert';
import { clock } from '../core/clock.js';
import { isPastDue, assignmentGate } from '../core/assignmentRules.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Default: clock.now() tracks the wall clock.
{
  const before = Date.now();
  const n = clock.now();
  assert.ok(typeof n === 'number' && n >= before, 'clock.now() devuelve el tiempo real por defecto');
  ok('clock.now(): por defecto === Date.now()');
}

// Freeze the clock → past-due gating becomes deterministic (no real-time flake).
const realNow = clock.now;
try {
  const due = '2026-06-26T12:00:00.000Z';
  const dueMs = new Date(due).getTime();

  clock.now = () => dueMs - 1000;   // 1s ANTES del vencimiento
  assert.strictEqual(isPastDue(due), false, 'antes del vencimiento → no vencida');

  clock.now = () => dueMs + 1000;   // 1s DESPUÉS del vencimiento
  assert.strictEqual(isPastDue(due), true, 'después del vencimiento → vencida');
  ok('isPastDue(): usa el reloj inyectado (congelable en tests)');

  // assignmentGate hereda el reloj congelado a través de su default `now`.
  const assignment = { status: 'open', due_at: due, max_attempts: 3 };
  clock.now = () => dueMs - 1000;
  assert.deepStrictEqual(assignmentGate(assignment, 0), { allowed: true, reason: null },
    'antes del vencimiento, con intentos → permitido');
  clock.now = () => dueMs + 1000;
  assert.deepStrictEqual(assignmentGate(assignment, 0), { allowed: false, reason: 'pastDue' },
    'después del vencimiento → bloqueado por pastDue');
  ok('assignmentGate(): el default `now` pasa por clock.now()');

  // Un argumento explícito sigue ganando sobre el reloj global.
  assert.strictEqual(isPastDue(due, dueMs - 5000), false, 'now explícito tiene prioridad');
  ok('isPastDue(): el argumento explícito anula el reloj global');
} finally {
  clock.now = realNow;
}

console.log(`\nclock.test: ${passed} checks passed`);
