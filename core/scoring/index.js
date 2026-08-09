// Punto único de importación del sistema de puntuación. Mapa completo y plan en
// docs/historico/handoff-puntuacion.md. Regla de reparto: la PLANTILLA decide el MÉRITO
// (hits/total); award.js decide los PUNTOS; los PARÁMETROS viven en la actividad.
export { basePoints, wrongPoints, useKahoot, awardPoints, defaultMaxScore } from './award.js';
export { scoreMarks, scoreMarksPerHit } from './marks.js';
