// ÚNICO scorer del diagrama: lo usa el player Individual (una llamada por
// etiqueta enlazada) y queda listo para los modos de sesión. Cada etiqueta bien
// enlazada a SU pin vale sus puntos; ítem = pin. Los PUNTOS salen de la fórmula
// común awardPoints. Puro.
import { awardPoints } from '../../core/scoring/index.js';

export function scoreDiagramSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const correct = String(value) === String(item?.id ?? '');
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
