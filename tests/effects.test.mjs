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
// rAF EN COLA: nada corre hasta que se drena a mano, así que el canvas se queda
// puesto y se puede inspeccionar (con el bucle real desaparecería solo antes de
// mirarlo — que es justo lo que despistó a la primera sonda). El último bloque
// SÍ lo drena, para comprobar que el lienzo se retira al morir el confeti.
const rafCola = [];
global.requestAnimationFrame = (cb) => rafCola.push(cb);
global.localStorage = { getItem: () => null, setItem: () => {} };

const { GameEvents, emitGame } = await import('../core/gameEvents.js');
const { setEffectsMuted } = await import('../core/effects.js');

const canvasDe = (padre) => padre.children.filter(n => n.tagName === 'CANVAS');

// ── Sin pantalla completa: al <body>, como siempre ───────────────────────────
let primerLienzo = null;
{
  emitGame(GameEvents.ANSWER_CORRECT, {});
  assert.strictEqual(canvasDe(body).length, 1, 'el acierto pinta su confeti');
  primerLienzo = canvasDe(body)[0];
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
  // UN LIENZO, NO UNO POR RÁFAGA. En el cierre del duelo coinciden tres ráfagas
  // (podio + racha + acierto): eran tres canvas a pantalla completa, tres
  // borrados y tres bucles rAF peleando por el mismo cuadro en la pizarra del
  // aula. El mismo lienzo se MUDA a la escena que toque, no se clona.
  assert.strictEqual(canvasDe(marco)[0], primerLienzo,
    'la segunda ráfaga reutiliza el lienzo de la primera (se muda, no crea otro)');
  marco.children.length = 0;
  document.fullscreenElement = null;
  ok('en pantalla completa el confeti se cuelga del elemento a pantalla completa');
}

// ── RACHA: confeti corto SOLO al cruzar 3 o 5 (hallazgo B4: 3 emisores, 0
// oyentes) ────────────────────────────────────────────────────────────────
{
  emitGame(GameEvents.STREAK, { count: 2 });
  assert.strictEqual(canvasDe(body).length, 0, 'count=2 no cruza umbral: sin confeti');
  emitGame(GameEvents.STREAK, { count: 3 });
  assert.strictEqual(canvasDe(body).length, 1, 'count=3 cruza umbral: confeti de racha');
  assert.strictEqual(canvasDe(body)[0], primerLienzo, 'y sigue siendo EL lienzo, el de siempre');
  body.children.length = 0;
  ok('STREAK dispara en el umbral (3) y no antes (2)');
}

// ── CONTRA-PRUEBA: apagar los efectos los apaga de verdad ────────────────────
{
  setEffectsMuted(true);
  emitGame(GameEvents.ANSWER_CORRECT, {});
  assert.strictEqual(canvasDe(body).length, 0, 'con «Efectos: No» no se pinta nada');
  setEffectsMuted(false);
  ok('CONTRA-PRUEBA: con los efectos apagados no se pinta confeti');
}

// ── Y CUANDO SE ACABA LA FIESTA, EL LIENZO SE VA ─────────────────────────────
// Si el canvas se quedara puesto, la sesión entera seguiría con una capa a
// pantalla completa encima (aunque no robe toques) y con un bucle rAF vivo — el
// coste en reposo que este plan persigue. Aquí el rAF SÍ avanza: se drena a
// mano hasta que el último papelito muere.
{
  assert.strictEqual(primerLienzo.parentNode, body, 'el lienzo de las ráfagas de arriba sigue puesto');
  let vueltas = 0;
  while (rafCola.length && vueltas < 1000) { (rafCola.shift())(); vueltas++; }
  assert.ok(vueltas > 10, `el bucle tiene que haber corrido de verdad (vueltas: ${vueltas})`);
  assert.strictEqual(primerLienzo.parentNode, null,
    'sin papelitos vivos el lienzo sale del DOM (nada de una capa a pantalla completa para el resto de la sesión)');
  assert.strictEqual(rafCola.length, 0, 'y el bucle rAF se para: cero coste en reposo');
  body.children.length = 0;
  ok('al morir el último papelito: el lienzo se retira y el bucle se detiene');
}

delete global.document; delete global.window;
delete global.requestAnimationFrame; delete global.localStorage;

console.log(`\n  ${passed} effects checks passed`);
