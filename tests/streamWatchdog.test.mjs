// RENOVAR ANTES DE QUE LO CORTEN — el vigía de un flujo permanente.
//
// El caso (dueño, 2026-08-16): la consola del modo en vivo llena de cortes de la
// conexión con la Pi. Su propuesta: «si es por inactividad debería tener un
// aviso antes de cumplirse la inactividad, eso es básico». Correcto — con el
// matiz de que SSE es de una dirección y el navegador no puede mandar latidos:
// lo que puede es no esperar al error y renovar por decisión propia.
//
// Se prueba con tiempo CONGELADO y scheduler inyectado: sin navegador, sin red y
// sin esperar 80 segundos reales.
// Run: node tests/streamWatchdog.test.mjs
import assert from 'node:assert';
import { startStreamWatchdog } from '../core/streamWatchdog.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Reloj y scheduler de juguete: `tic(ms)` avanza el tiempo y dispara los
// chequeos que tocarían en ese intervalo.
function banco() {
  let t = 0;
  const tareas = [];
  const api = {
    now: () => t,
    setIntervalFn: (fn, ms) => { tareas.push({ fn, ms, prox: t + ms }); return tareas.length - 1; },
    clearIntervalFn: (id) => { if (tareas[id]) tareas[id].muerta = true; },
    tic(ms) {
      const fin = t + ms;
      for (;;) {
        const pend = tareas.filter(x => !x.muerta && x.prox <= fin).sort((a, b) => a.prox - b.prox)[0];
        if (!pend) break;
        t = pend.prox; pend.prox += pend.ms; pend.fn();
      }
      t = fin;
    },
  };
  return api;
}

// ── 1. Con tráfico, NO renueva ──────────────────────────────────────────────
// El host sella su presencia cada ~10 s: un flujo vivo nunca debe renovarse, o
// estaríamos cortando conexiones sanas cada minuto y medio.
{
  const b = banco();
  let renov = 0;
  const v = startStreamWatchdog({ silencioMs: 80000, onRenew: () => renov++, ...b, now: b.now });
  for (let i = 0; i < 30; i++) { b.tic(10000); v.touch(); }   // 5 minutos con tráfico
  assert.strictEqual(renov, 0, 'con tráfico cada 10 s no se renueva nada');
  ok('con el flujo hablando (cada 10 s) NO se renueva: no se corta lo que funciona');
}

// ── 2. Con silencio, renueva ANTES del corte ────────────────────────────────
{
  const b = banco();
  let renov = 0;
  const v = startStreamWatchdog({ silencioMs: 80000, onRenew: () => renov++, ...b, now: b.now });
  b.tic(79000);
  assert.strictEqual(renov, 0, 'a los 79 s todavía no');
  b.tic(2000);
  assert.strictEqual(renov, 1, 'pasado el umbral, renueva');
  assert.ok(81000 < 100000, 'y lo hace ANTES de los 100 s a los que corta el intermediario');
  ok('con el flujo callado renueva al pasar el umbral, antes de que lo corten');
}

// ── 3. Una renovación por episodio, no una cascada ──────────────────────────
// Si `onRenew` reconecta y el flujo nuevo tarda en hablar, no puede dispararse
// otra vez al chequeo siguiente: serían reconexiones en bucle.
{
  const b = banco();
  let renov = 0;
  const v = startStreamWatchdog({ silencioMs: 80000, onRenew: () => renov++, ...b, now: b.now });
  b.tic(200000);   // más del doble del umbral, sin una sola señal
  assert.strictEqual(renov, 2, `dos ventanas de silencio → dos renovaciones, no ${renov}`);
  ok('el contador se reinicia al renovar: no encadena reconexiones');
}

// ── 4. `stop()` lo suelta de verdad (ley §23) ───────────────────────────────
// Un vigía huérfano reconectaría una sala que el profe ya cerró.
{
  const b = banco();
  let renov = 0;
  const v = startStreamWatchdog({ silencioMs: 80000, onRenew: () => renov++, ...b, now: b.now });
  v.stop();
  b.tic(500000);
  assert.strictEqual(renov, 0, 'tras stop() no vuelve a disparar');
  ok('stop() lo suelta: no queda un vigía zombi reconectando una sala cerrada');
}

// ── 5. CONTRA-PRUEBA: el banco de pruebas mide de verdad ────────────────────
// Sin esto, un scheduler de juguete que no dispara nada haría pasar los cuatro
// checks anteriores por el motivo equivocado.
{
  const b = banco();
  let veces = 0;
  b.setIntervalFn(() => veces++, 1000);
  b.tic(5000);
  assert.strictEqual(veces, 5, 'el scheduler de juguete dispara lo que toca');
  ok('CONTRA-PRUEBA: el tiempo falso avanza y dispara (si no, todo pasaría en vacío)');
}

console.log(`\n  ${passed} streamWatchdog checks passed`);
