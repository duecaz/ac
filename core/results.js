// Result persistence. Goes through the selected backend adapter (DataPort /
// RemoteStore) — NOT Supabase directly — so results are captured on any backend
// (local, supabase, pocketbase) and survive offline. Fail-soft: a backend error
// never interrupts gameplay.
import { getRemoteStore } from '../adapters/index.js';
import { clock } from './clock.js';

const QUEUE_KEY = 'ww.resultQueue';
const QUEUE_MAX = 60;

function qLoad() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
function qSave(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX))); } catch {} }

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
  flushResultQueue().catch(() => {});
  try {
    const rs = await getRemoteStore();
    await rs.saveResult(r);
  } catch (e) {
    console.warn('[results] save failed — queuing for retry:', e.message);
    const q = qLoad();
    q.push({ ...r, _queuedAt: clock.now() });
    qSave(q);
  }
}

async function flushResultQueue() {
  const q = qLoad();
  if (!q.length) return;
  const rs = await getRemoteStore();
  const remaining = [];
  for (const item of q) {
    try {
      await rs.saveResult(item);
    } catch {
      remaining.push(item);
    }
  }
  qSave(remaining);
}

// Retry when the browser comes back online. Guarded so importing this module
// in Node (tests) doesn't throw on the missing `window` global.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushResultQueue().catch(() => {}); });
}
