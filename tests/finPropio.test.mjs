// NORMA EJECUTABLE — «el final de la partida lo pone el shell; una plantilla
// AÑADE encima, nunca SUSTITUYE» (core/finPropio.js, §21b un dueño).
// Run: node tests/finPropio.test.mjs
import assert from 'node:assert';
import { FIN_PROPIO, finPropio } from '../core/finPropio.js';
import { runFreeformPlayer } from '../core/soloPlayer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Minimal element for mount(): same stub que tests/soloPlayer.test.mjs.
const makeRoot = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });

// ── 1. El mapa dice lo que dice, y cada entrada trae motivo de verdad ───────
{
  assert.strictEqual(finPropio('question-live'), true, 'question-live está declarado');
  assert.strictEqual(finPropio('crossword'), false, 'crossword YA NO está declarado (perdió su cartel propio)');
  assert.strictEqual(finPropio('quiz'), false, 'una plantilla no declarada no puede saltarse la estándar');
  assert.strictEqual(finPropio('no-existe'), false, 'plantilla inexistente → false (fail-safe)');
  for (const [tpl, motivo] of Object.entries(FIN_PROPIO)) {
    assert.ok(typeof motivo === 'string' && motivo.length >= 40,
      `el motivo de "${tpl}" explica por qué (≥40 caracteres), no solo lo declara`);
  }
  ok('finPropio(): question-live sí, crossword ya no, y todo motivo está escrito de verdad');
}

// ── 2. ROJO→VERDE en el shell libre: sin entrada en el mapa, el shell manda ─
{
  // ROJO: una plantilla sin entrada en FIN_PROPIO (aquí, crossword) pide
  // saltarse la pantalla — el shell la pinta IGUAL (fail-safe).
  const rootSinEntrada = makeRoot();
  const ctx1 = runFreeformPlayer(rootSinEntrada, { id: 'cw1', template: 'crossword', scoring: {} }, { mode: 'solo' });
  ctx1.finish({ score: 3, maxScore: 8, skipResultScreen: true });
  assert.notStrictEqual(rootSinEntrada.innerHTML, '',
    'crossword sin entrada en el mapa: el shell pinta la pantalla estándar de todos modos');
  assert.ok(rootSinEntrada.innerHTML.includes('data-ww-replay'),
    'es la pantalla estándar (trae el botón «Jugar otra vez»), no un vacío casual');

  // VERDE: una plantilla CON entrada (question-live) sí puede saltársela.
  const rootConEntrada = makeRoot();
  const ctx2 = runFreeformPlayer(rootConEntrada, { id: 'ql1', template: 'question-live', scoring: {} }, { mode: 'live-student' });
  ctx2.finish({ score: 6, maxScore: 6, skipResultScreen: true });
  assert.strictEqual(rootConEntrada.innerHTML, '',
    'question-live SÍ está declarado: el shell respeta skipResultScreen y no pinta nada');
  ok('runFreeformPlayer: ROJO (crossword) pinta igual → VERDE (question-live) se salta la estándar');
}

// ── 3. CONTRA-PRUEBA: el camino legítimo (title/after propios) sigue vivo ───
{
  // Una plantilla NO declarada puede seguir AÑADIENDO encima de la estándar
  // (title/icon/after) — lo que no puede es SUSTITUIRLA. Verificamos que ese
  // camino (sin skipResultScreen) sigue pintando lo que la plantilla pide.
  const root = makeRoot();
  const ctx = runFreeformPlayer(root, { id: 'cw2', template: 'crossword', scoring: {} }, { mode: 'solo' });
  ctx.finish({
    score: 8, maxScore: 8,
    title: '¡Crucigrama completado!',
    stats: '8 / 8 palabras encontradas',
    after: '<p id="extra">revisión</p>',
  });
  assert.ok(root.innerHTML.includes('¡Crucigrama completado!'), 'el title propio de la plantilla se respeta');
  assert.ok(root.innerHTML.includes('8 / 8 palabras encontradas'), 'los stats propios se respetan');
  assert.ok(root.innerHTML.includes('id="extra"'), 'el after HTML extra se respeta (no es skipResultScreen)');
  ok('contra-prueba: sin skipResultScreen, title/stats/after propios de la plantilla se pintan tal cual');
}

console.log(`\nfinPropio.test: ${passed} checks passed`);
