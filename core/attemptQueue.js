// Cola offline de INTENTOS DE TAREA (deuda D, cerrada en R1).
//
// El intento de una tarea es el trabajo COMPLETO de un alumno: si la red parpadea
// justo al terminar, antes se perdía (la vista solo avisaba). Ahora se encola en
// localStorage y se reenvía al volver la conexión — el mismo patrón, y la misma
// factory race-safe, que ya protege las respuestas en vivo (core/submitQueue.js)
// y los resultados (core/results.js).
//
// Idempotencia: el `qid` nace AQUÍ, antes del primer envío, y viaja con el
// intento en cada reintento. En el servidor, el índice único parcial sobre `qid`
// (y la comprobación del adaptador) convierten un reintento tras ACK perdido en
// no-op — sin qid, ese reintento recontaba y entraba como attempt_no+1: fila
// duplicada Y un intento del alumno gastado en falso.
//
// 403 = veredicto del servidor (tope agotado / tarea cerrada, §22-3): NO se
// encola — reintentar no lo arregla y "se enviará al reconectar" sería mentira.
import { recordAttempt as transportRecord } from './assignmentsTransport.js';
import { createOfflineQueue } from './offlineQueue.js';
import { lsGet, lsSet } from './ls.js';
import { clock } from './clock.js';
import { rid } from './ids.js';

const KEY = 'ww.attemptQueue';

function load() {
  try {
    const v = JSON.parse(lsGet(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

const send = (it) => transportRecord(
  it.assignmentId, it.activityId, it.playerName,
  it.score, it.maxScore, it.timeUsed, it.answers, it.qid
);

const queue = createOfflineQueue({
  load,
  save: (q) => lsSet(KEY, JSON.stringify(q)),
  send,
  idOf: (it) => it.qid,
});

/**
 * Entrega un intento de tarea, con cola offline y reintento idempotente.
 * @returns {{queued:boolean, rejected?:boolean, error?:string}}
 *   queued=false → entregado · queued=true → guardado sin red, se reenviará ·
 *   rejected=true → el SERVIDOR lo rechazó (tope/cerrada): no se reintenta.
 */
export async function submitAttempt({ assignmentId, activityId, playerName, score, maxScore, timeUsed, answers = [] }) {
  queue.flush().catch(() => {});   // piggyback: si hay pendientes y ya hay red, van ahora
  const item = { assignmentId, activityId, playerName, score, maxScore, timeUsed, answers,
    qid: rid('at_'), ts: clock.now() };
  try {
    await send(item);
    return { queued: false };
  } catch (e) {
    if (e?.status === 403) return { queued: false, rejected: true, error: e.message };
    queue.enqueue(item);
    return { queued: true, error: e.message };
  }
}

export const flushAttempts = () => queue.flush();
export const pendingAttempts = () => queue.pending();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { queue.flush().catch(() => {}); });
}
