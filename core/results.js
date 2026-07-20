// Result persistence. Goes through the selected backend adapter (DataPort /
// RemoteStore) — NOT Supabase directly — so results are captured on any backend
// (local, supabase, pocketbase) and survive offline. Fail-soft: a backend error
// never interrupts gameplay.
import { getRemoteStore } from '../adapters/index.js';
import { clock } from './clock.js';
import { lsGet, lsSet } from './ls.js';
import { createOfflineQueue } from './offlineQueue.js';

const QUEUE_KEY = 'ww.resultQueue';
// Tope de la cola offline de resultados. Subido de 60 → 200 (P1-7): en un
// dispositivo de aula compartido usado sin red, varios alumnos jugando en
// secuencia superaban 60 y se DESCARTABAN los primeros en SILENCIO antes del
// flush. Con 200 hay margen holgado, y si aun así se recorta, se AVISA.
const QUEUE_MAX = 200;

let _qseq = 0;
const qid = () => `${clock.now().toString(36)}-${(_qseq = (_qseq + 1) % 1e6).toString(36)}`;

// Quota-aware write. Solo recorta si de verdad se supera el tope, y entonces
// emite `ww:results-dropped` para que la UI avise en vez de tragarse la pérdida.
function qSave(q) {
  if (q.length > QUEUE_MAX) {
    const dropped = q.length - QUEUE_MAX;
    console.warn(`[results] cola de resultados llena: se descartan ${dropped} resultado(s) más antiguo(s)`);
    try { window.dispatchEvent(new CustomEvent('ww:results-dropped', { detail: { dropped } })); } catch { /* sin DOM */ }
    q = q.slice(-QUEUE_MAX);
  }
  lsSet(QUEUE_KEY, JSON.stringify(q));
}

// Loads the queue, backfilling a stable _qid on any legacy items (queued before
// _qid existed) and persisting it, so removal-by-id is reliable across flushes.
function qLoad() {
  let arr;
  try {
    const v = JSON.parse(lsGet(QUEUE_KEY) || '[]');
    arr = Array.isArray(v) ? v : [];
  } catch { arr = []; }
  let changed = false;
  arr = arr.map(it => (it._qid ? it : (changed = true, { ...it, _qid: qid() })));
  if (changed) qSave(arr);
  return arr;
}

const queue = createOfflineQueue({
  load: qLoad,
  save: qSave,
  send: async (it) => { const rs = await getRemoteStore(); return rs.saveResult(it); },
  idOf: (it) => it._qid,
});

/** Puntuación incremental compartida para mecánicas acierto/fallo (Emparejar y
 *  Memoria en SOLO): suma pointsPerCorrect al acertar; al fallar resta
 *  pointsPerWrong (si es negativo) pero NUNCA baja de 0. El piso vive aquí, en un
 *  único sitio (antes estaba duplicado y causó marcadores negativos). */
export function applyPoints(score, scoring, correct) {
  const ppc = scoring?.pointsPerCorrect ?? 1;
  const ppw = scoring?.pointsPerWrong ?? 0;
  return correct ? score + ppc : Math.max(0, score + (ppw < 0 ? ppw : 0));
}

/** Guarda el resultado salvo en modo TAREA (async-tracked), donde el contenedor
 *  de la tarea registra su propio intento. Evita repetir el gateo en cada player. */
export function trySaveResult(opts, payload) {
  if (opts?.mode !== 'async-tracked') saveResult(payload);
}

export async function saveResult(r) {
  // Try to flush any pending queued results first (piggyback on active connection).
  queue.flush().catch(() => {});
  try {
    const rs = await getRemoteStore();
    await rs.saveResult(r);
  } catch (e) {
    console.warn('[results] save failed — queuing for retry:', e.message);
    queue.enqueue({ ...r, _qid: qid(), _queuedAt: clock.now() });
  }
}

// Retry when the browser comes back online. Guarded so importing this module
// in Node (tests) doesn't throw on the missing `window` global.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { queue.flush().catch(() => {}); });
}
