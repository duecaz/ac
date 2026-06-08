// Numeric scorer for the Operaciones template. Same shape as the other scorers.
function normNum(s) { return String(s ?? '').trim().replace(',', '.'); }

export function scoreMathSubmission({ value, item, activity }) {
  if (item.answer == null || item.answer === '') return { correct: null, points: 0 };
  const v = normNum(value), a = normNum(item.answer);
  const scoring = activity?.scoring || {};
  const ok = v !== '' && !Number.isNaN(Number(v)) && Number(v) === Number(a);
  if (!ok) { const ppw = scoring.pointsPerWrong ?? 0; return { correct: false, points: ppw < 0 ? ppw : 0 }; }
  return { correct: true, points: item.points || scoring.pointsPerCorrect || 1 };
}
