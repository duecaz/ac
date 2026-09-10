// Per-pair matching score for the session formats (VS / Equipos-auto): each
// pair becomes a "what matches X?" round; correct iff the chosen value equals
// the pair's right side. Pure.
// ÚNICO scorer de Emparejar: lo usan el player Individual (una llamada por
// cuerda) y los modos de sesión (VS / Equipos-auto). Los PUNTOS salen de la
// fórmula común awardPoints — nada de fórmulas locales.
import { awardPoints } from '../../core/scoring/index.js';

/**
 * @param {import('../../kernel/contracts/session.js').ScoreInput} input
 * @returns {import('../../kernel/contracts/session.js').ScoreResult}
 */
export function scoreMatchSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  // `item` es FRONTERA en el contrato (cada plantilla tiene el suyo): se
  // estrecha por forma, que aquí es el par con sus dos lados.
  const par = item && typeof item === 'object' ? /** @type {{right?: unknown}} */ (item) : null;
  const correct = String(value) === String(par?.right ?? '');
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
