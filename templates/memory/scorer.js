// ÚNICO scorer de Memoria. Era la única plantilla SIN `scoreSubmission`: su
// player puntuaba por un camino paralelo (`applyPoints`) que `core/scoring` no
// conocía. ítem = par; value = el par con el que se intentó casar → acierto si
// coinciden. Los PUNTOS (y la penalización por fallo) salen de awardPoints, la
// fórmula común. Puro.
import { awardPoints } from '../../core/scoring/index.js';

export function scoreMemorySubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const correct = !!item?.id && String(value) === String(item.id);
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
