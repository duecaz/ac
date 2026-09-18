// LOS CONTORNOS del rompecabezas — piezas con LENGÜETA y HUECO, geometría
// pura (Bézier cúbicas generadas aquí, cero assets) y sin DOM: se prueba en
// Node. Antes cada pieza era un cuadrado con las esquinas redondeadas y «se
// leía como un puzle deslizante» (handoff §8d).
//
// LA IDEA. Para cada arista INTERIOR (entre dos celdas) se decide con la
// fuente de azar INYECTADA hacia qué lado sale la lengüeta; las aristas del
// BORDE del tablero son rectas. La curva de una arista se calcula UNA vez y la
// pieza vecina recibe la MISMA curva invertida (`invertir`): así la lengüeta
// de una pieza es exactamente el hueco de la otra, por construcción.
//
// COORDENADAS. Los lados (`lados`) van en unidades de CELDA del tablero (la
// celda (fila, col) ocupa x∈[col, col+1], y∈[fila, fila+1]) — es el sistema en
// que se comprueba que dos vecinas casan. El path `d` va NORMALIZADO a la CAJA
// de la pieza (0..1 en los dos ejes) para un `<clipPath
// clipPathUnits="objectBoundingBox">`: la única forma de que el recorte escale
// con la pieza (`clip-path: path()` de CSS solo admite px, §3). La caja es la
// celda ampliada `TAB` por los CUATRO lados, SIEMPRE, tenga o no lengüeta en
// ese lado: todas las piezas tienen la misma caja relativa y el fondo, el
// tamaño en la bandeja y la posición al encajar se calculan igual para todas.

/** Margen de la caja alrededor de la celda, en fracción de celda. La cabeza de
 *  la lengüeta llega justo a ese margen (asoma ~0,3 del lado). */
export const TAB = 0.3;

/** @typedef {{x: number, y: number}} Punto */
/**
 * Un tramo del contorno con su propio inicio `a`: así un lado se invierte sin
 * conocer nada fuera de sus tramos.
 * @typedef {{tipo: 'L', a: Punto, p: Punto} | {tipo: 'C', a: Punto, c1: Punto, c2: Punto, p: Punto}} Tramo
 */
/** @typedef {Tramo[]} Lado */
/**
 * @typedef {Object} Contorno
 * @property {number} i
 * @property {number} fila
 * @property {number} col
 * @property {string} d  path SVG (M/L/C/Z) normalizado a `caja` (0..1)
 * @property {{x: number, y: number, w: number, h: number}} caja  en celdas del tablero
 * @property {{arriba: Lado, derecha: Lado, abajo: Lado, izquierda: Lado}} lados  en celdas del tablero
 */

// LA LENGÜETA CLÁSICA (cuello estrecho, cabeza redonda), en el marco de la
// arista: `t` recorre la arista de 0 a 1 y `n` es la distancia perpendicular
// (positiva = hacia fuera de la celda que recorre). La mitad derecha es la
// izquierda reflejada (t → 1−t): una sola forma escrita.
/** @typedef {{t: number, n: number}} TN */
const CUELLO = 0.42, HOMBRO = 0.30;
/** @type {TN} */ const PIE = { t: CUELLO, n: 0 };                      // L hasta el cuello
/** @type {{c1: TN, c2: TN, t: number, n: number}} */
const SUBIDA = { c1: { t: CUELLO, n: .06 }, c2: { t: HOMBRO, n: .10 }, t: HOMBRO, n: .18 };   // sube al hombro
/** @type {{c1: TN, c2: TN, t: number, n: number}} */
const CABEZA = { c1: { t: HOMBRO, n: TAB }, c2: { t: 1 - HOMBRO, n: TAB }, t: 1 - HOMBRO, n: .18 };

/**
 * Un lado con lengüeta (`signo` +1) o hueco (−1) desde `A` hasta `B`, con
 * normal exterior `N` (unitaria). Todo en celdas del tablero.
 * @param {Punto} A @param {Punto} B @param {Punto} N @param {1|-1} signo
 * @returns {Lado}
 */
function ladoCurvo(A, B, N, signo) {
  /** @param {TN} q @returns {Punto} */
  const P = (q) => ({ x: A.x + q.t * (B.x - A.x) + q.n * signo * N.x,
                      y: A.y + q.t * (B.y - A.y) + q.n * signo * N.y });
  /** @type {Lado} */
  const lado = [];
  let a = A;
  /** @param {Punto} p */
  const L = (p) => { lado.push({ tipo: 'L', a, p }); a = p; };
  /** @param {Punto} c1 @param {Punto} c2 @param {Punto} p */
  const C = (c1, c2, p) => { lado.push({ tipo: 'C', a, c1, c2, p }); a = p; };
  L(P(PIE));
  C(P(SUBIDA.c1), P(SUBIDA.c2), P(SUBIDA));
  C(P(CABEZA.c1), P(CABEZA.c2), P(CABEZA));
  // Mitad simétrica: los mismos puntos con t → 1−t, recorridos al revés.
  /** @param {TN} q @returns {TN} */
  const esp = (q) => ({ t: 1 - q.t, n: q.n });
  C(P(esp(SUBIDA.c2)), P(esp(SUBIDA.c1)), P(esp(PIE)));
  L(B);
  return lado;
}

/** @param {Punto} A @param {Punto} B @returns {Lado} */
const ladoRecto = (A, B) => [{ tipo: 'L', a: A, p: B }];

/**
 * El MISMO lado recorrido al revés: tramos en orden inverso, extremos
 * intercambiados y los puntos de control también. Es una involución.
 * @param {Lado} lado @returns {Lado}
 */
