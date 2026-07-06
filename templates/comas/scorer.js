// Comma scoring for the session formats (VS / Equipos-auto / Live). Crédito
// PARCIAL, igual que Tildes: 1 punto por cada coma bien colocada y cada marca de
// más resta (suelo 0) → el duelo da "puntos por cada coma buena", no todo-o-nada
// por frase. `value` es el array de posiciones tras las que el alumno puso coma.
import { scoreMarksPerHit } from '../../core/textMarks.js';

export function scoreComasSubmission({ value, item, activity }) {
  return scoreMarksPerHit(value, item, ['coma'], activity);
}
