// EL RESUMEN DEL DUELO — el porqué de quién ganó.
//
// Petición de clase (Tildes en VS): "al finalizar debería salir lo que hizo el
// alumno, las tildes buenas y las malas, para saber quién ganó". El duelo
// terminaba con "3 de 5 aciertos · 3 pts" y ahí se acababa la explicación, con
// dos alumnos en la pizarra y la clase mirando.
//
// Run: node tests/duelSummary.test.mjs
import assert from 'node:assert';
import '../core/registerTemplates.js';
import { createSession } from '../kernel/session/engine.js';
import { getTemplate } from '../core/registry.js';
import { sideBreakdown, duelSummaryHtml } from '../core/duelSummary.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const tildes = {
  id: 't1', title: 'Tildes', template: 'tildes', schemaVersion: 4, templateVersion: 1,
  rules: {}, presentation: {}, live: {}, scoring: { pointsPerCorrect: 1 },
  content: { passages: [
    { id: 'ps_1', text: 'El arbol es mas alto', marks: [{ kind: 'tilde', pos: 3 }, { kind: 'tilde', pos: 13 }] },
    { id: 'ps_2', text: 'Mi mama vino', marks: [{ kind: 'tilde', pos: 6 }] },
  ] },
};

// ── 1. El detalle del scorer llega ENTERO al final del duelo ───────────────
// Antes se calculaba y se tiraba: `answer()` solo guardaba correct/points.
{
  const s = createSession(tildes, { format: 'vs', left: 'Ana', right: 'Beto' });
  s.start();
  s.answer('left', [3, 13]);        // hoja 1 perfecta
  s.answer('left', [6]);            // hoja 2 perfecta
  s.answer('right', [3, 0]);        // 1 bien, 1 de más, 1 sin marcar
  s.answer('right', []);            // nada
  const st = s.standings();

  assert.deepStrictEqual(st.left.marks, { hits: 3, over: 0, total: 3, marca: true }, 'Ana: todo bien');
  assert.deepStrictEqual(st.right.marks, { hits: 1, over: 1, total: 3, marca: true }, 'Beto: 1 bien, 1 de más');
  ok('el duelo conserva aciertos · de más · total de cada lado (antes se perdía)');
}

// ── 2. Se dice en palabras de profe ────────────────────────────────────────
{
  const s = createSession(tildes, { format: 'vs', left: 'Ana', right: 'Beto' });
  s.start();
  s.answer('left', [3, 13]); s.answer('left', [6]);
  s.answer('right', [3, 0]); s.answer('right', []);
  const st = s.standings();

  assert.deepStrictEqual(sideBreakdown(st.left, st.total), ['3 de 3 bien']);
  assert.deepStrictEqual(sideBreakdown(st.right, st.total), ['1 de 3 bien', '1 de más', '2 sin marcar'],
    'las tres cifras que el profe necesita para arbitrar');

  const html = duelSummaryHtml(st);
  assert.ok(html.includes('Ana') && html.includes('Beto'), 'los dos nombres');
  assert.ok(html.includes('1 de más'), 'lo que resta se dice, no se esconde');
  assert.ok(!html.includes('<script'), 'sin inyección');
  ok('el resumen explica el resultado: "1 de 3 bien · 1 de más · 2 sin marcar"');
}

// ── 3. CONTRA-PRUEBA: un todo-o-nada no inventa un desglose ────────────────
// Quiz no declara hits/over: decir "0 de más" sería una cifra fabricada.
{
  const quiz = {
    id: 'q1', title: 'Quiz', template: 'quiz', schemaVersion: 4, templateVersion: 1,
    rules: {}, presentation: {}, live: {}, scoring: { pointsPerCorrect: 1 },
    content: { items: [
      { id: 'q_1', question: '2+2', answer: '4', options: ['4', '5'], points: 1 },
      { id: 'q_2', question: '3+3', answer: '6', options: ['6', '7'], points: 1 },
    ] },
  };
  assert.ok(getTemplate('quiz'), 'quiz registrado');
  const s = createSession(quiz, { format: 'vs', left: 'Ana', right: 'Beto' });
  s.start();
  s.answer('left', '4'); s.answer('left', '6');
  s.answer('right', '5'); s.answer('right', '6');
  const st = s.standings();

  assert.strictEqual(st.left.marks.marca, false, 'Quiz cuenta RESPUESTAS, no marcas');
  assert.deepStrictEqual(sideBreakdown(st.left, st.total), ['2 de 2 aciertos'],
    'se cae a lo único honesto: aciertos, sin "de más" ni "sin marcar"');
  assert.ok(duelSummaryHtml(st).includes('1 de 2 aciertos'), 'y el cuadro sigue saliendo');
  ok('CONTRA-PRUEBA: Quiz no finge un desglose que su scorer no da');
}

// ── 4. No se rompe con un duelo a medias ───────────────────────────────────
{
  assert.strictEqual(duelSummaryHtml(null), '');
  assert.strictEqual(duelSummaryHtml({ left: null, right: null }), '');
  assert.deepStrictEqual(sideBreakdown(undefined, 0), []);
  ok('sin datos no pinta nada (nunca revienta la pantalla final)');
}

// ── 5. En carrera, el que se queda a medias se ve ──────────────────────────
// Operaciones cierra el duelo cuando el primero acaba. El otro lado mostraba
// "1 de 1 aciertos": técnicamente cierto y engañoso — parecía perfecto.
{
  const math = {
    id: 'm1', title: 'Operaciones', template: 'math', schemaVersion: 4, templateVersion: 1,
    rules: {}, presentation: {}, live: {}, scoring: { mode: 'flat', pointsPerCorrect: 1 },
    content: { items: [
      { id: 'i1', question: '2 × 6', answer: '12', points: 1 },
      { id: 'i2', question: '3 × 4', answer: '12', points: 1 },
    ] },
  };
  const s = createSession(math, { format: 'vs', left: 'Ana', right: 'Beto' });
  s.start();
  s.answer('left', '12'); s.answer('right', '12');
  s.answer('left', '12');            // Ana termina y cierra la carrera
  const st = s.standings();
  const beto = sideBreakdown(st.right, st.total);
  assert.deepStrictEqual(beto, ['1 de 2 aciertos', 'no terminó'],
    'el denominador es el del DUELO y se dice que se quedó a medias');
  assert.deepStrictEqual(sideBreakdown(st.left, st.total), ['2 de 2 aciertos']);
  ok('carrera: "1 de 2 aciertos · no terminó" en vez de un engañoso "1 de 1"');
}

console.log(`\n  ${passed} duelSummary checks passed`);