export function invertir(lado) {
  return lado.slice().reverse().map(s => s.tipo === 'C'
    ? { tipo: 'C', a: s.p, c1: s.c2, c2: s.c1, p: s.a }
    : { tipo: 'L', a: s.p, p: s.a });
}

/** @param {number} v @returns {string} número corto sin «-0» ni ceros de cola */
const num = (v) => String(Number(v.toFixed(4)) + 0);

/**
 * Los contornos de las `filas × columnas` piezas.
 * @param {number} filas @param {number} columnas
 * @param {() => number} rnd  la fuente de azar, INYECTADA (el player pasa
 *   `azar.random` de core/azar.js — regla `azar-primitivo`)
 * @returns {Contorno[]}
 */
export function contornos(filas, columnas, rnd) {
  /** @returns {1|-1} */
  const signo = () => (rnd() < 0.5 ? 1 : -1);
  // Aristas interiores, cada una decidida UNA vez y en orden fijo (determinista
  // por la rnd): `h[r][c]` = arista bajo la celda (r,c), canónica como el lado
  // ARRIBA de (r+1,c) (de izquierda a derecha, exterior hacia arriba);
  // `v[r][c]` = arista a la derecha de (r,c), canónica como su lado DERECHA
  // (de arriba abajo, exterior hacia la derecha).
  /** @type {Lado[][]} */ const h = [];
  /** @type {Lado[][]} */ const v = [];
  for (let r = 0; r + 1 < filas; r++) {
    h[r] = [];
    for (let c = 0; c < columnas; c++) {
      h[r][c] = ladoCurvo({ x: c, y: r + 1 }, { x: c + 1, y: r + 1 }, { x: 0, y: -1 }, signo());
    }
  }
  for (let r = 0; r < filas; r++) {
    v[r] = [];
    for (let c = 0; c + 1 < columnas; c++) {
      v[r][c] = ladoCurvo({ x: c + 1, y: r }, { x: c + 1, y: r + 1 }, { x: 1, y: 0 }, signo());
    }
  }

  /** @type {Contorno[]} */
  const out = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let col = 0; col < columnas; col++) {
      const tl = { x: col, y: fila }, tr = { x: col + 1, y: fila };
      const br = { x: col + 1, y: fila + 1 }, bl = { x: col, y: fila + 1 };
      const lados = {
        arriba:    fila > 0 ? h[fila - 1][col] : ladoRecto(tl, tr),
        derecha:   col + 1 < columnas ? v[fila][col] : ladoRecto(tr, br),
        abajo:     fila + 1 < filas ? invertir(h[fila][col]) : ladoRecto(br, bl),
        izquierda: col > 0 ? invertir(v[fila][col - 1]) : ladoRecto(bl, tl),
      };
      const caja = { x: col - TAB, y: fila - TAB, w: 1 + 2 * TAB, h: 1 + 2 * TAB };
      /** @param {Punto} p */
      const n = (p) => `${num((p.x - caja.x) / caja.w)} ${num((p.y - caja.y) / caja.h)}`;
      let d = `M ${n(tl)}`;
      for (const lado of [lados.arriba, lados.derecha, lados.abajo, lados.izquierda]) {
        for (const s of lado) d += s.tipo === 'C' ? ` C ${n(s.c1)} ${n(s.c2)} ${n(s.p)}` : ` L ${n(s.p)}`;
      }
      d += ' Z';
      out.push({ i: fila * columnas + col, fila, col, d, caja, lados });
    }
  }
  return out;
}

/**
 * El fondo de una pieza sobre su caja ampliada. La imagen entera mide
 * `columnas × filas` celdas y la caja `1+2·TAB`; un `background-position` en
 * % desplaza `p·(caja − imagen)`, así que para que el borde de la imagen
 * quede a `−(col − TAB)` celdas del borde de la caja:
 *   p = (col − TAB) / (columnas − (1+2·TAB))     (ídem en y con filas)
 * @param {{fila: number, col: number}} c @param {number} filas @param {number} columnas
 * @returns {{sizeX: number, sizeY: number, posX: number, posY: number, css: string}}
 */
export function fondoPieza(c, filas, columnas) {
  const caja = 1 + 2 * TAB;
  const sizeX = (columnas / caja) * 100, sizeY = (filas / caja) * 100;
  const posX = ((c.col - TAB) / (columnas - caja)) * 100;
  const posY = ((c.fila - TAB) / (filas - caja)) * 100;
  return { sizeX, sizeY, posX, posY,
    css: `background-size:${sizeX}% ${sizeY}%;background-position:${posX}% ${posY}%;` };
}

/**
 * Dónde se coloca la CAJA de una pieza encajada, en % del tablero.
 * @param {{fila: number, col: number}} c @param {number} filas @param {number} columnas
 * @returns {{left: number, top: number, width: number, height: number}}
 */
export function cajaEncajada(c, filas, columnas) {
  return {
    left: ((c.col - TAB) * 100) / columnas, top: ((c.fila - TAB) * 100) / filas,
    width: ((1 + 2 * TAB) * 100) / columnas, height: ((1 + 2 * TAB) * 100) / filas,
  };
}

/**
 * El NÚCLEO de la caja de una pieza (la caja menos el margen TAB por lado):
 * es lo que se compara con la celda al soltar. Con la caja ampliada entera el
 * solape con su propia celda no llega al 50 % (1/1,6² = 39 %) y no encajaría
 * ni puesta en su sitio.
 * @param {import('./rejilla.js').Rect} caja @returns {import('./rejilla.js').Rect}
 */
export function rectNucleo(caja) {
  const mx = (caja.w * TAB) / (1 + 2 * TAB), my = (caja.h * TAB) / (1 + 2 * TAB);
  return { x: caja.x + mx, y: caja.y + my, w: caja.w - 2 * mx, h: caja.h - 2 * my };
}
