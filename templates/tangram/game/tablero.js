// EL TABLERO del tangram — las 7 piezas pintadas en un <svg> y los gestos que
// las mueven. Es UNO (§21b) porque lo necesitan exactamente igual el PLAYER
// (el alumno cubre la silueta) y el EDITOR (el docente ARMA la silueta): antes
// vivía dentro de player.js y el editor lo habría copiado línea a línea.
//
// Gestos de UN dedo con Pointer Events:
//   - arrastrar mueve la pieza;
//   - TOCAR (sin arrastrar) la gira 45°;
//   - DOBLE TOQUE la voltea (solo se ve distinto en el paralelogramo).
// El doble toque se detecta por TIEMPO entre dos toques de la MISMA pieza con
// `performance.now()` en el propio handler: es el único reloj del proyecto
// pensado para medir "cuánto pasó desde el evento anterior" dentro de un
// gesto (core/deadlineTicker.js resuelve "cuánto falta hasta un instante", no
// esto), así que aquí no aplica ningún primitivo de core/reloj — se anota
// para que quede claro que no es un `setInterval` a pelo (§23 no lo prohíbe:
// prohíbe temporizadores RECURRENTES sin guard, esto es una resta puntual).
//
// Qué NO decide el tablero: qué pasa después de soltar. Eso lo pone quien lo
// monta en `onCambio` (el player comprueba «resuelto»; el editor guarda y
// repinta la unión). Las colocaciones se MUTAN en el propio array que llega:
// es el estado del que monta, el tablero solo lo mueve.
import { capturarPuntero } from '../../../core/events.js';
import { PIEZAS } from './piezas.js';
import { imantar, transformarEnSitio } from './geometria.js';

const TOQUE_MAX_MS = 300;      // por debajo de esto, sin desplazamiento, es un TOQUE
// CUÁNTO PUEDE TEMBLAR UN DEDO sin que deje de ser un toque: 12 px de PANTALLA.
// Iba en fracción del contenido (0,06) y el contenido incluye la bandeja, así
// que en el player salían 75 px: cualquier ajuste fino —mover una pieza media
// pieza para encajarla— se leía como TOQUE y la pieza giraba. Medido con el
// tablero montado (451 px por unidad): 20 y 40 px giraban en vez de mover.
// Un umbral de gesto es del DEDO, no del dibujo: va en píxeles.
const TOQUE_MAX_PX = 12;
const DOBLE_TOQUE_MS = 400;    // ventana entre dos toques de la MISMA pieza

/** @param {import('./piezas.js').Punto[]} p @returns {string} el atributo `points` */
const puntosAttr = (p) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Los polígonos de una silueta como <polygon>s (sin estilo: lo pone el CSS
 *  del grupo que los contenga). Lo comparten el player (la pista gris) y el
 *  editor (la unión que ve el docente y las miniaturas de partida).
 *  @param {import('./piezas.js').Punto[][]} poligonos @returns {string} */
export function siluetaHtml(poligonos) {
  return poligonos.map(p => `<polygon points="${puntosAttr(p)}" />`).join('');
}

/** El `transform` de una pieza: el MISMO {x,y,rot,flip} que usa la geometría,
 *  así el dibujo y el cálculo de «resuelto» no pueden desincronizarse.
 *  @param {Colocacion} c @returns {string} */
const transformDe = (c) => `translate(${c.x},${c.y}) rotate(${c.rot}) ${c.flip ? 'scale(1,-1)' : ''}`;

/**
 * @typedef {import('./geometria.js').Colocacion} Colocacion
 * @typedef {import('./geometria.js').Caja} Caja
 */
/**
 * @typedef {Object} OpcionesTablero
 * @property {Colocacion[]} colocaciones  dónde está cada pieza; el tablero las MUTA
 * @property {() => void} onCambio        tras cada gesto que cambia una colocación (ya imantada)
 * @property {Caja} [limites]             si se da, el origen de una pieza soltada no sale de esta caja
 */
/**
 * @typedef {Object} Tablero
 * @property {() => void} pintar    repinta las 7 piezas desde las colocaciones
 * @property {() => void} destruir  quita los gestos (el dibujo se queda)
 */

/**
 * Monta las piezas en `capa` (un <g> dentro de `svg`) y cablea los gestos.
 * @param {SVGSVGElement} svg
 * @param {Element} capa
 * @param {OpcionesTablero} o
 * @returns {Tablero}
 */
