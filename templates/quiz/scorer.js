import { isCorrect } from '../../core/contentModels/qa.js';

// Pure scoring. Same input shape used by client (immediate feedback in SOLO)
// and Edge Function (LIVE). Keep semantics identical to settle-item _scorers/quiz.ts.
export function scoreQuizSubmission({ value, item, msTaken, activity }) {
  const ok = isCorrect(item, value);
  if (ok === null) return { correct: null, points: 0 };
  const live = activity?.live || {};
  const scoring = activity?.scoring || {};
  if (!ok) {
    const ppw = scoring.pointsPerWrong ?? 0;
    return { correct: false, points: ppw < 0 ? ppw : 0 };
  }
  const base = item.points || scoring.pointsPerCorrect || 1;
  if (live.pointsModel === 'kahoot') {
    const max = (live.questionTimer || 20) * 1000;
    const remain = Math.max(0, 1 - (msTaken || 0) / max);
    const points = Math.round(base * 500 + (live.speedBonusMax ?? 1000) * remain);
    return { correct: true, points };
  }
  return { correct: true, points: base };
}
