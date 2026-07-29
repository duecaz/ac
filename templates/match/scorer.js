// Per-pair matching score for the session formats (VS / Equipos-auto): each
// pair becomes a "what matches X?" round; correct iff the chosen value equals
// the pair's right side. Pure.
// ÚNICO scorer de Emparejar: lo usan el player Individual (una llamada por
// cuerda) y los modos de sesión (VS / Equipos-auto). Los PUNTOS salen de la
// fórmula común awardPoints — nada de fórmulas locales.
import { awardPoints } from '../../core/scoring/index.js';

export function scoreMatchSubmission({ value, item, msTaken, activity, mode = 'solo' }) {
  const correct = String(value) === String(item?.right ?? '');
  return { correct, points: awardPoints({ correct, item, msTaken, activity, mode }), hits: correct ? 1 : 0, total: 1 };
}
