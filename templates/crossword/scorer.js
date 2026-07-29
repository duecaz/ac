// ÚNICO scorer del Crucigrama. Antes vivía como STUB dentro de template.js y el
// player llevaba SU PROPIA aritmética (`solvedIds.size * ppc`): dos verdades para
// la misma pregunta. Ahora hay una — la usa el player Individual (una llamada por
// palabra resuelta) y queda lista para el día en que sume `renderRound`.
// ítem = palabra; value = lo escrito. Los PUNTOS salen de awardPoints. Puro.
import { awardPoints } from '../../core/scoring/index.js';

const norm = (s) => String(s ?? '').toUpperCase().replace(/\s+/g, '');

export function scoreCrosswordSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const want = norm(item?.word ?? item?.answer);
  const correct = !!want && norm(value) === want;
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
