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
import { lsSet, lsGetJsonArray } from './ls.js';
import { createOfflineQueue } from './offlineQueue.js';

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
 * @property {string} [err]
 */

/** @param {unknown} x @returns {x is EnvioPendiente} */
const esEnvio = (x) => !!x && typeof x === 'object'
  && 'sessionId' in x && 'playerId' in x && 'itemIndex' in x;

const queue = createOfflineQueue({
  load: () => lsGetJsonArray(KEY).filter(esEnvio),
  save: (q) => lsSet(KEY, JSON.stringify(q)),
  send: (it) => transportSubmit(it.sessionId, it.playerId, it.itemIndex, it.value, it.msTaken),
  idOf: (it) => `${it.sessionId}:${it.playerId}:${it.itemIndex}`,
});

/**
 * @param {string} sessionId @param {string} playerId @param {number} itemIndex
 * @param {unknown} value @param {number} [msTaken]
 * @returns {Promise<{queued: boolean, rejected?: boolean, error?: string}>}
 */
export async function submit(sessionId, playerId, itemIndex, value, msTaken) {
  // Try direct first.
  try {
    await transportSubmit(sessionId, playerId, itemIndex, value, msTaken);
    return { queued: false };
  } catch (e) {
    // 403 = el SERVIDOR la rechazó (§22-4: sin la credencial del dispositivo, o
    // fuera de fase). Eso no lo arregla reintentar: encolarlo dejaría al alumno
    // con un "se enviará al reconectar" que nunca ocurre. Se devuelve RECHAZADA
    // para que la vista lo diga y el alumno pueda volver a entrar.
    if (estadoDe(e) === 403) return { queued: false, rejected: true, error: motivo(e) };
    queue.enqueue({ sessionId, playerId, itemIndex, value, msTaken, ts: clock.now(), err: motivo(e) });
    return { queued: true, error: motivo(e) };
  }
}

/** El código HTTP que traiga el fallo del transporte, si lo trae. La forma del
 *  error es frontera: viene de `fetch`/PocketBase, no de aquí.
 *  @param {unknown} e @returns {number|null} */
const estadoDe = (e) => (e && typeof e === 'object' && 'status' in e ? Number(e.status) : null);
/** @param {unknown} e @returns {string} */
const motivo = (e) => (e instanceof Error ? e.message : String(e));

export const flush = () => queue.flush();

// El flush al volver la red lo cablea la factory (core/offlineQueue.js), una vez.
