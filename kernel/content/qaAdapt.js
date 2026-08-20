// Adaptación de contenido DENTRO del modelo `qa` entre plantillas con forma de
// ítem distinta. Quiz necesita `options[]`; Matemáticas usa {question, answer}
// numérico SIN opciones. El conversor por modelo (convert.js) no lo distingue
// (ambas son `qa`), así que el "cambio de formato" se afina aquí, por plantilla.
//
// Reglas:
//   Matemáticas → Quiz : por cada ítem se generan OPCIONES. Si la pregunta es una
//                        operación (A × B, +, −, ÷), los distractores son ERRORES
//                        TÍPICOS (confundir la operación, fila vecina de la tabla,
//                        invertir cifras…). Si no, vecinos numéricos / huecos.
//   Quiz → Matemáticas : se conserva pregunta + respuesta correcta; se quitan las
//                        opciones. (Matemáticas es numérico; si no lo es, el
//                        docente lo ajusta.)
// Puro: sin DOM, testeable en Node (tests/qaAdapt.test.mjs).

import { rid } from '../../core/ids.js';
import { answerIndices, repartirCorrecta } from '../../core/contentModels/qa.js';
const str = (v) => (v == null ? '' : String(v));
const firstAnswer = (a) => (Array.isArray(a) ? a[0] : a);

// Extrae { a, op, b } de una pregunta tipo "2 × 6" (acepta × x * + - − ÷ /).
function parseOperation(question) {
  const m = str(question).match(/(-?\d+)\s*([×x*+\-−÷/])\s*(-?\d+)/i);
  if (!m) return null;
  let op = m[2];
  if (op === 'x' || op === 'X' || op === '*' || op === '×') op = '×';
  else if (op === '/' || op === '÷') op = '÷';
  else if (op === '−') op = '-';
  return { a: Number(m[1]), op, b: Number(m[3]) };
}

// Candidatos de "error típico" (los más plausibles primero).
function typicalWrongs(question, n) {
  const p = parseOperation(question);
  const out = [];
  if (p) {
    const { a, op, b } = p;
    if (op === '×') out.push(a * b - a, a * b + a, a * b - b, a * b + b, a + b); // fila vecina / ×→+
    else if (op === '+') out.push(n - 1, n + 1, a * b, a - b);                    // ±1 / +→×
    else if (op === '-') out.push(a + b, n + 1, n - 1, b - a);                    // −→+ / orden
    else if (op === '÷') out.push(a * b, n + 1, n - 1, a - b);                    // ÷→×
  }
  if (n >= 10) out.push(Number(String(n).split('').reverse().join(''))); // invertir cifras (12↔21)
  out.push(n + 1, n - 1, n + 2, n - 2, n + 10); // respaldo genérico
  return out;
}

/** Opciones para Quiz a partir de la respuesta (y la pregunta, si la hay). */
export function buildQuizOptions(answer, question) {
  const a = str(answer).trim();
  const n = Number(a);
  if (a === '' || !Number.isFinite(n)) return [a, '', '', ''];
  const out = [a];
  for (const c of typicalWrongs(question, n)) {
    if (!Number.isFinite(c)) continue;
    if (c < 0 && n >= 0) continue;            // evita negativos si la respuesta no lo es
    const s = String(c);
    if (s === a || out.includes(s)) continue;
    out.push(s);
    if (out.length === 4) break;
  }
  while (out.length < 4) out.push(''); // por si no se reunieron 3 distractores
  return out;
}

/** Normaliza items `qa` para QUIZ: garantiza options[] (≥2 reales) y answerIdx. */
export function adoptForQuiz(content) {
  const items = Array.isArray(content?.items) ? content.items : [];
  return {
    items: items.map((it, idx) => {
      // COMPLETAR, NO REESCRIBIR. Esta función existe para una sola cosa: que el
      // ítem tenga opciones donde hacían falta. Reconstruía el ítem entero desde
      // una lista fija de campos, y eso rompía dos cosas al pasar de Quiz a
      // Globos —que es contenido IDÉNTICO y no debería tocar nada—:
      //   · una pregunta con VARIAS respuestas correctas se quedaba con la
      //     primera, así que el alumno que explotaba otra correcta puntuaba mal;
      //   · sembraba `points: 1`, justo lo que `stripSeededPoints` (migración
      //     v1→v2 de Globos y Quiz) existe para deshacer: con `points` en el
      //     ítem, «Puntos por acierto» del panel deja de aplicarse.
      // Ahora se PARTE del ítem tal cual y solo se añade lo que falta.
      const respuestas = Array.isArray(it?.answer) ? it.answer.map(str) : [str(it?.answer)];
      const primera = respuestas.find(r => r.trim() !== '') || '';
      let options = Array.isArray(it?.options) ? it.options.map(str) : [];
      // AL REHACER LAS OPCIONES, EL ÍNDICE QUE TRAÍA EL ÍTEM YA NO VALE: apuntaba
      // a la lista anterior, y sobre la nueva señala un distractor. La forma
      // sigue siendo válida, así que nadie lo nota hasta que un alumno acierta y
      // la app le dice que no. Por eso al construirlas se decide aquí dónde va la
      // correcta, en vez de preguntárselo a `answerIndices`.
      let answerIdx;
      if (options.filter((o) => o.trim() !== '').length < 2) {
        // `buildQuizOptions` deja la respuesta en la posición 0; repartirla es
        // lo mismo que hace la IA, y por el mismo motivo: con «Mezclar opciones»
        // apagado, la de arriba sería siempre la buena.
        ({ options, answerIdx } = repartirCorrecta(buildQuizOptions(primera, it?.question), idx));
      } else {
        // Con las opciones del profe intactas, quién es la correcta lo decide
        // `answerIndices`, que compara como compara el juego.
        answerIdx = answerIndices({ ...it, options });
        // Y SI NO HAY NINGUNA, se pone. Un ítem cuyas opciones no contienen la
        // respuesta es una pregunta que NADIE puede acertar; entre perder un
        // distractor y dejar eso, se pierde el distractor.
        if (!answerIdx.length && primera) {
          ({ options, answerIdx } = repartirCorrecta(
            [primera, ...options.filter(o => o.trim() !== '')].slice(0, Math.max(2, options.length)), idx));
        }
      }
      return {
        ...it,                       // lo que la plantilla destino no conozca, se conserva
        id: it?.id || rid('q_'),
        question: str(it?.question),
        options,
        answer: Array.isArray(it?.answer) ? it.answer : (primera || ''),
        answerIdx,
        image: it?.image ?? null,
        audio: it?.audio ?? null,
      };
    }),
  };
}

/** Normaliza items `qa` para MATEMÁTICAS: se responde con el TECLADO, así que
 *  aquí las opciones sobran y se quitan. Por lo demás, mismo criterio que su
 *  hermana `adoptForQuiz`: se COMPLETA lo que falta, no se reconstruye el ítem
 *  —y no se siembra `points`, que es justo lo que `stripSeededPoints` existe
 *  para deshacer (con `points` en el ítem, «Puntos por acierto» no se aplica).
 */
export function adoptForMath(content) {
  const items = Array.isArray(content?.items) ? content.items : [];
  return {
    items: items.map((it) => {
      const { options, answerIdx, ...resto } = it || {};
      return {
        ...resto,
        id: it?.id || rid('m_'),
        question: str(it?.question),
        answer: str(firstAnswer(it?.answer)),
      };
    }),
  };
}
