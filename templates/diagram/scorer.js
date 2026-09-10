// ÚNICO scorer del diagrama: lo usa el player Individual (una llamada por
// etiqueta enlazada) y queda listo para los modos de sesión. Cada etiqueta bien
// enlazada a SU pin vale sus puntos; ítem = pin. Los PUNTOS salen de la fórmula
// común awardPoints. Puro.
import { awardPoints } from '../../core/scoring/index.js';

/**
 * @param {import('../../kernel/contracts/session.js').ScoreInput} input
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scoreDiagramSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const pin = /** @type {{id?: string}|null} */ (item && typeof item === 'object' ? item : null);
  const correct = String(value) === String(pin?.id ?? '');
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
