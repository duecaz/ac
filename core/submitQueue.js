// Offline-resilient submit queue for the student. If submitAnswer fails
// (network), enqueue and flush on online or on next attempt. Persisted in
// localStorage so a refresh during a flaky moment still recovers.
//
// The race-safe flush/enqueue logic lives in core/offlineQueue.js; here we just
// wire it to localStorage (quota-aware via lsSet) and the live transport. Items
// are identified by sessionId:playerId:itemIndex — exactly one answer per item
// per player, so this both de-dupes resends and survives concurrent flushes.
import { submitAnswer as transportSubmit } from './liveTransport.js';
import { clock } from './clock.js';
import { colaDeEntrega } from './offlineQueue.js';
const KEY = 'ww.submitQueue';

/**
 * UNA respuesta pendiente de entregar. Lo que se guardó en el almacén es
 * FRONTERA: se vuelve a leer estrechando (`esEnvio`), así una entrada a medias de
 * una versión anterior no tumba el reenvío.
 * @typedef {Object} EnvioPendiente
 * @property {string} sessionId
 * @property {string} playerId
 * @property {number} itemIndex
 * @property {unknown} value
 * @property {number} [msTaken]
 * @property {number} [ts]
 */

/** @param {unknown} x @returns {x is EnvioPendiente} */
const esEnvio = (x) => !!x && typeof x === 'object'
  && 'sessionId' in x && 'playerId' in x && 'itemIndex' in x;

const queue = colaDeEntrega({
  clave: KEY,
  send: (/** @type {EnvioPendiente} */ it) => transportSubmit(it.sessionId, it.playerId, it.itemIndex, it.value, it.msTaken),
  idOf: (it) => `${it.sessionId}:${it.playerId}:${it.itemIndex}`,
  esItem: esEnvio,
});

/**
 * @param {string} sessionId @param {string} playerId @param {number} itemIndex
 * @param {unknown} value @param {number} [msTaken]
 * @returns {Promise<import('./offlineQueue.js').Entrega>}
 */
export function submit(sessionId, playerId, itemIndex, value, msTaken) {
  // Intento directo, cola si no hay red y RECHAZO si el servidor dice 403: las
  // tres las decide `colaDeEntrega` (core/offlineQueue.js), igual que en la
  // cola de intentos de tarea — la regla del 403 estaba escrita en las dos.
  return queue.entregar({ sessionId, playerId, itemIndex, value, msTaken, ts: clock.now() });
}


export const flush = () => queue.flush();

// El flush al volver la red lo cablea la factory (core/offlineQueue.js), una vez.
