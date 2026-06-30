import { isCorrect } from '../../core/contentModels/qa.js';
import { basePoints, wrongPoints, useKahoot } from '../../core/scoreHelpers.js';

// Pure scoring. Same input shape used by client (SOLO) and Edge Function (LIVE).
// In SOLO we read activity.scoring.mode; in LIVE the Edge Function passes
// mode: 'live' which overrides to use activity.live.pointsModel.
export function scoreQuizSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const ok = isCorrect(item, value);
  if (ok === null) return { correct: null, points: 0 };
  const scoring = activity?.scoring || {};
  if (!ok) return { correct: false, points: wrongPoints(scoring) };
  const base = basePoints(item, scoring);
  if (useKahoot(mode, scoring, activity?.live)) {
    const live = activity?.live || {};
    const max = (live.questionTimer || 20) * 1000;
    const remain = Math.max(0, 1 - (msTaken || 0) / max);
    const points = Math.round(base * 500 + (live.speedBonusMax ?? 1000) * remain);
    return { correct: true, points };
  }
  return { correct: true, points: base };
}
