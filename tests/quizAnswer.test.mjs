// QUIZ: la marca de "correcta" no se pierde al editar el TEXTO de la opción.
//
// El bug real (VS, reportado jugando): "clico la respuesta correcta y me las da
// TODAS malas". Causa: en un ítem HEREDADO (sin `answerIdx` — así quedaron las
// actividades creadas antes de que ese campo existiera) la correcta se deducía
// comparando `answer` con el TEXTO de las opciones. El handler del editor mutaba
// el texto PRIMERO y re-deducía DESPUÉS: al corregir una errata en la opción
// correcta ya no coincidía con nada → la pregunta se quedaba con `answer: ''` y
// desde ese momento CUALQUIER respuesta puntúa como fallo, en todos los modos.
// Y en silencio: el editor mantenía el verde hasta el siguiente repintado.
//
// Run: node tests/quizAnswer.test.mjs
import assert from 'node:assert';
import { setOptionText, itemHasNoAnswer, someItemHasNoAnswer } from '../templates/quiz/editor.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const score = (item, value) => scoreQuizSubmission({ value, item, activity: { scoring: { mode: 'flat', pointsPerCorrect: 1 } }, mode: 'vs' });

// ── 1. Ítem HEREDADO (sin answerIdx): corregir la errata NO pierde la correcta ──
{
  // Como quedan las actividades antiguas: solo `answer` en texto.
  const it = { id: 'q_1', question: 'Capital de España', answer: 'Madriz',
               options: ['Madriz', 'Lisboa', 'París', ''], points: 1 };
  assert.strictEqual(score(it, 'Madriz').correct, true, 'antes de editar, la correcta puntúa');
  // El docente corrige la errata en la MISMA opción correcta.
  setOptionText(it, 0, 'Madrid');
  assert.strictEqual(it.answer, 'Madrid', 'la respuesta SIGUE al texto corregido (antes quedaba en "")');
  assert.deepStrictEqual(it.answerIdx, [0], 'y queda fijada por ÍNDICE, no por texto');
  assert.strictEqual(score(it, 'Madrid').correct, true, 'el alumno que pulsa la correcta acierta');
  assert.strictEqual(score(it, 'Lisboa').correct, false, 'contra-prueba: la incorrecta sigue siendo incorrecta');
  ok('editar el texto de la opción correcta ya no borra la respuesta (ítem heredado)');
}

// ── 1b. Escritura letra a letra (el `input` dispara en cada tecla) ──────────
{
  const it = { id: 'q_2', question: '2+2', answer: '4', options: ['4', '5', '6', ''], points: 1 };
  // Borrar y reescribir la opción correcta carácter a carácter — el caso que
  // realmente ocurre al teclear: el primer keystroke ya rompía el emparejamiento.
  for (const step of ['', '1', '10', '100']) setOptionText(it, 0, step);
  assert.strictEqual(it.answer, '100', 'tras teclear, la correcta es el texto final');
  assert.strictEqual(score(it, '100').correct, true, 'y puntúa');
  assert.strictEqual(itemHasNoAnswer(it), false, 'el ítem no queda marcado como "sin respuesta"');
  ok('escribir letra a letra en la opción correcta la mantiene marcada');
}

// ── 1c. Editar OTRA opción no toca la correcta ─────────────────────────────
{
  const it = { id: 'q_3', question: 'Color del cielo', answer: 'Azul',
               options: ['Rojo', 'Azul', 'Verde', ''], points: 1 };
  setOptionText(it, 0, 'Rojo oscuro');
  assert.strictEqual(it.answer, 'Azul', 'editar un distractor no mueve la correcta');
  assert.deepStrictEqual(it.answerIdx, [1]);
  assert.strictEqual(score(it, 'Azul').correct, true);
  ok('editar un distractor no cambia cuál es la correcta');
}

