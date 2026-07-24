// Numeric scorer for the Operaciones template. Same shape as the other scorers.
// Mérito binario (hits/total; total 0 = sin clave de respuesta → no puntuable).
// Puntos PLANOS a propósito (sin bonus de velocidad): pasarlo por el dispatch
// kahoot de awardPoints cambiaría puntajes existentes → eso es la fase P5 del
// handoff de puntuación, no esta.
import { basePoints, wrongPoints } from '../../core/scoring/index.js';

function normNum(s) { return String(s ?? '').trim().replace(',', '.'); }

export function scoreMathSubmission({ value, item, activity }) {
  if (item.answer == null || item.answer === '') return { correct: null, points: 0, hits: 0, total: 0 };
  const v = normNum(value), a = normNum(item.answer);
  const scoring = activity?.scoring || {};
  const ok = v !== '' && !Number.isNaN(Number(v)) && Number(v) === Number(a);
  if (!ok) return { correct: false, points: wrongPoints(scoring), hits: 0, total: 1 };
  return { correct: true, points: basePoints(item, scoring), hits: 1, total: 1 };
}
