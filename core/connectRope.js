// Motor de CUERDAS SVG compartido por las actividades de conexión (Emparejar y
// Etiqueta-el-diagrama): dibujar la cuerda bezier con sombra, la línea fantasma
// del arrastre, y las coordenadas puntero↔SVG. Lo que cambia entre actividades
// (el DOM, cómo se resuelve el destino al soltar, la clave de acierto) queda en
// cada player; esto es solo el dibujo, que es idéntico y traía los bugs sutiles
// (bbox de alto 0 → sombra invisible), así que vive en un solo sitio.

import { capturarPuntero, soltarPuntero } from './events.js';

export const ROPES = ['#6366f1','#0891b2','#a855f7','#f59e0b','#0ea5e9','#ec4899','#14b8a6','#8b5cf6'];
export const OK_COL = '#16a34a', NO_COL = '#ef4444';
const SAG = 16;   // px que "cuelga" la cuerda: se ve más natural (una leve caída).

// Inyecta la capa de cuerdas UNA vez. Devuelve la capa <g> donde el caller escribe
// el innerHTML de las cuerdas.
// NOTA: ya NO se usa un filtro SVG (feDropShadow) para la sombra. Su región se
// define en % del BOUNDING BOX del trazo, y una cuerda VERTICAL (dos tarjetas
// frente a frente → mismos x) tiene bbox de ANCHO 0 → el filtro colapsaba a cero y
// la cuerda ENTERA (halo + color) desaparecía. La sombra ahora es un trazo
// desplazado (ver ropeHtml), que se pinta siempre, sea cual sea la orientación.
/**
 * @typedef {{x: number, y: number}} Punto
 */

/**
 * @param {SVGElement} svg
 * @returns {{layer: Element|null, filterId: null}}
 */
export function mountRopeLayer(svg) {
  svg.innerHTML = `<g class="ww-rope-layer"></g>`;
  return { layer: svg.querySelector('.ww-rope-layer'), filterId: null };
}

// Curva bezier entre dos puntos, con una leve caída ("sag") para un aire natural.
/**
 * @param {Punto} p1
 * @param {Punto} p2
 */
function ropeCurve(p1, p2) {
  const mx = (p1.x + p2.x) / 2;
  return `M${p1.x},${p1.y} C${mx},${p1.y + SAG} ${mx},${p2.y + SAG} ${p2.x},${p2.y}`;
}

// Una cuerda con su sombra + su color y sus dos remaches redondos. La SOMBRA es el
// mismo trazo desplazado un pelín hacia abajo (NO un filtro): así se ve en CUALQUIER
// orientación, incluida la vertical (frente a frente), donde el filtro colapsaba.
/**
 * @param {Punto} p1
 * @param {Punto} p2
 * @param {string} col
 */
