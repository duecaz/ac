// ÚNICO scorer de Memoria. Era la única plantilla SIN `scoreSubmission`: su
// player puntuaba por un camino paralelo (`applyPoints`) que `core/scoring` no
// conocía. ítem = par; value = el par con el que se intentó casar → acierto si
// coinciden. Los PUNTOS (y la penalización por fallo) salen de awardPoints, la
// fórmula común. Puro.
import { awardPoints } from '../../core/scoring/index.js';

/**
 * @param {import('../../kernel/contracts/session.js').ScoreInput} input
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scoreMemorySubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  // `item` es FRONTERA en el contrato (cada plantilla tiene el suyo): se
  // estrecha por forma, que aquí es el par con su `id`.
  const par = item && typeof item === 'object' ? /** @type {{id?: unknown}} */ (item) : null;
  const correct = !!par?.id && String(value) === String(par.id);
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
