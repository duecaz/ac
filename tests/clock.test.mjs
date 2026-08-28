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

// ── Las vistas de LIVE ya no miran el reloj del sistema (§23) ────────────────
// Eran las dos últimas con `Date.now()` crudo en sus deadlines, y por eso las
// únicas que no se podían testear con tiempo congelado. Este guardarraíl impide
// que vuelva a colarse: los deadlines y los cronómetros pasan por clock.now() o
// por los primitivos de core/deadlineTicker.js.
{
  const { readFileSync, readdirSync } = await import('node:fs');
  // v1.51.628: hostLive/studentLive se partieron POR BUCLE — una aserción
  // NEGATIVA («el fichero NO contiene X») se aplica a la CONCATENACIÓN de la
  // familia (el ensamblador + todos sus views/live/*), o quedaría más floja
  // que antes del corte.
  const liveDir = new URL('../views/live/', import.meta.url);
  const familias = {
    'views/hostLive.js': readdirSync(liveDir).filter(n => n.startsWith('host')),
    'views/studentLive.js': readdirSync(liveDir).filter(n => n.startsWith('student')),
  };
  for (const [ensamblador, hijos] of Object.entries(familias)) {
    const ficheros = [ensamblador, ...hijos.map(n => `views/live/${n}`)];
    const src = ficheros.map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n')
      // fuera comentarios: una explicación puede nombrar Date.now()
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    assert.ok(!/\bDate\.now\s*\(/.test(src), `${ensamblador} y su familia deben usar clock.now(), no Date.now()`);
    assert.ok(!/new Date\s*\)/.test(src.replace(/\s+/g, '')), `${ensamblador} y su familia no deben usar new Date() sin argumento`);
  }
  ok('hostLive y studentLive: sin Date.now() ni new Date() a pelo (testeables con reloj congelado)');
}

console.log(`\nclock.test: ${passed} checks passed`);
