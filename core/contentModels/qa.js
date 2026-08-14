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

/**
 * QUITA LOS PUNTOS SEMBRADOS (migración qa v1→v2, 2026-08-14).
 *
 * El bug del dueño: puso «Puntos por acierto: 10» en Operaciones y el duelo
 * siguió dando 1 por operación. Motivo: `basePoints()` es
 * `item.points || scoring.pointsPerCorrect`, y CADA ítem nacía con un
 * `points: 1` sembrado por `newEmpty()`. Ese 1 invisible ganaba siempre, así
 * que el campo del panel no hacía nada — en TODOS los modos, no solo en VS.
 *
 * Los puntos POR ÍTEM son una función real (una pregunta puede valer más), pero
 * solo el editor de Quiz los enseña; en Operaciones y Globos el profe no podía
 * ni verlos ni cambiarlos. Un valor que nadie puede ver no puede mandar sobre
 * uno que sí se ve.
 *
 * Se quita SOLO el `1` sembrado: es el valor que `newEmpty()` escribía, y con
 * él «puesto a propósito» y «nunca tocado» son indistinguibles. Sin `points`,
 * el ítem sigue al panel — que es lo que espera quien acaba de cambiarlo.
 * Idempotente.
 */
export function stripSeededPoints(content) {
  if (!content || !Array.isArray(content.items)) return content;
  for (const it of content.items) {
    if (it && it.points === 1) delete it.points;
  }
  return content;
}
