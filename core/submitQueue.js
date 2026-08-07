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

const queue = createOfflineQueue({
  load: () => lsGetJsonArray(KEY),
  save: (q) => lsSet(KEY, JSON.stringify(q)),
  send: (it) => transportSubmit(it.sessionId, it.playerId, it.itemIndex, it.value, it.msTaken),
  idOf: (it) => `${it.sessionId}:${it.playerId}:${it.itemIndex}`,
});

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
    if (e?.status === 403) return { queued: false, rejected: true, error: e.message };
    queue.enqueue({ sessionId, playerId, itemIndex, value, msTaken, ts: clock.now(), err: e.message });
    return { queued: true, error: e.message };
  }
}

export const flush = () => queue.flush();
export const pendingCount = () => queue.pending();

// El flush al volver la red lo cablea la factory (core/offlineQueue.js), una vez.
