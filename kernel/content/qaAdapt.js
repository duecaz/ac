// Adaptación de contenido DENTRO del modelo `qa` entre plantillas con forma de
// ítem distinta. Quiz necesita `options[]` (opción múltiple); Matemáticas usa
// `{question, answer}` numérico (teclado), SIN opciones. El conversor por modelo
// (convert.js) no distingue esto porque ambas son `qa`, así que el "cambio de
// formato" lo afina aquí, por plantilla, vía adoptContent.
//
// Reglas (cableado explícito):
//   Matemáticas → Quiz : por cada ítem {question, answer}, generamos opciones
//                        (la respuesta + distractores numéricos plausibles).
//   Quiz → Matemáticas : tomamos question + la respuesta correcta; quitamos las
//                        opciones. (Si la respuesta no es numérica, se conserva
//                        igual: el docente la ajusta — Matemáticas es numérico.)
// Puro: sin DOM, testeable en Node (tests/qaAdapt.test.mjs).

const rid = (p) => p + Math.random().toString(36).slice(2, 8);
const str = (v) => (v == null ? '' : String(v));
const firstAnswer = (a) => (Array.isArray(a) ? a[0] : a);

/** Opciones para Quiz a partir de una respuesta. Numérica → respuesta + vecinos
 *  numéricos distintos; texto → la respuesta + huecos para que el docente llene. */
export function buildQuizOptions(answer) {
  const a = str(answer).trim();
  const n = Number(a);
  if (a !== '' && Number.isFinite(n)) {
    const cand = [n, n + 1, n - 1, n + 2, n + 3, n - 2];
    const uniq = [];
    for (const c of cand) {
      const s = String(c);
      if (!uniq.includes(s)) uniq.push(s);
      if (uniq.length === 4) break;
    }
    while (uniq.length < 4) uniq.push('');
    return uniq;
  }
  return [a, '', '', ''];
}

/** Normaliza items `qa` para QUIZ: garantiza options[] (≥2 reales) y answerIdx. */
export function adoptForQuiz(content) {
  const items = Array.isArray(content?.items) ? content.items : [];
  return {
    items: items.map((it) => {
      const answer = str(firstAnswer(it?.answer));
      let options = Array.isArray(it?.options) ? it.options.map(str) : [];
      if (options.filter((o) => o.trim() !== '').length < 2) options = buildQuizOptions(answer);
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
