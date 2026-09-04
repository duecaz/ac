// Scorer PURO de Rompecabezas — contrato: SIEMPRE {correct, points, hits, total}.
// hits/total = MÉRITO: piezas encajadas / piezas totales. No hay clave que
// «acertar o fallar» pieza a pieza (nada de opción incorrecta): el mérito es
// terminar el rompecabezas, y `correct` es «todas encajadas».
import { basePoints } from '../../core/scoring/index.js';

export function scorePuzzleSubmission({ value, item, activity }) {
  const total = Math.max(1, value?.total || (item ? (item.filas || 1) * (item.columnas || 1) : 1));
  const hits = Math.max(0, Math.min(total, value?.encajadas ?? 0));
  const correct = hits >= total;
  // Puntos PLANOS: los de la actividad (100 por defecto) al terminar —todas
  // encajadas—, 0 si no: el juego no termina hasta encajarlas todas, así que
  // no hay premio por piezas a medias.
  const points = correct ? basePoints(item, activity?.scoring) : 0;
  return { correct, points, hits, total };
}
