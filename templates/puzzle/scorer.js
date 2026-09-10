// Scorer PURO de Rompecabezas — contrato: SIEMPRE {correct, points, hits, total}.
// hits/total = MÉRITO: piezas encajadas / piezas totales. No hay clave que
// «acertar o fallar» pieza a pieza (nada de opción incorrecta): el mérito es
// terminar el rompecabezas, y `correct` es «todas encajadas».
import { basePoints } from '../../core/scoring/index.js';

/**
 * Lo que afirma el tablero: cuántas piezas van encajadas de cuántas. Llega como
 * `unknown` (cada plantilla tiene su forma de `value`), así que se estrecha aquí.
 * @typedef {Object} ValorPuzzle
 * @property {number} [encajadas]
 * @property {number} [total]
 */
/**
 * @param {import('../../kernel/contracts/session.js').ScoreInput} o
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scorePuzzleSubmission({ value, item, activity }) {
  const v = /** @type {ValorPuzzle} */ (value && typeof value === 'object' ? value : {});
  const it = /** @type {{filas?: number, columnas?: number}} */ (item && typeof item === 'object' ? item : {});
  const total = Math.max(1, v.total || (item ? (it.filas || 1) * (it.columnas || 1) : 1));
  const hits = Math.max(0, Math.min(total, v.encajadas ?? 0));
  const correct = hits >= total;
  // Puntos PLANOS: los de la actividad (100 por defecto) al terminar —todas
  // encajadas—, 0 si no: el juego no termina hasta encajarlas todas, así que
  // no hay premio por piezas a medias.
  const points = correct ? basePoints(item, activity?.scoring) : 0;
  return { correct, points, hits, total };
}
