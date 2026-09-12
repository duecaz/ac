// EL COLAPSO DE LAYOUT TRAS `fullscreenchange` (Chrome 123 Android) — EJECUTABLE.
//
// Medido en el aparato (Android 13 · RK3588 · viewport CSS 1280x720 en pantalla
// completa · Chrome 123.0.6312.40): al entrar/salir/volver a entrar, el marco y
// el escenario medían 1280x720 y el CONTENIDO ya existente quedaba en 0x0 → la
// actividad en blanco salvo el botón de salir. Reinsertar el MISMO nodo en su
// misma posición fuerza la invalidación de layout y todo reaparece.
//
// Aquí se prueba el reparador con un DOM de mentira (las suites corren bajo Node
// sin DOM) porque Playwright moderno NO reproduce el bug: la red que queda es
// esta. Lo que se vigila es que repare el caso real, que NO toque nada más, y
// que el flujo legítimo (sin colapso) salga indemne.
//
// Run: node tests/fullscreenColapso.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// `core/fullscreenRepair.js` nombra `document` al cargarse (el vigilante).
// Se guarda lo que hubiera para devolverlo al final: el runner comparte proceso
// y los mocks de addEventListener no deben llegar a la suite siguiente.
const documentoAnterior = global.document;
global.document = { fullscreenElement: null, webkitFullscreenElement: null, documentElement: {} };
const { repararColapso, vigilarColapsoFullscreen } =
  await import('../core/fullscreenRepair.js');

// ── DOM de mentira: lo justo que toca el reparador ───────────────────────────
let idSeq = 0;
/** @param {object} [attrs] */
function nodo(attrs = {}) {
  const n = {
    marca: `n${++idSeq}`,
    nodeType: 1,
    attrs: { ...(attrs.attrs || {}) },
    style: attrs.style || {},
    w: attrs.w ?? 100, h: attrs.h ?? 100,
    children: [],
    parent: null,
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    get nextSibling() {
      if (!this.parent) return null;
      const i = this.parent.children.indexOf(this);
      return this.parent.children[i + 1] || null;
    },
    remove() {
      if (!this.parent) return;
      const i = this.parent.children.indexOf(this);
      if (i >= 0) this.parent.children.splice(i, 1);
      this.parent = null;
    },
    insertBefore(hijo, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i >= 0) this.children.splice(i, 0, hijo); else this.children.push(hijo);
      hijo.parent = this;
      return hijo;
    },
    append(...hijos) { for (const h of hijos) this.insertBefore(h, null); return this; }
  };
  return n;
}
const medir = (el) => ({ w: el.w, h: el.h });
const esVisible = (el) => el.nodeType === 1 && !el.hasAttribute('hidden')
  && el.style.display !== 'none' && el.style.visibility !== 'hidden';
const marcas = (p) => p.children.map(c => c.marca);

// ── 1. EL CASO REAL: padre con tamaño + hijo visible a 0x0 ───────────────────
{
  const widget = nodo({ w: 1280, h: 720 });
  const antes = nodo({ w: 40, h: 20 });          // un hermano cualquiera, con tamaño
  const wrap = nodo({ w: 0, h: 0 });             // el `.vs-wrap` colapsado
  const despues = nodo({ w: 40, h: 20 });
  widget.append(antes, wrap, despues);
  const orden = marcas(widget);
  const identidad = wrap;

  const reparados = repararColapso(widget, { esVisible, medir });

  assert.deepStrictEqual(reparados, [wrap], 'repara exactamente el hijo colapsado');
  assert.strictEqual(widget.children[1], identidad,
    'se reinserta EL MISMO nodo (misma identidad: conserva listeners, estado y contenido)');
  assert.deepStrictEqual(marcas(widget), orden, 'no cambia el orden entre hermanos');
  assert.strictEqual(widget.children.length, 3, 'no se duplica el nodo');
  ok('padre 1280x720 + hijo visible 0x0 → reinserta el MISMO nodo en la MISMA posición');
}

// ── 2. Un hijo con tamaño normal NO se toca ──────────────────────────────────
{
  const widget = nodo({ w: 1280, h: 720 });
  const sano = nodo({ w: 1280, h: 666 });
  widget.append(sano);
  let movido = 0;
  sano.remove = () => { movido++; };

  assert.deepStrictEqual(repararColapso(widget, { esVisible, medir }), [], 'nada que reparar');
  assert.strictEqual(movido, 0, 'no se toca un hijo que ya tiene layout');
  ok('un hijo con tamaño normal NO se toca');
}

// ── 3. `hidden` y `display:none` NO se tocan (ocultar es lo que se pidió) ─────
{
  // El carril `#ww-solo-anim` nace `hidden` y mide 0x0 a propósito.
  const widget = nodo({ w: 1280, h: 720 });
  const oculto = nodo({ w: 0, h: 0, attrs: { hidden: '' } });
  const apagado = nodo({ w: 0, h: 0, style: { display: 'none' } });
  const invisible = nodo({ w: 0, h: 0, style: { visibility: 'hidden' } });
  widget.append(oculto, apagado, invisible);
  const orden = marcas(widget);

  assert.deepStrictEqual(repararColapso(widget, { esVisible, medir }), [],
    'lo oculto a propósito no es un colapso');
  assert.deepStrictEqual(marcas(widget), orden, 'siguen donde estaban, en el mismo orden');
  ok('`hidden` / `display:none` / `visibility:hidden` NO se tocan');
}