export function ropeHtml(p1, p2, col) {
  const curve  = ropeCurve(p1, p2);
  const shadow = ropeCurve({ x: p1.x, y: p1.y + 2.5 }, { x: p2.x, y: p2.y + 2.5 });
  return `<path d="${shadow}" stroke="rgba(0,0,0,.22)" stroke-width="10" fill="none" stroke-linecap="round"/>`
    + `<path d="${curve}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + `<circle cx="${p1.x}" cy="${p1.y}" r="8" fill="${col}"/>`
    + `<circle cx="${p2.x}" cy="${p2.y}" r="8" fill="${col}"/>`;
}

// Línea fantasma (punteada) mientras el dedo arrastra, del ancla al puntero.
/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} cx
 * @param {number} cy
 */
export function ghostHtml(x1, y1, cx, cy) {
  const mx = (x1 + cx) / 2;
  return `<circle cx="${x1}" cy="${y1}" r="10" fill="#6366f1" opacity=".6"/>`
    + `<path d="M${x1},${y1} C${mx},${y1} ${mx},${cy} ${cx},${cy}" stroke="#6366f1" stroke-width="4.5" fill="none" stroke-dasharray="11 6" stroke-linecap="round" opacity=".75"/>`;
}

// Centro de un elemento en coordenadas del SVG.
/**
 * @param {Element} el
 * @param {Element} svg
 * @returns {Punto}
 */
export function dotPos(el, svg) {
  const er = el.getBoundingClientRect(), sr = svg.getBoundingClientRect();
  return { x: (er.left + er.right) / 2 - sr.left, y: (er.top + er.bottom) / 2 - sr.top };
}
// Punto de cliente (clientX/Y) en coordenadas del SVG. Lo usa la máquina de
// arrastre de aquí abajo; los players ya no lo necesitan (§30: sin lector fuera,
// no se exporta).
/**
 * @param {Element} svg
 * @param {number} cx
 * @param {number} cy
 * @returns {Punto}
 */
function svgPt(svg, cx, cy) {
  const sr = svg.getBoundingClientRect();
  return { x: cx - sr.left, y: cy - sr.top };
}

/** EL ARRASTRE en curso: el ancla (x1,y1) y dónde está el dedo (cx,cy), más la
 *  ficha que puso el player al agarrar (qué tarjeta / qué etiqueta).
 * @template D
 * @typedef {{pointerId: number, datos: D, x1: number, y1: number, cx: number, cy: number}} Arrastre
 */

/** LA MÁQUINA DE ARRASTRAR UNA CUERDA, una sola vez para Emparejar y para
 *  Etiqueta-el-diagrama. Las dos la tenían tecleada entera —`pointerdown` →
 *  `state.dragging` → capturar el puntero → `pointermove` con `svgPt` →
 *  `endDrag(connect)`— y lo único que de verdad cambiaba entre ellas era QUÉ se
 *  agarra y QUÉ hay donde se suelta. Eso se inyecta:
 *   · `origen(e)`        → qué se agarró: el elemento cuyo centro ancla la cuerda
 *                          y la ficha que el player quiera llevarse consigo;
 *   · `elegirDestino()`  → qué hay donde se soltó (Emparejar: rectángulos, con
 *                          la propia tarjeta = desconectar; Diagrama: el pin o
 *                          la etiqueta más cercana dentro de un radio);
 *   · `alSoltar()`       → conectar con ese destino, o desconectar si es null.
 *  El fantasma no lo dibuja esta máquina: lo pinta el player en su `alPintar`
 *  leyendo `actual()`, porque la cuerda a medio tender va en la MISMA capa SVG
 *  que las ya tendidas (un solo `innerHTML`).
 * @template D
 * @param {Object} o
 * @param {HTMLElement} o.arena
 * @param {SVGElement} o.svg
 * @param {(e: PointerEvent) => {ancla: Element, datos: D}|null} o.origen
 * @param {(x: number, y: number, datos: D) => Element|null} o.elegirDestino
 * @param {(destino: Element|null, datos: D) => void} o.alSoltar
 * @param {() => void} o.alPintar
 * @param {() => boolean} [o.activo]
 * @returns {{actual: () => Arrastre<D>|null}}
 */
export function crearArrastreDeCuerdas({ arena, svg, origen, elegirDestino, alSoltar, alPintar, activo }) {
  /** @type {Arrastre<D>|null} */
  let drag = null;

  arena.addEventListener('pointerdown', e => {
    if (drag || (activo && !activo())) return;
    const desde = origen(e);
    if (!desde) return;
    e.preventDefault();
    const pos = dotPos(desde.ancla, svg);
    drag = { pointerId: e.pointerId, datos: desde.datos, x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
    capturarPuntero(arena, e.pointerId);
    alPintar();
  });

  arena.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = svgPt(svg, e.clientX, e.clientY);
    drag.cx = p.x; drag.cy = p.y;
    alPintar();
  });

  /** @param {PointerEvent} e @param {boolean} conectar */
  function terminar(e, conectar) {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    drag = null;
    soltarPuntero(arena, e.pointerId);
    if (!conectar) { alPintar(); return; }   // pointercancel: el gesto se fue, nada que enlazar
    alSoltar(elegirDestino(e.clientX, e.clientY, d.datos), d.datos);
  }
  arena.addEventListener('pointerup', e => terminar(e, true));
  arena.addEventListener('pointercancel', e => terminar(e, false));

  return { actual: () => drag };
}

/** PUNTUAR LOS ENLACES con el scorer de la plantilla — un solo dueño del conteo
 *  (Diagrama y Emparejar lo tenían calcado). El modo Individual no lleva
 *  aritmética propia: cada enlace pasa por `puntuar`, que es `scoreSubmission`
 *  envuelto; aquí solo se suma y se acota.
 * @template L, R
 * @param {Map<L, R>} links
 * @param {(l: L, r: R) => import('../kernel/contracts/session.js').ScoreResult} puntuar
 * @returns {{correct: number, score: number, wrong: number}}
 */
export function puntuarEnlaces(links, puntuar) {
  let correct = 0, score = 0;
  for (const [l, r] of links) {
    const res = puntuar(l, r);
    score += res.points;
    if (res.correct) correct++;
  }
  return { correct, score: Math.max(0, score), wrong: links.size - correct };
}
