// Conversión de contenido qa entre Quiz y Matemáticas (módulo puro).
// Run: node tests/qaAdapt.test.mjs
import assert from 'node:assert';
import { adoptForQuiz, adoptForMath, buildQuizOptions } from '../kernel/content/qaAdapt.js';

let passed = 0; const ok = (m) => { passed++; console.log('  ✓', m); };

// Matemáticas → Quiz: genera opciones con la respuesta correcta
const mq = adoptForQuiz({ items: [{ id: 'm1', question: '2 × 6', answer: '12', points: 1 }] });
const it = mq.items[0];
assert.ok(Array.isArray(it.options) && it.options.length >= 4, 'genera ≥4 opciones');
assert.ok(it.options.includes('12'), 'incluye la respuesta');
assert.strictEqual(it.answerIdx.length, 1, 'marca exactamente 1 correcta');
assert.strictEqual(it.options[it.answerIdx[0]], '12', 'la marcada es la respuesta');
ok('Matemáticas→Quiz genera opciones con la correcta');

// buildQuizOptions numérica → distintas
const opts = buildQuizOptions('7');
assert.strictEqual(new Set(opts).size, opts.length, 'opciones distintas');
assert.ok(opts.includes('7'), 'incluye la respuesta');
ok('buildQuizOptions numérica: 4 distintas con la respuesta');

// no numérica → respuesta + huecos
assert.deepStrictEqual(buildQuizOptions('Lima'), ['Lima', '', '', '']);
ok('buildQuizOptions texto: respuesta + huecos');

// Quiz → Matemáticas: conserva pregunta+respuesta, sin options
const qm = adoptForMath({ items: [{ id: 'q1', question: '3 × 3', options: ['9', '6', '12', '3'], answer: '9', answerIdx: [0], points: 2 }] });
const m = qm.items[0];
assert.strictEqual(m.question, '3 × 3');
assert.strictEqual(m.answer, '9');
assert.strictEqual(m.options, undefined, 'sin options');
assert.strictEqual(m.points, 2);
ok('Quiz→Matemáticas conserva pregunta+respuesta y quita opciones');

// answer en array → usa la primera
const qa = adoptForQuiz({ items: [{ question: 'x', answer: ['A', 'B'], options: [] }] });
assert.ok(qa.items[0].options.includes('A'), 'usa la primera respuesta del array');
ok('answer en array → primera como respuesta');

console.log(`\nqaAdapt.test: ${passed} checks passed`);
