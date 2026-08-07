// PARIDAD DEL PUERTO EN VIVO — los dos adaptadores implementan lo que la
// fachada llama, DERIVADO de las llamadas reales.
//
// `core/liveTransport.js` es el contrato de facto: cada método suyo hace
// `call('nombre', …)` sobre el adaptador activo. El contrato ESCRITO vivía en
// `kernel/contracts/realtimePort.js` como un JSDoc a mano de 9 métodos frente a
// los 26 reales — y ya mentía (declaraba un `joinRoom` inexistente). Se retiró
// la lista y se puso este test en su lugar: la lista se calcula, no se escribe.
//
// Por qué importa de verdad: si al driver LOCAL le falta un método que el de
// PocketBase sí tiene, el desarrollo en local "funciona" hasta que alguien
// prueba esa pantalla; si le falta al de PocketBase, se rompe EN CLASE. La
// fachada avisa en tiempo de ejecución («realtime backend no soporta "X"»),
// pero eso ya es con el profe delante.
//
// Run: node tests/realtimePort.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPocketbaseRealtime } from '../adapters/pocketbase/realtime.js';
import { createLocalRealtime } from '../adapters/local/realtime.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Lo que la fachada PIDE, leído de sus propias llamadas.
const fachada = readFileSync(join(ROOT, 'core/liveTransport.js'), 'utf8');
const PEDIDOS = [...new Set([...fachada.matchAll(/call\('([a-zA-Z]+)'/g)].map(m => m[1]))];

// ── 1. La lista no es decorativa: son bastantes y salen del código ─────────
{
  assert.ok(PEDIDOS.length >= 20, `solo se leyeron ${PEDIDOS.length} métodos de la fachada: el parser no está mirando bien`);
  ok(`la fachada pide ${PEDIDOS.length} métodos (derivados de sus llamadas, no de una lista)`);
}

// ── 2. Los DOS adaptadores los implementan todos ──────────────────────────
{
  const pb = createPocketbaseRealtime({ userId: 'u1' });
  const local = createLocalRealtime ? createLocalRealtime({ userId: 'u1' }) : null;
  assert.ok(local, 'el driver local debe exponer su factory');
  const faltanPb = PEDIDOS.filter(m => typeof pb[m] !== 'function');
  const faltanLocal = PEDIDOS.filter(m => typeof local[m] !== 'function');
  assert.deepStrictEqual(faltanPb, [], `al adaptador PocketBase le faltan: ${faltanPb.join(' · ')}`);
  assert.deepStrictEqual(faltanLocal, [], `al driver local le faltan: ${faltanLocal.join(' · ')} — en dev "funciona" hasta que alguien abre esa pantalla`);
  ok('los dos adaptadores (PocketBase y local) implementan los métodos que la fachada llama');
}

// ── 3. El typedef no puede volver a inventarse métodos ────────────────────
// Lo que tumbó al anterior: declaraba `joinRoom`, que no existe en el repo.
// Vive ahora EN la propia fachada (v1.51.415): el archivo aparte
// `kernel/contracts/realtimePort.js` no lo importaba nadie — un contrato que
// nadie lee es exactamente el que se queda desfasado sin que se note.
{
  // Solo las líneas `@property {(…) => …} nombre`, que es como se declaraba un
  // MÉTODO del puerto (no las del typedef RoomChange, que son campos).
  const declarados = [...fachada.matchAll(/@property \{\([^}]*=>[^}]*\}\s+([a-zA-Z]+)/g)].map(m => m[1]);
  const inventados = declarados.filter(m => !PEDIDOS.includes(m));
  assert.deepStrictEqual(inventados, [],
    `el typedef declara métodos que la fachada no llama: ${inventados.join(' · ')}`);
  assert.match(fachada, /@typedef \{Object\} RoomChange/,
    'la fachada debe declarar la FORMA del evento de suscripción, que ninguna función produce por sí sola');
  ok('el contrato vive junto al código que lo cumple, y no declara métodos fantasma');
}

// ── 4. CONTRA-PRUEBA: si a un adaptador le faltara uno, se vería ───────────
{
  const falso = { createRoom() {} };
  const faltarían = PEDIDOS.filter(m => typeof falso[m] !== 'function');
  assert.ok(faltarían.length >= PEDIDOS.length - 1, 'el cruce detecta de verdad los métodos ausentes');
  assert.ok(faltarían.includes('subscribeRoom'), 'y nombra el que falta');
  ok('CONTRA-PRUEBA: un adaptador incompleto sería cazado con el método por su nombre');
}

console.log(`\n  ${passed} realtimePort checks passed`);
