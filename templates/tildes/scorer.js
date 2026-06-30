// Tildes scoring for the session formats (VS / Equipos-auto / Live). Crédito
// PARCIAL: cada tilde bien colocada suma y cada marca de más resta (suelo 0), así
// el duelo da "puntos por cada tilde buena" en vez de todo-o-nada por frase.
// `value` es el array de posiciones de carácter que marcó el alumno.
import { scoreMarksPerHit } from '../../core/textMarks.js';

export function scoreTildesSubmission({ value, item, activity }) {
  return scoreMarksPerHit(value, item, ['tilde'], activity);
}
