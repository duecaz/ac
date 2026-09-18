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
import { imantar } from './geometria.js';

const TOQUE_MAX_MS = 300;      // por debajo de esto, sin desplazamiento, es un TOQUE
const TOQUE_MAX_DIST = 0.06;   // en fracción del lado del tablero — no del cuadrado unidad fijo
const DOBLE_TOQUE_MS = 400;    // ventana entre dos toques de la MISMA pieza

/** Los polígonos de una silueta como <polygon>s (sin estilo: lo pone el CSS
 *  del grupo que los contenga). Lo comparten el player (la pista gris) y el
 *  editor (la unión que ve el docente y las miniaturas de partida).
 *  @param {import('./piezas.js').Punto[][]} poligonos @returns {string} */
export function siluetaHtml(poligonos) {
  return poligonos.map(p => `<polygon points="${p.map(([x, y]) => `${x},${y}`).join(' ')}" />`).join('');
}

/**
 * @typedef {import('./geometria.js').Colocacion} Colocacion
 * @typedef {import('./geometria.js').Caja} Caja
 */
/**
 * @typedef {Object} OpcionesTablero
 * @property {Colocacion[]} colocaciones  dónde está cada pieza; el tablero las MUTA
 * @property {number} contentW            ancho del contenido (el umbral de «toque» es una fracción)
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
export function montarTablero(svg, capa, { colocaciones, contentW, onCambio, limites }) {
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

  function pintar() {
    capa.innerHTML = orden.map(n => {
      const pieza = PIEZAS[n];
      const c = de(n);
      if (!pieza || !c) return '';
      const escala = c.flip ? 'scale(1,-1)' : '';
      const pts = pieza.puntos.map(([x, y]) => `${x},${y}`).join(' ');
      return `<g class="ta-pieza" data-pieza="${n}" transform="translate(${c.x},${c.y}) rotate(${c.rot}) ${escala}">`
        + `<polygon points="${pts}" fill="${pieza.color}" />`
        + `</g>`;
    }).join('');
  }
  pintar();

  /** @param {string} n @returns {void} */
  function traerAlFrente(n) {
    orden = orden.filter(x => x !== n);
    orden.push(n);
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

  /** @param {Colocacion} nueva @returns {void} */
  function reemplazar(nueva) {
    const i = colocaciones.findIndex(c => c.pieza === nueva.pieza);
    if (i >= 0) colocaciones[i] = nueva;
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
    pintar();
    capturarPuntero(svg, e.pointerId);
  }

  /** @param {PointerEvent} e @returns {void} */
  function onMove(e) {
    if (gesto.activo !== e.pointerId || !gesto.piezaId) return;
    const p = puntoSvg(e.clientX, e.clientY);
    const dx = p.x - gesto.inicioX, dy = p.y - gesto.inicioY;
    const umbral = contentW * TOQUE_MAX_DIST;
    if (!gesto.movido && Math.hypot(dx, dy) < umbral) return;
    gesto.movido = true;
    const c = de(gesto.piezaId);
    if (!c) return;
    c.x = gesto.origX + dx;
    c.y = gesto.origY + dy;
    pintar();
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
      // ARRASTRE: imán de posición Y rotación al soltar (§ enunciado).
      reemplazar(acotar(imantar(c)));
      cambio = true;
    } else if (c && duracion <= TOQUE_MAX_MS) {
      // TOQUE: gira 45°. Si es el SEGUNDO toque de esta pieza dentro de la
      // ventana de doble-toque, además voltea (la comprobación de "resuelto"
      // sigue siendo UNA sola, después de aplicar ambos cambios).
      c.rot = (c.rot + 45) % 360;
      const ahora = performance.now();
      if (ultimoToque.piezaId === n && (ahora - ultimoToque.t) <= DOBLE_TOQUE_MS) {
        c.flip = !c.flip;
        ultimoToque = { piezaId: null, t: 0 };   // un tercer toque rápido no encadena
      } else {
        ultimoToque = { piezaId: n, t: ahora };
      }
      cambio = true;
    }
    gesto.activo = null;
    gesto.piezaId = null;
    pintar();
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
