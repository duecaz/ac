// Scorer PURO de Colorear — contrato: SIEMPRE {correct, points, hits, total}.
// No hay clave de respuesta, así que "acertar" no existe — el mérito es CUÁNTAS
// zonas se pintaron sobre el total del dibujo. Los puntos salen de la fórmula
// común (`basePoints`, core/scoring: `scoring.pointsPerCorrect`, 100 por
// defecto) repartidos por zona — `tests/scoringSources.test.mjs` no admite una
// escala propia sin documentar, y Colorear no la necesita.
//
import { basePoints } from '../../core/scoring/index.js';

/** Puntos por pintarlo TODO cuando la actividad no dice otra cosa. */
export const PUNTOS_TERMINAR = 100;

// `value = { pintadas, total }`: `pintadas` es el Nº de zonas distintas
// tocadas con algún color (el player las cuenta con un Set, así que repintar la
// misma zona no infla el número); `total` las zonas que trae el SVG del banco.
export function scoreColorearSubmission({ value, item, activity } = {}) {
  const v = value || {};
  const techo = basePoints(item, activity?.scoring ?? { pointsPerCorrect: PUNTOS_TERMINAR });
  const pintadas = Math.max(0, Number(v.pintadas) || 0);
  const total = Math.max(0, Number(v.total) || 0);
  // Contra-prueba: un dibujo sin zonas (fetch fallido, banco vacío) no puede
  // dividir por cero — sin zonas no hay nada que pintar, así que 0 puntos.
  const points = total > 0 ? Math.round(techo * Math.min(pintadas, total) / total) : 0;
  return { correct: pintadas >= 1, points, hits: Math.min(pintadas, total), total };
}
