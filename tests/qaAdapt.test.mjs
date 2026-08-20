// Conversión de contenido qa entre Quiz y Matemáticas (módulo puro).
// Run: node tests/qaAdapt.test.mjs
import assert from 'node:assert';
import { adoptForQuiz, adoptForMath, buildQuizOptions } from '../kernel/content/qaAdapt.js';

let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };
const distinct = (arr) => new Set(arr.filter(x => x !== '')).size === arr.filter(x => x !== '').length;

// Matemáticas → Quiz con DISTRACTORES DIDÁCTICOS según la operación.
const mq = adoptForQuiz({ items: [{ id: 'm1', question: '2 × 6', answer: '12', points: 1 }] });
const it = mq.items[0];
assert.strictEqual(it.options.length, 4, '4 opciones');
assert.ok(distinct(it.options), 'opciones distintas');
assert.ok(it.options.includes('12'), 'incluye la respuesta');
assert.strictEqual(it.options[it.answerIdx[0]], '12', 'la marcada es la respuesta');
// errores típicos de la tabla del 2: fila vecina (12±2 = 10/14) y columna (12-6=6)
assert.ok(it.options.includes('10') || it.options.includes('14'), 'incluye fila vecina (10/14)');
ok('Matemáticas→Quiz: distractores didácticos por operación (×)');

// Suma: error típico +→× y ±1
const add = buildQuizOptions('15', '10 + 5');
assert.ok(add.includes('15') && distinct(add) && add.length === 4, 'suma: 4 distintas con respuesta');
assert.ok(add.includes('14') || add.includes('16'), 'suma: incluye ±1');
ok('Suma: distractores ±1 y +→×');

// Sin operación reconocible → vecinos numéricos
const plain = buildQuizOptions('7', 'siete');
assert.ok(plain.includes('7') && distinct(plain) && plain.length === 4, 'numérica sin op: vecinos');
ok('Numérica sin operación: vecinos distintos');

// No numérica → respuesta + huecos
assert.deepStrictEqual(buildQuizOptions('Lima', '¿Capital?'), ['Lima', '', '', '']);
ok('Texto: respuesta + huecos');

// Quiz → Matemáticas: conserva pregunta+respuesta, sin options
const qm = adoptForMath({ items: [{ id: 'q1', question: '3 × 3', options: ['9', '6', '12', '3'], answer: '9', points: 2 }] });
assert.deepStrictEqual(
  { q: qm.items[0].question, a: qm.items[0].answer, o: qm.items[0].options, p: qm.items[0].points },
  { q: '3 × 3', a: '9', o: undefined, p: 2 });
ok('Quiz→Matemáticas conserva pregunta+respuesta, quita opciones');

// --- adoptForQuiz COMPLETA, no reescribe -----------------------------------
// Se le dio a Globos para que Operaciones→Globos dejara de salir vacía, y al
// hacerlo se vio que reconstruía el ítem desde una lista fija de campos. En un
// cambio ENTRE PLANTILLAS CON EL MISMO CONTENIDO (Quiz→Globos) eso no debería
// tocar nada, y tocaba dos cosas que se pagan en el podio.
{
  // 1) Varias respuestas correctas: el alumno que explota OTRA correcta acierta.
  const multi = adoptForQuiz({ items: [
    { id: 'q1', question: '¿Cuáles son pares?', options: ['2', '3', '4', '5'],
      answer: ['2', '4'], answerIdx: [0, 2] },
  ] }).items[0];
  assert.deepStrictEqual(multi.answer, ['2', '4'], 'conserva TODAS las respuestas correctas');
  assert.deepStrictEqual(multi.answerIdx, [0, 2], 'y sus posiciones');

  // 2) `points` sembrado: con él en el ítem, «Puntos por acierto» del panel deja
  //    de aplicarse. Es el bug que la migración v1→v2 (stripSeededPoints) quitó.
  const sinPuntos = adoptForQuiz({ items: [
    { id: 'q2', question: '2+2', options: ['4', '5'], answer: '4' },
  ] }).items[0];
  assert.ok(!('points' in sinPuntos), 'NO siembra points: el panel manda');
  const conPuntos = adoptForQuiz({ items: [
    { id: 'q3', question: '2+2', options: ['4', '5'], answer: '4', points: 10 },
  ] }).items[0];
  assert.strictEqual(conPuntos.points, 10, 'pero respeta los que el ítem ya traía');

  // 3) CONTRA-PRUEBA: sigue haciendo su trabajo — un ítem SIN opciones (el de
  //    Operaciones, que se teclea) sale con opciones jugables.
  const tecleado = adoptForQuiz({ items: [
    { id: 'm1', question: '2 × 6', answer: '12' },
  ] }).items[0];
  assert.ok(tecleado.options.filter(o => o.trim() !== '').length >= 2,
    'a un ítem sin opciones se las construye — que es para lo que existe');
  assert.ok(tecleado.options.includes('12'), 'y la correcta está entre ellas');
  ok('adoptForQuiz COMPLETA lo que falta sin reescribir lo que ya estaba bien');
}

