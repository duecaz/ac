// Scorer PURO de Tangram — contrato: SIEMPRE {correct, points, hits, total}.
// Sin reloj, sin fallo posible (§ enunciado): la partida solo tiene UN
// desenlace posible que se puntúe — resuelta — así que hits/total son
// siempre 7/7 y los puntos son PLANOS (100), nunca proporcionales a lo que
// falte por colocar (no hay «casi resuelto» que puntúe: o cubre la silueta
// dentro del margen del imán, o sigue jugando).
import { basePoints } from '../../core/scoring/index.js';

/** Puntos por resolver cuando la actividad no dice otra cosa (core/scoring
 *  los lee de `scoring.pointsPerCorrect`). */
export const PUNTOS_RESOLVER = 100;
export const PIEZAS_TOTAL = 7;

/**
 * Lo que afirma el tablero al soltar la última pieza. `resuelto` lo decide
 * `estaResuelto()` (game/mascara.js); `colocadas` es informativo (cuántas hay
 * en el tablero). Llega como `unknown` en `ScoreInput` (cada plantilla tiene su
 * forma), así que se estrecha aquí.
 * @typedef {Object} ValorTangram
 * @property {boolean} [resuelto]
 * @property {number} [colocadas]
 */

/**
 * @param {Partial<import('../../kernel/contracts/session.js').ScoreInput>} [o]
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scoreTangramSubmission({ value, item, activity } = {}) {
  const v = /** @type {ValorTangram} */ (value && typeof value === 'object' ? value : {});
  const resuelto = !!v.resuelto;
  const puntos = basePoints(item, activity?.scoring ?? { pointsPerCorrect: PUNTOS_RESOLVER });
  if (!resuelto) return { correct: false, points: 0, hits: 0, total: PIEZAS_TOTAL };
  return { correct: true, points: puntos, hits: PIEZAS_TOTAL, total: PIEZAS_TOTAL };
}
