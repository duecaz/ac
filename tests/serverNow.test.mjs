// T3 · LA HORA COMÚN (§22-5) — el desfase se MIDE contra el servidor.
//
// Dos niveles, como en `serverMs` y `liveRules`: la función pura, y el CABLEADO
// real (la cabecera `Date` entrando por la puerta única de PocketBase con
// `fetch` inyectado). Lo segundo es lo que de verdad se rompió en clase: no
// basta con que el módulo sepa calcular el desfase si nadie lo alimenta.
//
// Run: node tests/serverNow.test.mjs
import assert from 'node:assert';
import { clock } from '../core/clock.js';
import { noteServerDate, serverNow, serverOffsetMs, resetServerClock } from '../core/serverNow.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const real = clock.now;
const congelar = (ms) => { clock.now = () => ms; };
const AHORA = 1_700_000_000_000;   // lo que cree ESTE aparato

// ── 1. Sin muestras: idéntico a hoy (CONTRA-PRUEBA del cambio entero) ────────
// Es el caso del backend local, de los tests y de cualquier pantalla que aún no
// haya hablado con PocketBase. Si esto falla, el arreglo rompió lo que funcionaba.
{
  resetServerClock(); congelar(AHORA);
  assert.strictEqual(serverOffsetMs(), 0);
  assert.strictEqual(serverNow(), clock.now(), 'sin servidor, la hora común ES el reloj del aparato');
  ok('CONTRA-PRUEBA: sin muestras el comportamiento es EXACTAMENTE el de antes (desfase 0)');
}

// ── 2. El aparato atrasado 10 s (el Android del compañero) ───────────────────
{
  resetServerClock(); congelar(AHORA);
  // El servidor dice que son 10 s MÁS de lo que cree el móvil.
  noteServerDate(new Date(AHORA + 10_000).toUTCString(), { enviadoMs: AHORA, recibidoMs: AHORA });
  assert.ok(Math.abs(serverOffsetMs() - 10_000) <= 1000, `desfase medido: ${serverOffsetMs()}`);
  assert.ok(Math.abs(serverNow() - (AHORA + 10_000)) <= 1000, 'la hora común corrige el atraso');
  ok('un móvil 10 s atrasado queda en hora (±1 s, que es la resolución de la cabecera)');
}

// ── 3. La latencia de red no se cuela como desfase ───────────────────────────
{
  resetServerClock();
  // Petición de 400 ms: el sello del servidor cayó a mitad del viaje. El aparato
  // está EN HORA, así que el desfase tiene que salir ~0, no ~400.
  congelar(AHORA + 400);
  noteServerDate(new Date(AHORA + 200).toUTCString(), { enviadoMs: AHORA, recibidoMs: AHORA + 400 });
  assert.ok(Math.abs(serverOffsetMs()) <= 1000, `un viaje de 400 ms no debe verse como desfase: ${serverOffsetMs()}`);
  ok('se descuenta medio viaje de ida y vuelta: la red lenta no se confunde con reloj torcido');
}

// ── 4. MEDIANA: una muestra rara no mueve la hora ────────────────────────────
// Un pico de latencia (o una respuesta servida desde una caché) no puede
// desplazar el reloj de toda la clase.
{
  resetServerClock(); congelar(AHORA);
  for (let i = 0; i < 4; i++) {
    noteServerDate(new Date(AHORA + 10_000).toUTCString(), { enviadoMs: AHORA, recibidoMs: AHORA });
  }
  noteServerDate(new Date(AHORA + 90_000).toUTCString(), { enviadoMs: AHORA, recibidoMs: AHORA });  // atípica
  assert.ok(Math.abs(serverOffsetMs() - 10_000) <= 1000,
    `la mediana debe ignorar la muestra atípica, salió ${serverOffsetMs()}`);
  ok('MEDIANA de las últimas muestras: un pico suelto no desplaza la hora común');
}

// ── 5. Basura: no rompe y no mueve nada ──────────────────────────────────────
{
  resetServerClock(); congelar(AHORA);
  noteServerDate(null); noteServerDate(''); noteServerDate('no soy una fecha'); noteServerDate(undefined);
  assert.strictEqual(serverOffsetMs(), 0, 'sin cabecera legible, el desfase se queda como estaba');
  ok('una cabecera ausente o ilegible no envenena la hora (se ignora, no se adivina)');
}

// ── 6. EL CABLEADO REAL: la cabecera entra por `core/pbHttp.js` ──────────────
// La parte que de verdad falló en clase. `signedFetch` es la puerta única de
// todo el tráfico PB: si ahí no se toma la muestra, el módulo de arriba nunca se
// entera y el desfase sigue siendo 0 con el servidor delante.
{
  resetServerClock(); congelar(AHORA);
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 200,
    headers: { get: (k) => (k.toLowerCase() === 'date' ? new Date(AHORA + 10_000).toUTCString() : null) },
    text: async () => '{"ok":true}',
  });
  try {
    const { signedFetch } = await import('../core/pbHttp.js');
    await signedFetch('https://pb.example/api/health');
    assert.ok(Math.abs(serverOffsetMs() - 10_000) <= 1000,
      `signedFetch debe alimentar la hora común; desfase tras la llamada: ${serverOffsetMs()}`);
  } finally { globalThis.fetch = fetchReal; }
  ok('CABLEADO: cada respuesta de PocketBase re-mide el desfase, sin que el llamador haga nada');
}

// ── 7. Se RE-MIDE (el móvil que suspende) ────────────────────────────────────
// Medir una vez al entrar no basta: una pantalla bloqueada media clase puede
// derivar. Muestras nuevas mandan sobre las viejas.
{
  resetServerClock(); congelar(AHORA);
  for (let i = 0; i < 5; i++) noteServerDate(new Date(AHORA).toUTCString(), { enviadoMs: AHORA, recibidoMs: AHORA });
  assert.ok(Math.abs(serverOffsetMs()) <= 1000, 'arranca en hora');
  for (let i = 0; i < 5; i++) noteServerDate(new Date(AHORA + 30_000).toUTCString(), { enviadoMs: AHORA, recibidoMs: AHORA });
  assert.ok(Math.abs(serverOffsetMs() - 30_000) <= 1000,
    `tras derivar, la hora común sigue al servidor: ${serverOffsetMs()}`);
  ok('el desfase se RE-MIDE: un aparato que deriva a mitad de partida se vuelve a poner en hora');
}

// Higiene entre suites: el desfase es estado de MÓDULO y `tests/run.mjs` corre
// todo en un mismo proceso — dejarlo a 30 s desplazaría el reloj de las suites
// siguientes (lo cazó `deadlineTicker`, que congela el tiempo).
resetServerClock();
clock.now = real;
console.log(`\n  ${passed} serverNow checks passed`);
