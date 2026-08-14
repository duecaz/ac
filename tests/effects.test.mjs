// EL CONFETI TIENE QUE VERSE — y en pantalla completa eso no es gratis.
//
// El bug (reportado por el dueño, 2026-08-14): «en Quiz solo no sale la
// animación final al ganar… antes funcionaba». El efecto NO estaba roto: se
// ejecutaba entero, con sus 160 partículas, en un canvas colgado de <body>. Lo
// que cambió fue el juego: «Iniciar» pasó a entrar SIEMPRE en pantalla completa
// sobre `#ww-frame`, y en pantalla completa el navegador solo pinta ESE
// elemento y sus hijos. El confeti se dibujaba fuera de lo visible.
//
// Es la clase de fallo que ningún test de lógica ve —el código correcto, el
// evento emitido, la función ejecutada— y que en la clase se nota entera.
// Run: node tests/effects.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── Un DOM de juguete: lo justo que toca el confeti ──────────────────────────
const nuevoNodo = (tag) => ({
  tagName: tag.toUpperCase(), style: {}, children: [], parentNode: null,
  width: 0, height: 0,
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; },
  remove() { this.parentNode = null; },
  getContext: () => new Proxy({}, { get: () => () => {} }),   // 2d: todo no-op
});

const body = nuevoNodo('body');
const marco = nuevoNodo('div');
global.document = {
  body,
  fullscreenElement: null,
  createElement: nuevoNodo,
};
global.window = { innerWidth: 1280, innerHeight: 800 };
// rAF que NO reprograma: el canvas se queda puesto y se puede inspeccionar
// (con el bucle real desaparecería solo antes de mirarlo — que es justo lo que
// despistó a la primera sonda).
global.requestAnimationFrame = () => {};
global.localStorage = { getItem: () => null, setItem: () => {} };

const { GameEvents, emitGame } = await import('../core/gameEvents.js');
const { setEffectsMuted } = await import('../core/effects.js');

const canvasDe = (padre) => padre.children.filter(n => n.tagName === 'CANVAS');

// ── Sin pantalla completa: al <body>, como siempre ───────────────────────────
{
  emitGame(GameEvents.ANSWER_CORRECT, {});
  assert.strictEqual(canvasDe(body).length, 1, 'el acierto pinta su confeti');
  body.children.length = 0;
  ok('sin pantalla completa el confeti va al <body>');
}

// ── EN pantalla completa: DENTRO del elemento, o no se ve ────────────────────
{
  document.fullscreenElement = marco;
  emitGame(GameEvents.PODIUM, {});
  assert.strictEqual(canvasDe(marco).length, 1,
    'el confeti del podio va DENTRO del elemento a pantalla completa');
  assert.strictEqual(canvasDe(body).length, 0,
    'y NO al body: ahí el navegador no lo pinta (era el bug — el efecto corría sin llegar a un solo píxel)');
  marco.children.length = 0;
  document.fullscreenElement = null;
  ok('en pantalla completa el confeti se cuelga del elemento a pantalla completa');
}

// ── CONTRA-PRUEBA: apagar los efectos los apaga de verdad ────────────────────
{
  setEffectsMuted(true);
  emitGame(GameEvents.ANSWER_CORRECT, {});
  assert.strictEqual(canvasDe(body).length, 0, 'con «Efectos: No» no se pinta nada');
  setEffectsMuted(false);
  ok('CONTRA-PRUEBA: con los efectos apagados no se pinta confeti');
}

delete global.document; delete global.window;
delete global.requestAnimationFrame; delete global.localStorage;

console.log(`\n  ${passed} effects checks passed`);
