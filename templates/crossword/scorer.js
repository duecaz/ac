// ÚNICO scorer del Crucigrama. Antes vivía como STUB dentro de template.js y el
// player llevaba SU PROPIA aritmética (`solvedIds.size * ppc`): dos verdades para
// la misma pregunta. Ahora hay una — la usa el player Individual (una llamada por
// palabra resuelta) y queda lista para el día en que sume `renderRound`.
// ítem = palabra; value = lo escrito. Los PUNTOS salen de awardPoints. Puro.
import { awardPoints } from '../../core/scoring/index.js';

/** @param {unknown} s @returns {string} */
const norm = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, '');

/** La clave de la palabra, leída sin suponer la forma del ítem (`unknown` en el
 *  contrato): la ficha del crucigrama la llama `word`, una convertida `answer`.
 * @param {unknown} item
 * @returns {unknown}
 */
function claveDe(item) {
  if (!item || typeof item !== 'object') return null;
  if ('word' in item && item.word != null) return item.word;
  return ('answer' in item) ? item.answer : null;
}

/**
 * @param {import('../../kernel/contracts/session.js').ScoreInput} input
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scoreCrosswordSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const want = norm(claveDe(item));
  const correct = !!want && norm(value) === want;
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