// ── 1d. Varias correctas (respuesta múltiple) se conservan ─────────────────
{
  const it = { id: 'q_4', question: 'Números pares', answer: ['2', '4'],
               options: ['2', '3', '4', '5'], answerIdx: [0, 2], points: 1 };
  setOptionText(it, 2, '44');
  assert.deepStrictEqual(it.answer, ['2', '44'], 'las dos correctas siguen a su texto');
  assert.strictEqual(score(it, '44').correct, true, 'cualquiera de las correctas puntúa');
  assert.strictEqual(score(it, '3').correct, false);
  ok('respuesta múltiple: todas las correctas siguen a su texto');
}

// ── 2. Un ítem SIN correcta se detecta (antes era silencioso) ──────────────
{
  const roto = { id: 'q_5', question: 'X', answer: '', options: ['a', 'b', '', ''], points: 1 };
  assert.strictEqual(itemHasNoAnswer(roto), true, 'sin respuesta marcada → detectado');
  assert.strictEqual(itemHasNoAnswer({ answer: ['', ''], options: [] }), true, 'array vacío de textos también');
  assert.strictEqual(itemHasNoAnswer({ answer: 'a' }), false, 'contra-prueba: con respuesta, no avisa');
  assert.strictEqual(someItemHasNoAnswer({ content: { items: [{ answer: 'a' }, roto] } }), true,
    'la actividad con UN ítem roto avisa');
  assert.strictEqual(someItemHasNoAnswer({ content: { items: [{ answer: 'a' }] } }), false,
    'contra-prueba: una actividad sana no avisa');
  // Y así es como se manifestaba: todo malo.
  assert.strictEqual(score(roto, 'a').correct, false, 'un ítem sin correcta da TODO por fallo (por eso el aviso)');
  ok('ítem sin respuesta correcta: detectado y avisado en el editor, no descubierto jugando');
}

// ── 2b. RESCATE al cargar: si la marca por índice sobrevivió, se re-deriva ──
{
  const { QuizTemplate } = await import('../templates/quiz/template.js');
  // Como quedó guardada una pregunta corrompida por el bug: answer vacío pero
  // answerIdx intacto (el editor SÍ lo escribió, en la misma pasada).
  const roto = { items: [{ id: 'q_1', question: 'Capital', answer: '', answerIdx: [0],
                           options: ['Madrid', 'Lisboa', 'París', ''], points: 1 }] };
  const fixed = QuizTemplate.migrateContent(roto, 1);
  assert.strictEqual(fixed.items[0].answer, 'Madrid', 'la respuesta perdida se recupera del índice al cargar');
  assert.strictEqual(score(fixed.items[0], 'Madrid').correct, true, 'y vuelve a puntuar');
  // Idempotente y sin inventar: sin índice util no se adivina nada.
  const twice = QuizTemplate.migrateContent(JSON.parse(JSON.stringify(fixed)), 1);
  assert.deepStrictEqual(twice, fixed, 'migrar dos veces no cambia nada');
  const perdido = QuizTemplate.migrateContent({ items: [{ answer: '', answerIdx: [], options: ['a', 'b'] }] }, 1);
  assert.strictEqual(perdido.items[0].answer, '', 'sin marca que rescatar NO se inventa una respuesta');
  // Y una pregunta sana no se toca.
  const sana = QuizTemplate.migrateContent({ items: [{ answer: 'b', answerIdx: [1], options: ['a', 'b'] }] }, 1);
  assert.strictEqual(sana.items[0].answer, 'b', 'una pregunta sana se queda igual');
  ok('rescate al cargar: la respuesta perdida vuelve si la marca por índice sobrevivió');
}

// ── 3. El aviso está CABLEADO en el editor (no solo definido) ──────────────
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../templates/quiz/editor.js', import.meta.url), 'utf8');
  assert.match(src, /answerWarningHtml\(a\)\s*\+/, 'el banner de "sin respuesta" se pinta en la lista de preguntas');
  assert.match(src, /setOptionText\(item, k, e\.target\.value\)/, 'el handler de texto pasa por setOptionText');
  assert.ok(!/item\.options\[k\] = e\.target\.value/.test(src),
    'ya no se muta el texto antes de fijar el índice correcto (era el bug)');
  ok('el editor usa el camino seguro y muestra el aviso');
}

console.log(`\nquizAnswer.test: ${passed} checks passed`);
