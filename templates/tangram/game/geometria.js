// Geometría PURA del tangram: transformar un polígono (rotar/voltear/trasladar)
// y el imán de la partida (ajustar a 45° y a una rejilla fina al soltar).
// Sin DOM, sin reloj: se prueba entera desde Node (docs/estilos-de-actividad.md
// no aplica aquí, es kernel de datos, no de pintado).

import { PIEZAS } from './piezas.js';

/** Un polígono es un array de [x, y] en el CUADRADO UNIDAD del juego. */

/**
 * @typedef {import('./piezas.js').Punto} Punto
 * @typedef {import('./piezas.js').Pieza} Pieza
 */
/**
 * La caja que envuelve unos puntos.
 * @typedef {Object} Caja
 * @property {number} minx
 * @property {number} miny
 * @property {number} maxx
 * @property {number} maxy
 */
/**
 * DÓNDE ESTÁ UNA PIEZA en el tablero: qué pieza es (id de `PIEZAS`), su
 * traslación, su giro en grados y si está volteada. Es lo que guarda el
 * contenido por pieza y lo que compara la máscara — la forma la declara el
 * kernel (una sola), aquí solo se le da el nombre corto.
 * @typedef {import('../../../kernel/contracts/activity.js').TangramColocacion} Colocacion
 */
/**
 * La parte de una colocación que la transformación necesita — todo opcional
 * porque el player también transforma «en seco» (rot suelto, sin colocación).
 * @typedef {Object} Transformacion
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [rot]
 * @property {boolean} [flip]
 */

// Rota `pts` alrededor del origen (grados) y traslada. Si `flip` es true, se
// voltea ANTES de rotar (espejo sobre el eje x local): es lo único que
// distingue una pieza de su reflejo (el paralelogramo es la única que se ve
// distinta; en el resto el volteo es visualmente idéntico, pero se acepta en
// las 7 —lo pide el enunciado— para que el gesto de doble-toque sea uniforme).
/** @param {Punto[]} pts @param {Transformacion} [t] @returns {Punto[]} */
export function transformarPieza(pts, { x = 0, y = 0, rot = 0, flip = false } = {}) {
  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return pts.map(([px, py]) => {
    const fy = flip ? -py : py;
    const rx = px * cos - fy * sin;
    const ry = px * sin + fy * cos;
    return /** @type {Punto} */ ([rx + x, ry + y]);
  });
}

/**
 * EL DUEÑO ÚNICO del polígono de una colocación (§21b): unas colocaciones
 * (`{pieza,x,y,rot,flip}`) → sus polígonos ya en coordenadas del tablero. Lo
 * usan el player (la silueta gris que juega el alumno ES `poligonosDe(item.
 * colocaciones)`), el editor (la unión que ve el docente al soltar) y la
 * máscara (lo que compara). Una colocación cuya pieza no está en el
 * diccionario no es nada: se omite, no se inventa.
 * @param {Colocacion[]} colocaciones
 * @param {Record<string, Pieza>} [piezas]
 * @returns {Punto[][]}
 */
export function poligonosDe(colocaciones, piezas = PIEZAS) {
  /** @type {Punto[][]} */
  const out = [];
  for (const c of colocaciones) {
    const pieza = piezas[c.pieza];
    if (pieza) out.push(transformarPieza(pieza.puntos, c));
  }
  return out;
}

/** La caja que envuelve unos polígonos — se DERIVA de los puntos, nunca se
 *  guarda (§21b: el catálogo la declaraba a mano al lado de los polígonos, dos
 *  fuentes de la misma verdad). Sin puntos, la caja del cuadrado unidad.
 *  @param {Punto[][]} poligonos @returns {Caja} */
export function bboxDe(poligonos) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const p of poligonos) {
    for (const [x, y] of p) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
  }
  if (!Number.isFinite(minx)) return { minx: 0, miny: 0, maxx: 1, maxy: 1 };
  return { minx, miny, maxx, maxy };
}

/** El centro de la caja de una pieza ya colocada (interna: su único lector es
 *  `transformarEnSitio`). No es el centro de masa: es
 *  el de su caja envolvente, que es lo que el dedo percibe como «la pieza».
 *  @param {Colocacion} c @param {Record<string, Pieza>} [piezas] @returns {Punto} */
function centroDe(c, piezas = PIEZAS) {
  const pts = poligonosDe([c], piezas)[0] || [];
  const b = bboxDe([pts]);
  return /** @type {Punto} */ ([(b.minx + b.maxx) / 2, (b.miny + b.maxy) / 2]);
}

/**
 * GIRAR (o VOLTEAR) SIN QUE LA PIEZA SE ESCAPE. La colocación guarda un giro
 * alrededor del ORIGEN del polígono —el vértice del ángulo recto—, así que
 * girar 45° a secas manda la pieza a varios lados de distancia del dedo: el
 * dueño lo describió como «hace el snap en un lugar erróneo, a distancia del
 * lugar correcto» (2026-09-18). Aquí se compensa la traslación para que el
 * CENTRO de la pieza no se mueva: el dato sigue siendo un giro sobre el
 * origen (la máscara y las siluetas no cambian) y el gesto se comporta como
 * espera la mano.
 * @param {Colocacion} c
 * @param {{rot?: number, flip?: boolean}} cambio
 * @param {Record<string, Pieza>} [piezas]
 * @returns {Colocacion}
 */
export function transformarEnSitio(c, cambio, piezas = PIEZAS) {
  const [cx, cy] = centroDe(c, piezas);
  const nueva = { ...c, ...cambio };
  const [nx, ny] = centroDe(nueva, piezas);
  return { ...nueva, x: nueva.x + (cx - nx), y: nueva.y + (cy - ny) };
}

/** Ajusta un ángulo (grados, cualquier signo) al múltiplo de 45° más cercano,
 *  normalizado a [0, 360).
 *  @param {number} gradosBrutos @returns {number} */
export function imanRotacion(gradosBrutos) {
  const paso = 45;
  const normal = ((gradosBrutos % 360) + 360) % 360;
  return (Math.round(normal / paso) * paso) % 360;
}

/** Ajusta una coordenada a la rejilla fina (1/16 del lado del cuadrado unidad).
 *  @param {number} valor @param {number} [divisiones] @returns {number} */
export function imanPosicion(valor, divisiones = 16) {
  const paso = 1 / divisiones;
  return Math.round(valor / paso) * paso;
}

/** Imán completo de una colocación al soltar la pieza.
 *  @param {Colocacion} colocacion @param {number} [divisiones] @returns {Colocacion} */
export function imantar(colocacion, divisiones = 16) {
  return {
    ...colocacion,
    x: imanPosicion(colocacion.x, divisiones),
    y: imanPosicion(colocacion.y, divisiones),
    rot: imanRotacion(colocacion.rot || 0),
  };
}
