// Scorer for word search VS rounds.
// The player searches the WHOLE board freely (like solo), so a submission is
// correct if `value` is ANY word from the activity's list — not only the word
// at the current cursor. The round only submits words not already found, so each
// correct find advances exactly one segment.
//
// P5 (docs/historico/handoff-puntuacion.md): escala UNIFICADA — los puntos los pone la
// fórmula común awardPoints (ppc default 1, flat|velocidad). Se retiraron el ppc
// default 10, el bonus por velocidad propio y el bonus por longitud (>6 letras): eran
// una segunda moneda que hacía ilegibles los informes entre actividades. El
// player SOLO llama a este mismo scorer (un solo scorer por plantilla).
import { awardPoints } from '../../core/scoring/index.js';

const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

export function scoreWordsearch({ value, msTaken, activity, mode = 'solo' }) {
  if (!value) return { correct: false, points: 0, hits: 0, total: 1 };
  const found = norm(value);
  const words = (activity.content?.words || []).map(norm);
  const ok = words.includes(found);
  const points = awardPoints({ correct: ok, item: null, msTaken, activity, mode });
  return { correct: ok, points, hits: ok ? 1 : 0, total: 1 };
}
