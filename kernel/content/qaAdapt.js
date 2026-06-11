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

const rid = (p) => p + Math.random().toString(36).slice(2, 8);
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
    items: items.map((it) => {
      const answer = str(firstAnswer(it?.answer));
      let options = Array.isArray(it?.options) ? it.options.map(str) : [];
      if (options.filter((o) => o.trim() !== '').length < 2) options = buildQuizOptions(answer, it?.question);
      if (answer && !options.includes(answer)) options[0] = answer;
      while (options.length < 4) options.push('');
      const answerIdx = answer
        ? options.map((o, i) => (o === answer ? i : -1)).filter((i) => i >= 0).slice(0, 1)
        : [];
      return {
        id: it?.id || rid('q_'),
        question: str(it?.question),
        options,
        answer: answer || '',
        answerIdx,
        points: it?.points || 1,
        image: it?.image || null,
        audio: it?.audio || null,
      };
    }),
  };
}

/** Normaliza items `qa` para MATEMÁTICAS: {question, answer, points}, sin options. */
export function adoptForMath(content) {
  const items = Array.isArray(content?.items) ? content.items : [];
  return {
    items: items.map((it) => ({
      id: it?.id || rid('m_'),
      question: str(it?.question),
      answer: str(firstAnswer(it?.answer)),
      points: it?.points || 1,
    })),
  };
}
