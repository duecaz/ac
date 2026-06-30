// Numeric scorer for the Operaciones template. Same shape as the other scorers.
import { basePoints, wrongPoints } from '../../core/scoreHelpers.js';

function normNum(s) { return String(s ?? '').trim().replace(',', '.'); }

export function scoreMathSubmission({ value, item, activity }) {
  if (item.answer == null || item.answer === '') return { correct: null, points: 0 };
  const v = normNum(value), a = normNum(item.answer);
  const scoring = activity?.scoring || {};
  const ok = v !== '' && !Number.isNaN(Number(v)) && Number(v) === Number(a);
  if (!ok) return { correct: false, points: wrongPoints(scoring) };
  return { correct: true, points: basePoints(item, scoring) };
}
