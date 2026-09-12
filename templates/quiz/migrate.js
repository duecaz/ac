// LA MIGRACIÓN DEL CONTENIDO de Quiz (§24: el contenido del usuario solo cambia
// por migración versionada). Aparte de `template.js` porque es lo único del
// fichero que TOCA contenido guardado, y porque así se puede leer —y probar—
// sola: v1→v2 quita el `points: 1` sembrado y asegura `answerIdx` en cada ítem.
import { stripSeededPoints, answerIndices } from '../../core/contentModels/qa.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').QaItem} QaItem
 */

/** v1→v2 · cada ítem lleva `answerIdx` (las POSICIONES correctas) para que el
 *  editor no vuelva a derivar la corrección del TEXTO de la opción.
 * @param {QaItem[]} items
 * @returns {void}
 */
function rellenarAnswerIdx(items) {
  for (const it of items) {
    if (!it) continue;
    const opciones = it.options || [];
    // RESCATE de las preguntas que perdieron su `answer` al editar el texto
    // de la opción correcta (el bug de "todas malas": el editor mutaba el
    // texto antes de fijar el índice). Si la MARCA por índice sobrevivió, la
    // respuesta se re-deriva de ella; si no sobrevivió, no hay nada que
    // adivinar y el editor lo señala en rojo. Idempotente.
    if (Array.isArray(it.answerIdx) && it.answerIdx.length) {
      const texts = it.answerIdx
        .filter(k => k >= 0 && k < opciones.length)
        .map(k => String(opciones[k] ?? ''))
        .filter(t => t.trim() !== '');
      const lost = Array.isArray(it.answer)
        ? it.answer.filter(s => String(s ?? '').trim() !== '').length === 0
        : String(it.answer ?? '').trim() === '';
      if (lost && texts.length) it.answer = texts.length === 1 ? texts[0] : texts;
    }
    // «Cuál es la correcta» tiene UN dueño (`answerIndices`, core/contentModels/qa.js):
    // compara con el MISMO `norm` que el scorer. Aquí se derivaba con `===`
    // crudo, así que una opción «madrid» con respuesta «Madrid» —que el juego
    // da por buena— se guardaba como `answerIdx: []`, y desde ese momento el
    // editor la pintaba SIN marcar.
    if (!Array.isArray(it.answerIdx)) it.answerIdx = answerIndices(it);
  }
}

/** La firma es la IDENTIDAD sobre la forma (la de `templates/base.js`): el
 *  contenido entra tal cual lo tenga la actividad y se estrecha por FORMA.
 * @template C
 * @param {C} content
 * @returns {C}
 */
export function migrateQuizContent(content /*, fromVersion */) {
  if (!content || typeof content !== 'object' || !('items' in content)) return content;
  // v1→v2: fuera el `points: 1` sembrado. Aquí el campo SÍ es visible
  // («Avanzado → puntos»), pero seguía naciendo escrito, así que cambiar
  // «Puntos por acierto» tampoco hacía nada hasta tocar pregunta por pregunta.
  stripSeededPoints(content);
  if (Array.isArray(content.items)) rellenarAnswerIdx(content.items);
  return content;
}
