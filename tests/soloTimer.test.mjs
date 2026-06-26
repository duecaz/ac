// Tests del countdown único (core/soloTimer.js). Inyecta un scheduler falso
// para disparar los ticks de forma síncrona y determinista.
import assert from 'node:assert';
import { createCountdown } from '../core/soloTimer.js';

function ok(msg) { console.log('  ✓', msg); }

// Scheduler falso: captura el callback de setInterval y permite dispararlo a mano.
function fakeScheduler() {
  let cb = null, cleared = false;
  return {
    setIntervalFn: (fn) => { cb = fn; return 1; },
    clearIntervalFn: () => { cleared = true; cb = null; },
    fire(n = 1) { for (let i = 0; i < n; i++) if (cb) cb(); },
    get cleared() { return cleared; },
    get armed() { return cb !== null; },
  };
}

// 1) Conteo: 3s → onTick(2), onTick(1), onTick(0) y un solo onTimeout.
{
  const s = fakeScheduler();
  const ticks = [];
  let timeouts = 0;
  const t = createCountdown(3, {
    onTick: (r) => ticks.push(r),
    onTimeout: () => timeouts++,
    setIntervalFn: s.setIntervalFn,
    clearIntervalFn: s.clearIntervalFn,
  });
  t.start();
  s.fire(3);
  assert.deepStrictEqual(ticks, [2, 1, 0], 'emite remaining 2,1,0');
  assert.strictEqual(timeouts, 1, 'onTimeout exactamente una vez');
  assert.strictEqual(s.cleared, true, 'se auto-detiene al llegar a 0');
  ok('3s cuenta 2,1,0 y dispara timeout una vez');
}

// 2) Disparos extra tras timeout no vuelven a llamar onTimeout.
{
  const s = fakeScheduler();
  let timeouts = 0;
  const t = createCountdown(1, {
    onTimeout: () => timeouts++,
    setIntervalFn: s.setIntervalFn,
    clearIntervalFn: s.clearIntervalFn,
  });
  t.start();
  s.fire(5);
  assert.strictEqual(timeouts, 1, 'timeout idempotente aunque se dispare de más');
  ok('timeout no se repite tras detenerse');
}

// 3) seconds<=0 no arranca (sin límite de tiempo).
{
  const s = fakeScheduler();
  let any = false;
  const t = createCountdown(0, {
    onTick: () => { any = true; },
    onTimeout: () => { any = true; },
    setIntervalFn: s.setIntervalFn,
    clearIntervalFn: s.clearIntervalFn,
  });
  t.start();
  assert.strictEqual(s.armed, false, 'no arma scheduler con 0s');
  assert.strictEqual(any, false, 'no hay ticks ni timeout con 0s');
  ok('seconds<=0 = sin temporizador');
}

// 4) stop() detiene antes de tiempo y es idempotente.
{
  const s = fakeScheduler();
  const ticks = [];
  const t = createCountdown(10, {
    onTick: (r) => ticks.push(r),
    setIntervalFn: s.setIntervalFn,
    clearIntervalFn: s.clearIntervalFn,
  });
  t.start();
  s.fire(2);
  t.stop();
  t.stop(); // idempotente, no debe lanzar
  assert.deepStrictEqual(ticks, [9, 8], 'detuvo tras 2 ticks');
  assert.strictEqual(t.running, false, 'running=false tras stop');
  ok('stop() corta el conteo y es idempotente');
}

// 5) start() doble no duplica el scheduler.
{
  const s = fakeScheduler();
  let arms = 0;
  const t = createCountdown(5, {
    setIntervalFn: (fn) => { arms++; return 1; },
    clearIntervalFn: s.clearIntervalFn,
  });
  t.start();
  t.start();
  assert.strictEqual(arms, 1, 'segundo start() es no-op mientras corre');
  ok('start() no se duplica');
}

console.log('soloTimer.test: 5 checks passed');
