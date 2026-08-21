// Presentation-layer tests. Lock the invariant that caused the recurring
// "theme leaks onto the whole page" bug: a SCOPED apply (an embed frame, a
// thumbnail, the editor preview) must NEVER touch <body>, and a global apply
// must theme <body> only. Also covers applyScene's lifecycle teardown.
// Run: node tests/presentation.test.mjs
import assert from 'node:assert';
import { applyScene, resetScene, sceneToggle } from '../core/presentation.js';
import { BACKGROUNDS } from '../core/backgrounds.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Minimal DOM shim: just the surface skins.js / backgrounds.js touch.
function makeClassList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)),
    remove: (...c) => c.forEach(x => s.delete(x)),
    contains: (x) => s.has(x),
  };
}
const makeEl = () => ({ classList: makeClassList(), style: { setProperty() {}, removeProperty() {} } });

global.document = { body: makeEl(), documentElement: makeEl() };
// El fondo de la prueba se DESCUBRE del catálogo: cablearlo ('stars') hacía que
// retirar un fondo de la apariencia tumbara esta suite por un figurante, no por
// una regla rota.
const BG = Object.keys(BACKGROUNDS).find(k => k !== 'none' && k !== 'custom');
const act = { presentation: { skin: 'jungle', background: BG } };

// ── Global apply themes <body> ───────────────────────────────────────────────
{
  applyScene(act, null);
  assert.ok(document.body.classList.contains('skin-jungle'), 'body gets the skin');
  assert.ok(document.body.classList.contains(`bg-${BG}`), 'body gets the background');
  ok('applyScene(activity) themes the page (body)');
}

// ── resetScene restores neutral chrome ───────────────────────────────────────
{
  resetScene();
  assert.ok(document.body.classList.contains('skin-default'), 'skin back to default');
  assert.ok(document.body.classList.contains('bg-none'), 'background back to none');
  assert.ok(!document.body.classList.contains('skin-jungle'), 'old skin removed');
  assert.ok(!document.body.classList.contains(`bg-${BG}`), 'old background removed');
  ok('resetScene() restores neutral skin + background on the page');
}

// ── THE INVARIANT: a scoped apply must not leak onto <body> ───────────────────
{
  const frame = makeEl();
  applyScene(act, null, { target: frame });
  assert.ok(frame.classList.contains('skin-jungle'), 'frame gets the skin');
  assert.ok(frame.classList.contains(`bg-${BG}`), 'frame gets the background');
  // Body stays exactly as resetScene left it — no leak.
  assert.ok(document.body.classList.contains('skin-default'), 'body skin untouched');
  assert.ok(document.body.classList.contains('bg-none'), 'body background untouched');
  assert.ok(!document.body.classList.contains('skin-jungle'), 'NO skin leak to body');
  assert.ok(!document.body.classList.contains(`bg-${BG}`), 'NO background leak to body');
  ok('scoped applyScene paints only the target — never leaks onto the page');
}

// ── UN FONDO RETIRADO NO ROMPE LA ACTIVIDAD DE NADIE (§24) ──────────────────
// El contenido es del usuario: si mañana se retira un fondo de la apariencia
// (Pizarra, Papel y Estrellado se retiraron en v1.51.567), las actividades que
// ya lo tenían guardado siguen abriéndose — caen al lienzo del tema, sin clase
// muerta ni pantalla en blanco. Es lo que permite retirar un fondo sin escribir
// una migración, así que se comprueba en vez de darse por hecho.
{
  resetScene();
  applyScene({ presentation: { skin: 'jungle', background: 'un-fondo-que-ya-no-existe' } }, null);
  assert.ok(document.body.classList.contains('skin-jungle'), 'el tema guardado sigue aplicándose');
  assert.ok(document.body.classList.contains('bg-none'), 'el fondo retirado cae a none (el lienzo del tema)');
  assert.ok(!document.body.classList.contains('bg-un-fondo-que-ya-no-existe'), 'no queda una clase muerta pegada');
  ok('un fondo retirado del catálogo no rompe las actividades que lo tenían (§24)');
}

// ── Lifecycle: ctx teardown auto-restores neutral chrome ─────────────────────
{
  const disposers = [];
  const ctx = { add: (fn) => disposers.push(fn) };
  applyScene(act, ctx);
  assert.ok(document.body.classList.contains('skin-jungle'), 'page themed on enter');
  disposers.forEach(d => d());
  assert.ok(document.body.classList.contains('skin-default'), 'skin reset on teardown');
  assert.ok(document.body.classList.contains('bg-none'), 'background reset on teardown');
  ok('applyScene(activity, ctx) restores neutral chrome on lifecycle teardown');
}

// ── Fallback skin is honored when the activity has none ───────────────────────
{
  resetScene();
  applyScene({ presentation: {} }, null, { defaultSkin: 'kahoot' });
  assert.ok(document.body.classList.contains('skin-kahoot'), 'falls back to kahoot');
  resetScene();
  ok('applyScene uses defaultSkin when the activity has no skin');
}

// ── sceneToggle: escena por fase (compartido por hostLive/studentLive) ────────
{
  const scene = sceneToggle(act);
  scene(true);
  assert.ok(document.body.classList.contains('skin-jungle'), 'juego → skin de la actividad');
  scene(false);
  assert.ok(document.body.classList.contains('skin-default'), 'chrome → neutro');
  assert.ok(!document.body.classList.contains('skin-jungle'), 'skin del juego retirado');
  scene(false);   // repaint de la misma fase → no-op (short-circuit)
  scene(true);
  assert.ok(document.body.classList.contains('skin-jungle'), 'vuelve al juego');
  // sin skin en la actividad → cae al default kahoot (mismo default que el live)
  resetScene();
  const scene2 = sceneToggle({ presentation: {} });
  scene2(true);
  assert.ok(document.body.classList.contains('skin-kahoot'), 'default kahoot');
  resetScene();
  ok('sceneToggle: aplica solo en juego, resetea en chrome, default kahoot');
}

delete global.document;
console.log(`\npresentation.test: ${passed} checks passed`);
