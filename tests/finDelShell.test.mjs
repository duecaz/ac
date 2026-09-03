// EL FINAL DE LA PARTIDA LO PONE EL SHELL — sin salida.
//
// Medido el 2026-09-04 montando las 13: once terminaban con la pantalla
// estándar, el Crucigrama con un cartel propio que dejaba al alumno sin
// puntaje ni «otra vez», y Abre Cajas con un `skipResultScreen: true` suelto.
// Hubo un mapa de excepciones con motivo durante un día; el dueño lo cerró
// («todos deben seguir las reglas a rajatabla»). Esta suite fija las dos
// mitades de la regla EJECUTANDO el shell real:
//   · pedir saltarse la estándar NO hace nada (la opción no existe);
//   · añadir encima (title/stats/after) SÍ sigue vivo — la contra-prueba.
import assert from 'node:assert/strict';
import { runFreeformPlayer } from '../core/soloPlayer.js';

const ok = (m) => console.log(`  ✓ ${m}`);
// Elemento mínimo para mount(): el mismo stub que tests/soloPlayer.test.mjs.
const makeRoot = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });

// ── 1. Pedir saltársela no sirve de nada: la estándar se pinta igual ────────
{
  const root = makeRoot();
  const ctx = runFreeformPlayer(root, { id: 'cw1', template: 'crossword', scoring: {} }, { mode: 'solo' });
  const r = ctx.finish({ score: 3, maxScore: 8, skipResultScreen: true });
  assert.notEqual(root.innerHTML, '', 'aunque el player pida saltársela, el shell pinta la pantalla estándar');
  assert.ok(root.innerHTML.includes('data-ww-replay'), 'es la estándar (trae «Jugar otra vez»), no un vacío casual');
  assert.equal(r.score, 3, 'y devuelve lo calculado, por si el `after` quiere citarlo');
  ok('runFreeformPlayer: `skipResultScreen` no existe — se pinta la estándar igual');
}

// ── 2. CONTRA-PRUEBA: añadir encima sigue vivo ─────────────────────────────
{
  const root = makeRoot();
  const ctx = runFreeformPlayer(root, { id: 'ql1', template: 'question-live', scoring: {} }, { mode: 'solo' });
  ctx.finish({ score: 6, maxScore: 6, title: '¡Todas las cajas abiertas!', stats: '6 / 6 cajas', after: '<p data-after>x</p>' });
  assert.ok(root.innerHTML.includes('¡Todas las cajas abiertas!'), 'el título propio se AÑADE sobre la estándar');
  assert.ok(root.innerHTML.includes('6 / 6 cajas'), 'los stats propios también');
  assert.ok(root.innerHTML.includes('data-after'), 'y el `after` va debajo');
  assert.ok(root.innerHTML.includes('data-ww-replay'), 'sin perder el «otra vez» de la estándar');
  ok('la plantilla AÑADE (title/stats/after) y la estándar sigue debajo');
}

console.log('\nfinDelShell.test: 2 checks passed');
