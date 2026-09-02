// EL FOCO VUELVE AL DISPARADOR (core/modalFallback.js) — EJECUTABLE.
//
// Hallazgo de matrix-smoke (red B7, v1.51.610): Escape ya cerraba el modal de
// «buscar imagen»/«escribir con IA» (bootstrap.Modal lo hace solo; el
// respaldo sin bootstrap, con su propio listener), pero el foco se quedaba
// en ningún sitio — el profe tenía que volver a buscar el botón con el
// ratón. Se comprueba con un DOM de juguete (patrón de tests/menu.test.mjs):
// el disparador se guarda al ABRIR y se le devuelve el foco al CERRAR, tanto
// si cierra el respaldo a mano como si cierra un bootstrap.Modal de verdad
// (mismo evento `hidden.bs.modal` en los dos caminos).
//
// Run: node tests/modalFallback.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

function nodo(cls = '') {
  const n = {
    className: cls, style: {}, classList: {
      _s: new Set(cls.split(' ').filter(Boolean)),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    listeners: {},
    addEventListener(t, f) { (n.listeners[t] ||= []).push(f); },
    dispatchEvent(ev) { for (const f of (n.listeners[ev.type] || [])) f(ev); return true; },
    remove() {},
  };
  return n;
}

const { abrirDialogoConFallback } = await import('../core/modalFallback.js');

// ── 1. SIN bootstrap cargado (la sonda headless: la CDN no se alcanza) ─────
{
  const disparador = { foco: 0, focus() { this.foco++; } };
  global.document = {
    activeElement: disparador, body: { appendChild() {}, contains: () => true },
    createElement: () => nodo(),
  };
  const el = nodo('modal');
  const m = abrirDialogoConFallback(el);
  m.show();
  assert.strictEqual(disparador.foco, 0, 'abrir el modal no toca el foco todavía');

  // Escape lo cierra (el respaldo, sin bootstrap, ahora escucha keydown) …
  el.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.strictEqual(el.classList.contains('show'), false, 'Escape cierra el respaldo sin bootstrap');
  // … y devuelve el foco al botón que lo abrió.
  assert.strictEqual(disparador.foco, 1, 'y le devuelve el foco al disparador');
  ok('respaldo sin bootstrap: Escape cierra Y devuelve el foco al disparador');
  delete global.document;
}

// ── 2. CON bootstrap.Modal real (el camino de producción) ──────────────────
// bootstrap.Modal gestiona su propio Escape; aquí solo hace falta comprobar
// que el foco vuelve cuando ÉL dispara `hidden.bs.modal` (p.ej. al cerrarse
// por Escape o por el botón de cerrar).
{
  const disparador = { foco: 0, focus() { this.foco++; } };
  global.document = { activeElement: disparador, body: { contains: () => true } };
  global.bootstrap = { Modal: class { constructor(elx) { this.el = elx; } } };
  const el = nodo('modal');
  abrirDialogoConFallback(el); // no llamamos show(): el foco se capturó al invocar
  el.dispatchEvent({ type: 'hidden.bs.modal' });
  assert.strictEqual(disparador.foco, 1, 'bootstrap.Modal real: hidden.bs.modal devuelve el foco');
  ok('con bootstrap.Modal real: cerrar (hidden.bs.modal) devuelve el foco al disparador');
  delete global.document; delete global.bootstrap;
}

// ── 3. CONTRA-PRUEBA: un disparador que ya no está en el DOM no revienta ───
{
  const disparador = { foco: 0, focus() { this.foco++; throw new Error('no debería llamarse'); } };
  global.document = {
    activeElement: disparador, body: { appendChild() {}, contains: () => false },
    createElement: () => nodo(),
  };
  const el = nodo('modal');
  const m = abrirDialogoConFallback(el);
  m.show();
  assert.doesNotThrow(() => m.hide(), 'cerrar no revienta si el disparador ya no está en el DOM');
  assert.strictEqual(disparador.foco, 0, 'y no intenta enfocar un nodo desconectado');
  ok('CONTRA-PRUEBA: un disparador fuera del DOM no rompe el cierre ni se enfoca');
  delete global.document;
}

console.log(`\n  ${passed} modalFallback checks passed`);
