// RealtimePort — el puerto del modo EN VIVO (sala dirigida), independiente del
// backend concreto. Lo implementan `adapters/pocketbase/realtime.js` (prod) y
// `adapters/local/realtime.js` (dev/offline).
//
// Las vistas nunca importan un backend: hablan con la fachada
// `core/liveTransport.js`, que resuelve el puerto activo vía
// `adapters/index.js getRealtime()`.
//
// ⚠️ DÓNDE ESTÁ EL CONTRATO DE VERDAD: en `core/liveTransport.js`. Aquí había
// una lista de 9 métodos escrita a mano frente a los 26 que la fachada llama —
// y ya mentía: declaraba un `joinRoom` que NO EXISTE en ningún sitio del repo
// (los adaptadores implementan `joinSession`) y una `startSession(id, patch)`
// que en realidad toma un solo argumento. Un JSDoc que documenta una API
// inexistente es peor que no tenerlo: el próximo que escriba un adaptador
// implementa el método fantasma (auditoría v1.51.410).
//
// La lista se retiró en vez de re-escribirla porque no había forma de impedir
// que volviera a divergir. La paridad adaptador↔fachada la vigila ahora
// `tests/realtimePort.test.mjs`, que la DERIVA de las llamadas reales de
// `liveTransport.js` — y la fachada, además, falla con un mensaje legible
// (`realtime backend no soporta "X"`) si a un adaptador le falta un método.

/**
 * El evento que llega por `subscribeRoom`. Esto SÍ vive aquí: es la forma que
 * los dos adaptadores tienen que producir y ninguna función la declara.
 * @typedef {Object} RoomChange
 * @property {'sessions'|'players'|'answers'} table
 * @property {string} eventType  'INSERT' | 'UPDATE' | 'DELETE'
 * @property {Object} [new]
 * @property {Object} [old]
 */

export {};
