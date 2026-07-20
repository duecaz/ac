// Delegación de eventos + limpieza en el cambio de ruta.
// Bloquea la regresión que causó "mount: root not found" al cambiar el color de
// un quiz en el editor: los handlers delegados del player (.skin-pick/.bg-pick,
// sobre la raíz compartida #app) sobrevivían al innerHTML del editor y disparaban
// con las mismas clases del editor → montaje contra #ww-player-widget inexistente
// + el fondo saltaba a <body>. clearListeners() los suelta en cada navegación.
// Run: node tests/events.test.mjs
import assert from 'node:assert';
import { on, clearListeners } from '../core/events.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// DOM mínimo: solo la superficie que toca on()/clearListeners.
function makeRoot() {
  const map = new Map(); // ev -> Set<fn>
  return {
    contains: () => true,
    addEventListener(ev, fn) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(fn); },
    removeEventListener(ev, fn) { map.get(ev)?.delete(fn); },
    dispatch(ev, target) { for (const fn of [...(map.get(ev) || [])]) fn({ target }); },
    _count(ev) { return map.get(ev)?.size || 0; },
  };
}
// e.target.closest(sel) → un "elemento" truthy; root.contains() ya devuelve true.
const clickOn = (root, sel) => root.dispatch('click', { closest: (s) => (s === sel ? {} : null) });

// ── on() dispara el handler delegado ─────────────────────────────────────────
{
  const root = makeRoot();
  let fired = 0;
  on(root, 'click', '.skin-pick', () => { fired++; });
  clickOn(root, '.skin-pick');
  assert.equal(fired, 1, 'el handler delegado dispara una vez');
  ok('on() dispara el handler delegado');
}

// ── clearListeners() suelta TODO handler de esa raíz ─────────────────────────
{
  const root = makeRoot();
  let skin = 0, bg = 0;
  on(root, 'click', '.skin-pick', () => { skin++; });
  on(root, 'click', '.bg-pick', () => { bg++; });
  assert.equal(root._count('click'), 2, 'dos handlers click registrados');
  clearListeners(root);
  assert.equal(root._count('click'), 0, 'clearListeners quita los listeners del DOM');
  clickOn(root, '.skin-pick');
  clickOn(root, '.bg-pick');
  assert.equal(skin, 0, 'el handler .skin-pick NO dispara tras clear (no más "mount: root not found")');
  assert.equal(bg, 0, 'el handler .bg-pick NO dispara tras clear (el fondo ya no salta a <body>)');
  ok('clearListeners() suelta todos los handlers delegados de la raíz');
}

// ── Escenario real: player deja handlers → navegar limpia → editor sano ──────
{
  const app = makeRoot(); // raíz compartida #app (estable entre vistas)
  let playerSkinFired = 0;
  // El player registra su picker de tema sobre #app.
  on(app, 'click', '.skin-pick', () => { playerSkinFired++; });
  // Cambio de ruta al editor: el hook del router suelta los handlers previos.
  clearListeners(app);
  // El editor pinta sus propios .skin-pick (mismas clases). Un clic NO debe
  // reactivar el handler del player.
  clickOn(app, '.skin-pick');
  assert.equal(playerSkinFired, 0, 'el handler del player no sobrevive a la navegación al editor');
  // Y un handler nuevo registrado tras el clear SÍ funciona.
  let fresh = 0;
  on(app, 'click', '.skin-pick', () => { fresh++; });
  clickOn(app, '.skin-pick');
  assert.equal(fresh, 1, 'un handler registrado tras clear dispara con normalidad');
  ok('navegación player→editor: sin fuga de handlers, la vista nueva funciona');
}

// ── clearListeners es tolerante a raíces desconocidas/ausentes ───────────────
{
  clearListeners(makeRoot());     // sin handlers → no-op
  clearListeners(null);           // nada que hacer
  ok('clearListeners tolera raíces sin handlers o nulas');
}

console.log(`\nevents.test: ${passed} checks passed`);
