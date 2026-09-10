// Geometría PURA del tangram: transformar un polígono (rotar/voltear/trasladar)
// y el imán de la partida (ajustar a 45° y a una rejilla fina al soltar).
// Sin DOM, sin reloj: se prueba entera desde Node (docs/estilos-de-actividad.md
// no aplica aquí, es kernel de datos, no de pintado).

/** Un polígono es un array de [x, y] en el CUADRADO UNIDAD del juego. */

/**
 * @typedef {import('./piezas.js').Punto} Punto
 */
/**
 * DÓNDE ESTÁ UNA PIEZA en el tablero: qué pieza es (id de `PIEZAS`), su
 * traslación, su giro en grados y si está volteada. Es lo que guarda el player
 * por pieza y lo que compara la máscara.
 * @typedef {Object} Colocacion
 * @property {string} pieza
 * @property {number} x
 * @property {number} y
 * @property {number} rot
 * @property {boolean} flip
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
