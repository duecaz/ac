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

console.log(`\nqaAdapt.test: ${passed} checks passed`);
