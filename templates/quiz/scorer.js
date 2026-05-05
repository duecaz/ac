import { isCorrect } from '../../core/contentModels/qa.js';

// Pure scoring. Same input shape used by client (SOLO) and Edge Function (LIVE).
// In SOLO we read activity.scoring.mode; in LIVE the Edge Function passes
// mode: 'live' which overrides to use activity.live.pointsModel.
export function scoreQuizSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const ok = isCorrect(item, value);
  if (ok === null) return { correct: null, points: 0 };
  const scoring = activity?.scoring || {};
  if (!ok) {
    const ppw = scoring.pointsPerWrong ?? 0;
    return { correct: false, points: ppw < 0 ? ppw : 0 };
  }
  const base = item.points || scoring.pointsPerCorrect || 1;
  // Kahoot-style only when explicitly in live mode AND live.pointsModel='kahoot',
  // OR when in solo and scoring.mode='kahoot' (advanced scoring).
  const useKahoot = (mode === 'live' && activity?.live?.pointsModel === 'kahoot')
                 || (mode === 'solo' && scoring.mode === 'kahoot');
  if (useKahoot) {
    const live = activity?.live || {};
    const max = (live.questionTimer || 20) * 1000;
    const remain = Math.max(0, 1 - (msTaken || 0) / max);
    const points = Math.round(base * 500 + (live.speedBonusMax ?? 1000) * remain);
    return { correct: true, points };
  }
  return { correct: true, points: base };
}
