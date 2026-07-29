// Relojes compartidos de los modos con fecha límite (core/deadlineTicker.js).
// Antes cada sitio se montaba su `setInterval(…, 250)` con `Date.now()` y
// limpieza a mano: hostLive (pregunta, carrera, tablero) y studentLive. Ninguno
// era testeable con tiempo congelado. Aquí se fija el comportamiento con reloj y
// scheduler inyectados. Run: node tests/deadlineTicker.test.mjs
import assert from 'node:assert';
import { clock } from '../core/clock.js';
import { startDeadlineTicker, startElapsedTicker } from '../core/deadlineTicker.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Scheduler falso: guarda el callback y lo dispara a mano.
function fakeScheduler() {
  const timers = new Map();
  let id = 0;
  return {
    setIntervalFn: (fn) => { timers.set(++id, fn); return id; },
    clearIntervalFn: (h) => timers.delete(h),
    fire: () => [...timers.values()].forEach(fn => fn()),
    count: () => timers.size,
  };
}

const realNow = clock.now;
try {
  // ── cuenta atrás hasta un instante ───────────────────────────────────────
  {
    let t = 1_000_000;
    clock.now = () => t;
    const sch = fakeScheduler();
    const ticks = [];
    let expired = 0;
    const ticker = startDeadlineTicker({
      deadline: t + 10_000, totalMs: 10_000,
      onTick: (x) => ticks.push(x), onExpire: () => expired++,
      setIntervalFn: sch.setIntervalFn, clearIntervalFn: sch.clearIntervalFn,
    });
    assert.strictEqual(ticks.length, 1, 'pinta de inmediato, sin esperar al primer intervalo');
    assert.deepStrictEqual({ s: ticks[0].remainSec, p: ticks[0].pct }, { s: 10, p: 100 }, '10s restantes, barra al 100%');

    t += 5_000; sch.fire();
    assert.strictEqual(ticks[1].remainSec, 5, 'a mitad: 5s');
    assert.strictEqual(ticks[1].pct, 50, 'barra al 50%');

    t += 6_000; sch.fire();                      // pasado el límite
    assert.strictEqual(ticks[2].remainMs, 0, 'nunca baja de 0 (sin negativos)');
    assert.strictEqual(expired, 1, 'onExpire se dispara');
    assert.strictEqual(sch.count(), 0, 'y el reloj se detiene solo');
    sch.fire();
    assert.strictEqual(expired, 1, 'onExpire no se repite');
    ticker.stop();
    ok('cuenta atrás: pinta ya, no baja de 0, expira una sola vez y se auto-detiene');
  }

  // ── el guard `while` corta el reloj zombi ────────────────────────────────
  {
    let t = 0, phase = 'question';
    clock.now = () => t;
    const sch = fakeScheduler();
    let ticks = 0;
    startDeadlineTicker({
      deadline: 60_000, onTick: () => ticks++, while: () => phase === 'question',
      setIntervalFn: sch.setIntervalFn, clearIntervalFn: sch.clearIntervalFn,
    });
    sch.fire();
    assert.strictEqual(ticks, 2, 'mientras la fase siga, sigue pintando');
    phase = 'reveal';                        // el profe avanzó
    sch.fire();
    assert.strictEqual(ticks, 2, 'al cambiar de fase deja de pintar (no pisa la pantalla siguiente)');
    assert.strictEqual(sch.count(), 0, 'y se limpia solo');
    ok('el guard `while` evita el reloj zombi que repintaba sobre la fase siguiente');
  }

  // ── sin deadline no hay reloj (host en pausa) ────────────────────────────
  {
    const sch = fakeScheduler();
    let ticks = 0;
    const h = startDeadlineTicker({ deadline: null, onTick: () => ticks++, setIntervalFn: sch.setIntervalFn });
    assert.strictEqual(ticks, 0, 'sin fecha límite no pinta');
    assert.strictEqual(sch.count(), 0, 'ni programa nada');
    assert.doesNotThrow(() => h.stop(), 'stop() es seguro igualmente');
    ok('sin deadline (host en pausa) no se crea reloj');
  }

  // ── cronómetro ascendente (carrera / tablero) ────────────────────────────
  {
    let t = 500_000;
    clock.now = () => t;
    const sch = fakeScheduler();
    const labels = [];
    startElapsedTicker({
      since: t, onTick: ({ label }) => labels.push(label),
      setIntervalFn: sch.setIntervalFn, clearIntervalFn: sch.clearIntervalFn,
    });
    assert.strictEqual(labels[0], '0:00', 'arranca en 0:00');
    t += 65_000; sch.fire();
    assert.strictEqual(labels[1], '1:05', 'formatea m:ss con relleno');
    ok('cronómetro ascendente: formato m:ss desde el instante de inicio');
  }
} finally {
  clock.now = realNow;
}

console.log(`\ndeadlineTicker.test: ${passed} checks passed`);
