// Question-Answer content model used by the quiz template.
export function isCorrect(item, value) {
  if (item.answer == null) return null;
  if (Array.isArray(item.answer)) return item.answer.map(s => norm(s)).includes(norm(value));
  return norm(item.answer) === norm(value);
}
function norm(s) {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
}

/** ¿ESTE ÍTEM TIENE UNA RESPUESTA CORRECTA USABLE?
 *
 *  Había CUATRO definiciones (el editor de Quiz, su migración de rescate, el
 *  revisor de actividades y el aviso rojo del propio editor) y ya discrepaban:
 *  las que miraban solo `answer` daban por buena una pregunta cuya opción
 *  marcada se había quedado sin texto — y ahí el scorer da 0 a TODAS las
 *  respuestas sin que nadie se entere hasta el podio.
 *
 *  La regla, una: vale si hay TEXTO en lo marcado. Si hay `answerIdx` manda él
 *  (resiste opciones repetidas o vacías); si no, se mira `answer`.
 */
export function hasCorrectAnswer(item) {
  const lleno = (v) => String(v ?? '').trim() !== '';
  const idx = item?.answerIdx;
  if (Array.isArray(idx) && idx.length) {
    return idx.some(k => lleno((item.options || [])[k]));
  }
  const ans = item?.answer;
  return Array.isArray(ans) ? ans.some(lleno) : lleno(ans);
}
