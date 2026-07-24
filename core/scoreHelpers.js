// MOVIDO a core/scoring/award.js (fase P1 de docs/handoff-puntuacion.md). Esta
// ruta queda como re-export de compatibilidad; el código nuevo importa de
// core/scoring/index.js.
export { basePoints, wrongPoints, useKahoot } from './scoring/award.js';
