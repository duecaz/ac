// Question-Answer content model used by the quiz template.
import { rid } from '../ids.js';

// SEMILLA Y PRIMER PASO — dueño único (barrido B5, 2026-09-02). Quiz y Globos
// («el caso Wordwall puro», mismo contenido `qa`) repetían el mismo texto de
// `editor.primerPaso` y una lista de ítems de muestra con la misma forma.
export const QA_PRIMER_PASO = 'Pulsa «Añadir pregunta» y escribe la pregunta con sus respuestas: una correcta y las demás no.';

/** Ítems de muestra con los que nace una actividad `qa` nueva (Quiz, Globos…). */
export function defaultQaItems() {
  return [
    { id: rid('q_'), question: '¿Cuál es la capital de España?', answer: 'Madrid', options: ['Madrid', 'Barcelona', 'Lisboa', 'París'], image: null, audio: null },
    { id: rid('q_'), question: '¿Cuánto es 6 × 7?', answer: '42', options: ['36', '42', '48'], image: null, audio: null },
    { id: rid('q_'), question: '¿De qué color es el sol?', answer: 'Amarillo', options: ['Amarillo', 'Verde', 'Azul', 'Rojo'], image: null, audio: null },
  ];
}

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

/** QUÉ OPCIONES SON LA RESPUESTA, por posición.
 *
 *  Vive aquí, con `isCorrect` y `hasCorrectAnswer`, y compara con el MISMO
 *  `norm` que ellas: sin tildes ni mayúsculas. Derivarlo fuera con `===` hacía
 *  que una opción «madrid» y una respuesta «Madrid» —que el juego da por
 *  buena— saliera sin marcar. Eran cuatro definiciones de "la correcta" antes
 *  de unificarlas; esta es la quinta cara del mismo dado.
 *  Si el ítem ya trae `answerIdx`, manda él (resiste opciones repetidas).
 */
/**
 * DÓNDE CAE LA CORRECTA. Ponerla siempre la primera deja la actividad entera
 * contestable sin leer nada en cuanto el profe apaga «Mezclar opciones» —que es
 * un ajuste suyo, no una garantía—. Se reparte por el NÚMERO de elemento, sin
 * azar, para que la misma entrada dé siempre la misma actividad (y se pueda
 * comprobar). Vive aquí, con `answerIndices`, porque es la otra mitad de la
 * misma pregunta: quién es la correcta y dónde se pone.
 *
 * @param {string[]} options  la correcta va en la posición 0 al entrar
 * @param {number} i          número del elemento en la lista
 * @returns {{options: string[], answerIdx: number[]}}
 */
export function repartirCorrecta(options, i = 0) {
  const lista = [...options];
  if (lista.length < 2) return { options: lista, answerIdx: lista.length ? [0] : [] };
  const donde = ((i % lista.length) + lista.length) % lista.length;
  lista.splice(donde, 0, lista.shift());
  return { options: lista, answerIdx: [donde] };
}

export function answerIndices(item) {
  const idx = item?.answerIdx;
  if (Array.isArray(idx) && idx.length) return idx;
  const ans = item?.answer;
  const respuestas = (Array.isArray(ans) ? ans : [ans])
    .map(a => norm(a)).filter(a => a !== '');
  if (!respuestas.length) return [];
  return (item?.options || [])
    .map((o, i) => (respuestas.includes(norm(o)) ? i : -1))
    .filter(i => i >= 0);
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
