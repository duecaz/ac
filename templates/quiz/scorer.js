import { isCorrect } from '../../core/contentModels/qa.js';
import { awardPoints } from '../../core/scoring/index.js';

// Pure scoring. Same input shape used by client (SOLO) and Edge Function (LIVE).
// In SOLO we read activity.scoring.mode; in LIVE the caller passes mode: 'live'
// which switches to activity.live.pointsModel. El MÉRITO (hits/total) es binario:
// 1/1 ó 0/1 (total 0 = ítem sin clave → no puntuable). Los PUNTOS los pone la
// fórmula común awardPoints (flat | kahoot) — sin copia local del bonus.
export function scoreQuizSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const ok = isCorrect(item, value);
  if (ok === null) return { correct: null, points: 0, hits: 0, total: 0 };
  const points = awardPoints({ correct: ok, item, msTaken, activity, mode });
  return { correct: ok, points, hits: ok ? 1 : 0, total: 1 };
}
