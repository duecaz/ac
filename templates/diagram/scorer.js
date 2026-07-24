// Scoring del diagrama (por si en el futuro se juega en sesión). Cada etiqueta
// bien enlazada a SU pin vale sus puntos; ítem = pin. Puro.
import { basePoints } from '../../core/scoring/index.js';

export function scoreDiagramSubmission({ value, item, activity }) {
  const correct = String(value) === String(item?.id ?? '');
  const scoring = activity?.scoring || {};
  return { correct, points: correct ? basePoints(item, scoring) : 0, hits: correct ? 1 : 0, total: 1 };
}
