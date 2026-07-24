// MÉRITO por marcas (Tildes/Comas y cualquier futura plantilla "marca el texto").
// Movido desde core/textMarks.js (que re-exporta y se queda con texto+marcas):
// esto es puntuación, no manipulación de texto. Ver docs/handoff-puntuacion.md.
import { basePoints } from './award.js';

// Puntuación TODO-O-NADA por pasaje (la usa el modo VS clásico de sesión):
// correcto ssi las posiciones marcadas coinciden EXACTAMENTE con la clave.
export function scoreMarks(value, item, kinds, activity) {
  const want = new Set((item?.marks || []).filter(m => kinds.includes(m.kind)).map(m => m.pos));
  const got = new Set(Array.isArray(value) ? value.map(Number) : []);
  const correct = want.size === got.size && [...want].every(p => got.has(p));
  const scoring = activity?.scoring || {};
  return { correct, points: correct ? basePoints(item, scoring) : 0, hits: correct ? want.size : 0, total: want.size };
}

// Puntuación PARCIAL (crédito por marca): `pointsPerCorrect` (guardado EN la
// actividad, default 1) por cada marca CORRECTA — "por palabra buena". Las de
// MÁS no restan puntos: el puntaje = nº de aciertos × ppc, así coincide con la
// tabla ("3/8") y con player.score → clasificación, podio y tabla muestran el
// MISMO número. Las de más van en `over` (desempate/corrección) y `perfect`
// marca la frase impecable. ÚNICA fuente de la regla: solo/tarea/VS/equipos/
// live la comparten vía scoreTildesSubmission/scoreComasSubmission y
// runTextCorrectionSolo.
export function scoreMarksPerHit(value, item, kinds, activity) {
  const want = new Set((item?.marks || []).filter(m => kinds.includes(m.kind)).map(m => m.pos));
  const got = Array.isArray(value) ? value.map(Number) : [];
  let hits = 0, over = 0;
  for (const p of new Set(got)) (want.has(p) ? hits++ : over++);
  // basePoints SIN item a propósito: en el crédito por marca no aplica
  // item.points (cada marca vale lo mismo); queda solo config → 1.
  const points = hits * basePoints(null, activity?.scoring);
  return { correct: points > 0, points, hits, over, total: want.size, perfect: hits === want.size && over === 0 };
}