export function montarTablero(svg, capa, { colocaciones, onCambio, limites }) {
  let orden = colocaciones.map(c => c.pieza);   // orden de pintado = quién está "encima"

  /** @param {string} n @returns {Colocacion|undefined} */
  const de = (n) => colocaciones.find(c => c.pieza === n);

  /** @param {number} clientX @param {number} clientY @returns {{x: number, y: number}} */
  function puntoSvg(clientX, clientY) {
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const t = p.matrixTransform(m.inverse());
    return { x: t.x, y: t.y };
  }

  /** Repinta las 7 piezas enteras. Se llama al montar, al soltar y cuando el
   *  que monta cambia las colocaciones por fuera (cargar una figura). */
  function pintar() {
    capa.innerHTML = orden.map(n => {
      const pieza = PIEZAS[n];
      const c = de(n);
      if (!pieza || !c) return '';
      return `<g class="ta-pieza" data-pieza="${n}" transform="${transformDe(c)}">`
        + `<polygon points="${puntosAttr(pieza.puntos)}" fill="${pieza.color}" />`
        + `</g>`;
    }).join('');
  }
  pintar();

  /** Mueve UNA pieza ya pintada: en el arrastre se llama por cada movimiento
   *  del puntero y reconstruir las 7 con `innerHTML` a 60-120 Hz era el
   *  presupuesto entero del cuadro en la pizarra lenta.
   *  @param {string} n @returns {void} */
  function moverPieza(n) {
    const c = de(n), g = capa.querySelector(`.ta-pieza[data-pieza="${n}"]`);
    if (c && g) g.setAttribute('transform', transformDe(c));
  }

  /** La pieza tocada pasa a pintarse la última (encima): se MUEVE su nodo, no
   *  se reconstruye la capa. @param {string} n @returns {void} */
  function traerAlFrente(n) {
    orden = orden.filter(x => x !== n);
    orden.push(n);
    const g = capa.querySelector(`.ta-pieza[data-pieza="${n}"]`);
    if (g) capa.appendChild(g);
  }

  /** Una pieza soltada fuera de los límites vuelve al borde: en el editor
   *  el tablero es finito y una pieza perdida fuera del viewBox no se puede
   *  recuperar. @param {Colocacion} c @returns {Colocacion} */
  function acotar(c) {
    if (!limites) return c;
    return {
      ...c,
      x: Math.min(limites.maxx, Math.max(limites.minx, c.x)),
      y: Math.min(limites.maxy, Math.max(limites.miny, c.y)),
    };
  }

  // --- Gestos: un puntero activo a la vez (pizarra/tablet, un dedo). ---
  /** @type {{activo: number|null, piezaId: string|null, inicioX: number, inicioY: number,
   *           origX: number, origY: number, t0: number, movido: boolean}} */
  const gesto = { activo: null, piezaId: null, inicioX: 0, inicioY: 0, origX: 0, origY: 0, t0: 0, movido: false };
  /** @type {{piezaId: string|null, t: number}} */
  let ultimoToque = { piezaId: null, t: 0 };

  /** @param {PointerEvent} e @returns {void} */
  function onDown(e) {
    const destino = /** @type {Element|null} */ (e.target);
    const g = /** @type {SVGElement|null} */ (destino?.closest('.ta-pieza') ?? null);
    if (!g || gesto.activo != null) return;
    const n = g.dataset.pieza;
    const c = n ? de(n) : undefined;
    if (!n || !c) return;
    const p = puntoSvg(e.clientX, e.clientY);
    gesto.activo = e.pointerId;
    gesto.piezaId = n;
    gesto.inicioX = p.x; gesto.inicioY = p.y;
    gesto.origX = c.x; gesto.origY = c.y;
    gesto.t0 = performance.now();
    gesto.movido = false;
    traerAlFrente(n);
    capturarPuntero(svg, e.pointerId);
  }

  /** @param {PointerEvent} e @returns {void} */
  function onMove(e) {
    if (gesto.activo !== e.pointerId || !gesto.piezaId) return;
    const p = puntoSvg(e.clientX, e.clientY);
    const dx = p.x - gesto.inicioX, dy = p.y - gesto.inicioY;
    // El umbral se mide en píxeles de pantalla y se traduce a unidades con la
    // escala REAL del SVG (cambia con la ventana y con pantalla completa).
    const m = svg.getScreenCTM();
    const porUnidad = m ? Math.hypot(m.a, m.b) : 1;
    const umbral = TOQUE_MAX_PX / (porUnidad || 1);
    if (!gesto.movido && Math.hypot(dx, dy) < umbral) return;
    gesto.movido = true;
    const c = de(gesto.piezaId);
    if (!c) return;
    c.x = gesto.origX + dx;
    c.y = gesto.origY + dy;
    moverPieza(gesto.piezaId);
    if (e.cancelable) e.preventDefault();
  }

  /** @param {PointerEvent} e @returns {void} */
  function onUp(e) {
    if (gesto.activo !== e.pointerId || !gesto.piezaId) { gesto.activo = null; return; }
    const n = gesto.piezaId;
    const c = de(n);
    const duracion = performance.now() - gesto.t0;
    let cambio = false;
    if (c && gesto.movido) {
      // ARRASTRE: imán de posición Y rotación al soltar (§ enunciado). Se
      // muta la MISMA colocación (es el estado del que monta).
      Object.assign(c, acotar(imantar(c)));
      cambio = true;
    } else if (c && duracion <= TOQUE_MAX_MS) {
      // TOQUE: gira 45° SIN MOVERSE DEL SITIO. El giro guardado es sobre el
      // origen de la pieza (su vértice), así que girar a secas la mandaba a
      // varios lados de distancia del dedo; `transformarEnSitio` compensa la
      // traslación para que el centro se quede donde está. Si es el SEGUNDO
      // toque de esta pieza dentro de la ventana, además voltea (la
      // comprobación de «resuelto» sigue siendo UNA, tras aplicar ambos).
      const ahora = performance.now();
      const dobleToque = ultimoToque.piezaId === n && (ahora - ultimoToque.t) <= DOBLE_TOQUE_MS;
      Object.assign(c, transformarEnSitio(c, {
        rot: (c.rot + 45) % 360,
        ...(dobleToque ? { flip: !c.flip } : {}),
      }));
      ultimoToque = dobleToque ? { piezaId: null, t: 0 } : { piezaId: n, t: ahora };
      cambio = true;
    }
    gesto.activo = null;
    gesto.piezaId = null;
    moverPieza(n);
    if (cambio) onCambio();
  }

  /** @returns {void} */
  function onCancel() { gesto.activo = null; gesto.piezaId = null; }

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onCancel);

  function destruir() {
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerup', onUp);
    svg.removeEventListener('pointercancel', onCancel);
  }

  return { pintar, destruir };
}