// ── 4. Si el PADRE no tiene tamaño, no hay bug que reparar ───────────────────
{
  // Antes de montar, o con el marco plegado, TODO mide 0x0: reinsertar ahí sería
  // mover nodos sin motivo. La detección es "el padre tiene tamaño y el
  // contenido visible quedó 0x0", las dos mitades.
  const widget = nodo({ w: 0, h: 0 });
  const hijo = nodo({ w: 0, h: 0 });
  widget.append(hijo);
  assert.deepStrictEqual(repararColapso(widget, { esVisible, medir }), [],
    'padre sin tamaño → no se toca nada');
  assert.deepStrictEqual(repararColapso(null, { esVisible, medir }), [], 'sin widget tampoco rompe');
  ok('padre sin tamaño (o sin widget) → no se mueve nada');
}

// ── 5. Repetir la comprobación es IDEMPOTENTE ────────────────────────────────
{
  // El vigilante mira varias veces por cambio (doble rAF + 50/150/300 ms): en
  // cuanto un nodo recupera tamaño no se vuelve a tocar.
  const widget = nodo({ w: 1280, h: 720 });
  const wrap = nodo({ w: 0, h: 0 });
  widget.append(wrap);
  // La reinserción "arregla" el layout, igual que en el aparato.
  const medirSanando = (el) => { const m = { w: el.w, h: el.h }; if (el === wrap) { el.w = 1280; el.h = 720; } return m; };
  const r1 = repararColapso(widget, { esVisible, medir: medirSanando });
  const r2 = repararColapso(widget, { esVisible, medir });
  const r3 = repararColapso(widget, { esVisible, medir });
  assert.deepStrictEqual(r1, [wrap], 'la primera pasada repara');
  assert.deepStrictEqual(r2, [], 'la segunda ya no toca nada');
  assert.deepStrictEqual(r3, [], 'ni la tercera');
  assert.strictEqual(widget.children.length, 1, 'sigue habiendo UN hijo (no se duplicó)');
  ok('comprobaciones repetidas son idempotentes: reparado = no se vuelve a tocar');
}

// ── 6. CONTRA-PRUEBA: el flujo legítimo (Chrome moderno) no toca NADA ────────
{
  // Entrar → salir → entrar → salir → entrar, cinco cambios, todo con tamaño:
  // cero reinserciones. Si esta prueba falla, el arreglo está moviendo nodos de
  // un navegador sano (y con ello listeners, foco y animaciones).
  const widget = nodo({ w: 1280, h: 720 });
  const arena = nodo({ w: 1280, h: 720 });
  const barra = nodo({ w: 1280, h: 54 });
  widget.append(arena, barra);
  const orden = marcas(widget);
  let tocados = 0;
  const reparar = (w) => { const r = repararColapso(w, { esVisible, medir }); tocados += r.length; return r; };

  /** @type {Array<() => void>} */
  const oyentes = [];
  global.document.addEventListener = (tipo, cb) => { if (tipo === 'fullscreenchange') oyentes.push(cb); };
  global.document.removeEventListener = (tipo, cb) => {
    const i = oyentes.indexOf(cb); if (i >= 0) oyentes.splice(i, 1);
  };
  const pendientes = [];
  const soltar = vigilarColapsoFullscreen(widget, widget, {
    reparar,
    enFrame: (cb) => cb(),
    temporizar: (cb) => { pendientes.push(cb); return pendientes.length; },
    cancelar: () => {}
  });
  for (let i = 0; i < 5; i++) for (const cb of [...oyentes]) cb();   // entrar/salir ×5
  while (pendientes.length) (pendientes.shift())();                  // los 50/150/300 ms

  assert.strictEqual(tocados, 0, 'sin colapso no se reinserta nada');
  assert.deepStrictEqual(marcas(widget), orden, 'el árbol queda exactamente igual');
  soltar();
  assert.strictEqual(oyentes.length, 0, 'el disposer suelta el oyente de `fullscreenchange` (§23)');
  ok('CONTRA-PRUEBA: entrar/salir ×5 en un navegador sano → cero reinserciones y el oyente se suelta');
}

// ── 7. El vigilante repara de verdad cuando SÍ hay colapso ───────────────────
{
  const widget = nodo({ w: 1280, h: 720 });
  const wrap = nodo({ w: 0, h: 0 });
  widget.append(wrap);
  const oyentes = [];
  global.document.addEventListener = (tipo, cb) => { if (tipo === 'fullscreenchange') oyentes.push(cb); };
  global.document.removeEventListener = () => {};
  const pendientes = [];
  const opciones = {
    reparar: (w) => repararColapso(w, { esVisible, medir }),
    enFrame: (cb) => cb(),
    temporizar: (cb) => { pendientes.push(cb); return pendientes.length; },
    cancelar: () => {}
  };
  // El contenedor se declara por SELECTOR y se resuelve en cada comprobación
  // (la vista puede repintar su escenario): el marco de mentira lo sabe buscar.
  const marco = { matches: () => false, querySelector: (sel) => (sel === '#escenario' ? widget : null) };
  const soltar = vigilarColapsoFullscreen(/** @type {Element} */ (/** @type {unknown} */ (marco)), '#escenario', opciones);
  const identidad = wrap;
  for (const cb of [...oyentes]) cb();
  assert.strictEqual(widget.children[0], identidad, 'tras el cambio el nodo sigue siendo el mismo');
  assert.strictEqual(widget.children.length, 1, 'y sigue siendo uno');
  soltar();
  ok('el vigilante engancha la reparación a `fullscreenchange` (entrar y salir) y resuelve el contenedor por selector');
}

global.document = documentoAnterior;
console.log(`\nfullscreenColapso.test: ${passed} checks passed`);
