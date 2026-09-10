import { isCorrect } from '../../core/contentModels/qa.js';
import { awardPoints } from '../../core/scoring/index.js';

// Pure scoring. Same input shape used by client (SOLO) and Edge Function (LIVE).
// In SOLO we read activity.scoring.mode; in LIVE the caller passes mode: 'live'
// which switches to activity.live.pointsModel. El MÉRITO (hits/total) es binario:
// 1/1 ó 0/1 (total 0 = ítem sin clave → no puntuable). Los PUNTOS los pone la
// fórmula común awardPoints (flat | velocidad) — sin copia local del bonus.
/**
 * @param {import('../../kernel/contracts/session.js').ScoreInput} input
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scoreQuizSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  // `item` viaja como `unknown` en el contrato (solo quien puntúa lo tiene
  // completo): aquí ya se sabe que es un ítem `qa`, y sin ítem no hay clave.
  if (!item || typeof item !== 'object') return { correct: null, points: 0, hits: 0, total: 0 };
  const ok = isCorrect(/** @type {import('../../kernel/contracts/activity.js').QaItem} */ (item), value);
  if (ok === null) return { correct: null, points: 0, hits: 0, total: 0 };
  const points = awardPoints({ correct: ok, item, msTaken, activity, mode });
  return { correct: ok, points, hits: ok ? 1 : 0, total: 1 };
}
