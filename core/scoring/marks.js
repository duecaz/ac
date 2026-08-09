// MÉRITO por marcas (Tildes/Comas y cualquier futura plantilla "marca el texto").
// Movido desde core/textMarks.js (que re-exporta y se queda con texto+marcas):
// esto es puntuación, no manipulación de texto. Ver docs/historico/handoff-puntuacion.md.
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

// Puntuación NETA por marca: `pointsPerCorrect` (guardado EN la actividad,
// default 1) por cada marca CORRECTA, MENOS cada marca de MÁS. Puntaje =
// max(0, aciertos − de más) × ppc. Así "marcar todo" NO es una ventaja: cada
// tilde/coma de más resta, y poner todas deja el neto en 0 (nunca gana). Los
// campos `hits`/`over`/`total` se conservan tal cual para la tabla ("3/8 · 2 de
// más"); `net` es el neto puntuable y `perfect` = todas y 0 de más. ÚNICA fuente
// de la regla: solo/tarea/VS/equipos/live la comparten vía
// scoreTildesSubmission/scoreComasSubmission y runTextCorrectionSolo.
export function scoreMarksPerHit(value, item, kinds, activity) {
  const want = new Set((item?.marks || []).filter(m => kinds.includes(m.kind)).map(m => m.pos));
  const got = Array.isArray(value) ? value.map(Number) : [];
  let hits = 0, over = 0;
  for (const p of new Set(got)) (want.has(p) ? hits++ : over++);
  // basePoints SIN item a propósito: en el crédito por marca no aplica
  // item.points (cada marca vale lo mismo); queda solo config → 1.
  const net = Math.max(0, hits - over);
  const points = net * basePoints(null, activity?.scoring);
  return { correct: net > 0, points, hits, over, net, total: want.size, perfect: hits === want.size && over === 0 };
}
