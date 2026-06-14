// Result persistence. Goes through the selected backend adapter (DataPort /
// RemoteStore) — NOT Supabase directly — so results are captured on any backend
// (local, supabase, pocketbase) and survive offline. Fail-soft: a backend error
// never interrupts gameplay.
import { getRemoteStore } from '../adapters/index.js';

/** Puntuación incremental compartida para mecánicas acierto/fallo (Emparejar y
 *  Memoria en SOLO): suma pointsPerCorrect al acertar; al fallar resta
 *  pointsPerWrong (si es negativo) pero NUNCA baja de 0. El piso vive aquí, en un
 *  único sitio (antes estaba duplicado y causó marcadores negativos). */
export function applyPoints(score, scoring, correct) {
  const ppc = scoring?.pointsPerCorrect ?? 1;
  const ppw = scoring?.pointsPerWrong ?? 0;
  return correct ? score + ppc : Math.max(0, score + (ppw < 0 ? ppw : 0));
}

export async function saveResult(r) {
  try {
    const rs = await getRemoteStore();
    await rs.saveResult(r);
  } catch (e) {
    console.warn('[results] save failed:', e.message);
  }
}
