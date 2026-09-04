// La REJILLA del rompecabezas — funciones PURAS, sin DOM, para poder probarlas
// sin montar nada. Todo trabaja en el mismo sistema que el tablero: PORCENTAJE
// del cuadro (0..100), nunca px — así el mismo cálculo vale en un móvil que en
// una pizarra 4K (§3, «nada con tamaño fijo»).

/** Umbral de encaje (norte del handoff): ≥ 50 % de solape con la celda buena. */
export const ENCAJA_MIN = 0.5;

/**
 * Las `filas × columnas` celdas del tablero.
 * @returns {{i:number, fila:number, col:number, bgPos:string}[]}
 *   `bgPos` es el `background-position` (en %) que le toca a la pieza de esa
 *   celda sobre la imagen ya escalada a `(columnas*100)% (filas*100)%`: en la
 *   esquina superior-izquierda es "0% 0%" y en la inferior-derecha "100% 100%".
 */
export function celdas(filas, columnas) {
  const out = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      const px = columnas > 1 ? (col * 100) / (columnas - 1) : 0;
      const py = filas > 1 ? (fila * 100) / (filas - 1) : 0;
      out.push({ i: fila * columnas + col, fila, col, bgPos: `${px}% ${py}%` });
    }
  }
  return out;
}

/**
 * ¿Bajo qué celda cae el punto `(x, y)` (en % del tablero)?
 * @returns {number} índice de celda, o -1 si el punto cae fuera del tablero.
 */
export function celdaBajo(x, y, filas, columnas) {
  if (x < 0 || x >= 100 || y < 0 || y >= 100) return -1;
  const col = Math.min(columnas - 1, Math.floor((x / 100) * columnas));
  const fila = Math.min(filas - 1, Math.floor((y / 100) * filas));
  return fila * columnas + col;
}

/**
 * Fracción del ÁREA de `rectPieza` que cae dentro de `rectCelda`. Rects en el
 * mismo sistema (`{x, y, w, h}`, unidades cualesquiera pero consistentes entre
 * los dos — el tablero las da en %). 1.0 = la pieza cabe entera en la celda.
 */
export function solape(rectPieza, rectCelda) {
  const x1 = Math.max(rectPieza.x, rectCelda.x);
  const y1 = Math.max(rectPieza.y, rectCelda.y);
  const x2 = Math.min(rectPieza.x + rectPieza.w, rectCelda.x + rectCelda.w);
  const y2 = Math.min(rectPieza.y + rectPieza.h, rectCelda.y + rectCelda.h);
  const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const piezaArea = rectPieza.w * rectPieza.h;
  return piezaArea > 0 ? interArea / piezaArea : 0;
}

/** ¿Encaja? — el umbral en UN sitio, para que nadie compare a mano contra 0.5. */
export function encaja(rectPieza, rectCelda, min = ENCAJA_MIN) {
  return solape(rectPieza, rectCelda) >= min;
}

/**
 * Las posiciones 0..n-1 barajadas (para repartir las piezas alrededor del
 * tablero, no en su celda). `shuffle` se INYECTA (`core/azar.js`): esta
 * función no nombra `Math.random` ni el primitivo global (regla `azar-primitivo`).
 */
export function barajarPosiciones(n, shuffle) {
  return shuffle(Array.from({ length: n }, (_, i) => i));
}