// Y el desajuste que destapó unificar la definición: la comparación es la del
// JUEGO (sin tildes ni mayúsculas). Con `===` a pelo, una opción «madrid» y una
// respuesta «Madrid» —que `isCorrect` da por buena— salía SIN marcar.
{
  const it = adoptForQuiz({ items: [
    { id: 'q4', question: '¿Capital?', options: ['madrid', 'lisboa'], answer: 'Madrid' },
  ] }).items[0];
  assert.deepStrictEqual(it.answerIdx, [0], 'marca la correcta aunque cambien tildes/mayúsculas');
  ok('answerIdx se deriva como puntúa el juego, no con comparación exacta');
}

// ── UN ÍNDICE VIEJO SOBRE OPCIONES NUEVAS SEÑALA UN DISTRACTOR ──────────────
// `answerIndices` devuelve `answerIdx` tal cual cuando existe, y eso es correcto
// mientras las opciones sean las mismas. Al REHACERLAS (el ítem venía con menos
// de dos), ese número apuntaba a la lista anterior: sobre la nueva marca una
// opción falsa. Y la forma es válida, así que ni el validador ni el revisor
// dicen nada — se descubre cuando un alumno acierta y la app le dice que no.
{
  const it = adoptForQuiz({ items: [
    { id: 'q5', question: '¿Capital de Francia?', answer: 'París', options: ['París'], answerIdx: [2] },
  ] }).items[0];
  assert.ok(it.answerIdx.length, 'la pregunta tiene que tener alguna correcta');
  for (const i of it.answerIdx) {
    assert.strictEqual(it.options[i], 'París', 'el índice marcado ES la respuesta, no un distractor');
  }
  ok('al rehacer las opciones se recalcula el índice: el viejo apuntaba a otra lista');
}

// ── UNA PREGUNTA SIN NINGUNA CORRECTA ES UNA PREGUNTA IMPOSIBLE ─────────────
// Si las opciones que traía el ítem no contienen la respuesta, `answerIndices`
// devuelve vacío: nadie puede acertarla. Entre perder un distractor y dejar eso
// en la actividad del profe, se pierde el distractor.
{
  const it = adoptForQuiz({ items: [
    { id: 'q6', question: '¿Capital de Italia?', answer: 'Roma', options: ['Milán', 'Nápoles', 'Turín'] },
  ] }).items[0];
  assert.ok(it.answerIdx.length, 'ninguna pregunta puede quedarse sin respuesta correcta');
  for (const i of it.answerIdx) assert.strictEqual(it.options[i], 'Roma', 'y la marcada es la respuesta');
  assert.ok(it.options.length >= 2, 'sigue habiendo entre qué elegir');
  ok('si las opciones no traían la correcta, se pone (una pregunta imposible es peor)');
}

console.log(`\nqaAdapt.test: ${passed} checks passed`);
