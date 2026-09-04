// Comparación de MÁSCARAS raster — el veredicto de «¿está resuelto?». Puro:
// una matriz de bits en memoria (sin canvas, sin DOM), así se prueba entera
// desde Node y el player la reutiliza tal cual sobre un <canvas> oculto real.
// Se llama UNA vez por soltar pieza, nunca por fotograma (lo dice el enunciado).
import { transformarPieza } from './geometria.js';

/** Rasteriza un polígono sobre una rejilla n×n que cubre el rectángulo
 *  [ox,ox+w) × [oy,oy+h) — usando even-odd (ray casting) por el CENTRO de
 *  cada celda. Marca en `bits` (Uint8Array de tamaño n*n) con OR (para poder
 *  acumular varios polígonos = la unión de las piezas).
 *
 *  OJO: la silueta de «cuadrado» vive en 0..1, pero el resto de figuras
 *  (game/siluetas.js) tienen su propio bbox — «casa» llega a −0.35..1.05.
 *  Rasterizar siempre sobre un [0,1] fijo (como hacía esta función antes)
 *  RECORTABA esas siluetas sin avisar: la mitad de una pieza podía caer
 *  fuera de la rejilla y el XOR/la conexidad mentían. Por eso `ox,oy,w,h`
 *  son parámetros, nunca una constante — los calcula quien llama, a partir
 *  del propio contenido (ver `bboxDeTodo`). */
function pintarPoligono(bits, n, pts, ox, oy, w, h) {
  if (!pts || pts.length < 3) return;
  for (let row = 0; row < n; row++) {
    const cy = oy + (row + 0.5) / n * h;
    for (let col = 0; col < n; col++) {
      const cx = ox + (col + 0.5) / n * w;
      if (dentroPoligono(pts, cx, cy)) bits[row * n + col] = 1;
    }
  }
}

function dentroPoligono(pts, x, y) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const cruza = (yi > y) !== (yj > y);
    if (cruza) {
      const xCorte = xi + ((y - yi) / (yj - yi)) * (xj - xi);
      if (x < xCorte) dentro = !dentro;
    }
  }
  return dentro;
}

/** Colocación → su polígono ya transformado, resolviendo el nombre de pieza
 *  contra el diccionario `piezas` (id → {puntos}). */
function poligonoDeColocacion(colocacion, piezas) {
  const pieza = piezas[colocacion.pieza];
  if (!pieza) return null;
  return transformarPieza(pieza.puntos, colocacion);
}

/** Un polígono suelto ([[x,y],...]) o una colocación ({pieza,x,y,rot,flip})
 *  → siempre su polígono de puntos. */
function puntosDe(f, piezas) {
  return Array.isArray(f) && Array.isArray(f[0]) ? f : poligonoDeColocacion(f, piezas);
}

/** Rasteriza uno o varios polígonos/colocaciones dentro del rectángulo
 *  {ox,oy,w,h} y devuelve el Uint8Array. */
function rasterizar(figuras, n, piezas, { ox, oy, w, h }) {
  const bits = new Uint8Array(n * n);
  for (const f of figuras) pintarPoligono(bits, n, puntosDe(f, piezas), ox, oy, w, h);
  return bits;
}

/** Caja que cubre TODOS los puntos de una o varias listas de figuras, con un
 *  margen (fracción del lado mayor) — así una pieza mal soltada FUERA de la
 *  silueta sigue entrando en la rejilla y cuenta como «de más» en el XOR, en
 *  vez de recortarse en silencio. */
function bboxDeTodo(listasDeFiguras, piezas, margen = 0.15) {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const figuras of listasDeFiguras) {
    for (const f of figuras) {
      for (const [x, y] of puntosDe(f, piezas) || []) {
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
  }
  if (!Number.isFinite(minx)) return { ox: 0, oy: 0, w: 1, h: 1 };
  const w0 = Math.max(maxx - minx, 1e-6), h0 = Math.max(maxy - miny, 1e-6);
  const pad = Math.max(w0, h0) * margen;
  return { ox: minx - pad, oy: miny - pad, w: w0 + pad * 2, h: h0 + pad * 2 };
}

/**
 * XOR de área entre la SILUETA (uno o varios polígonos fijos) y la UNIÓN de
 * las piezas colocadas por el jugador — normalizado al área de la silueta,
 * en [0, 1]. `n` es la resolución de la rejilla oculta (≈240 en el player;
 * un valor menor basta y es más rápido en los tests).
 *
 * @param {Array<Array<[number,number]>>} silueta  polígono(s) de la figura
 * @param {Array<{pieza,x,y,rot,flip}>} colocaciones  dónde dejó el jugador cada pieza
 * @param {object} piezas   diccionario id→{puntos} (PIEZAS de piezas.js)
 * @param {number} [n]      resolución de la rejilla (por defecto 240)
 * @returns {number} fracción del área de la silueta que NO coincide (0 = perfecto)
 */
export function xorArea(silueta, colocaciones, piezas, n = 240) {
  const caja = bboxDeTodo([silueta, colocaciones], piezas);
  const bitsSilueta = rasterizar(silueta, n, piezas, caja);
  const bitsPiezas = rasterizar(colocaciones, n, piezas, caja);
  let areaSilueta = 0;
  let areaDiff = 0;
  for (let i = 0; i < bitsSilueta.length; i++) {
    if (bitsSilueta[i]) areaSilueta++;
    if (bitsSilueta[i] !== bitsPiezas[i]) areaDiff++;
  }
  if (areaSilueta === 0) return 1;   // silueta vacía: nada que resolver → no-resuelto
  return areaDiff / areaSilueta;
}

/** Umbral de tolerancia del juego (§ enunciado): XOR < 4% del área de la silueta. */
export const UMBRAL_RESUELTO = 0.04;
/** Margen alrededor de la caja del contenido (silueta + piezas), fracción del
 *  lado mayor. UNO para el rasterizado, el viewBox del player y la miniatura
 *  del editor: estaba repetido a ojo (0.05/0.06) en tres sitios. */
export const MARGEN_CAJA = 0.05;

export function estaResuelto(silueta, colocaciones, piezas, n = 240) {
  return xorArea(silueta, colocaciones, piezas, n) < UMBRAL_RESUELTO;
}

/**
 * Nº de COMPONENTES CONEXAS de la unión de `figuras` (polígonos sueltos o
 * colocaciones) sobre una rejilla n×n — flood-fill 8-conectado (una esquina
 * compartida cuenta como tocado; ver el porqué más abajo). Una silueta
 * válida es SIEMPRE 1 (las 7 piezas se tocan por una arista o media arista);
 * dos piezas separadas dan 2 o más. Es el mismo raster que `xorArea`, así que
 * comparten la MISMA vara: lo que aquí cuenta como «tocado» es lo que allí
 * cuenta como «dentro».
 * @param {Array<Array<[number,number]>>|Array<{pieza,x,y,rot,flip}>} figuras
 * @param {object} piezas
 * @param {number} [n]
 * @returns {number} número de componentes (0 si no hay nada pintado)
 */
export function componentesConexas(figuras, piezas, n = 200) {
  const caja = bboxDeTodo([figuras], piezas, MARGEN_CAJA);
  const bits = rasterizar(figuras, n, piezas, caja);
  const visto = new Uint8Array(n * n);
  let comps = 0;
  const pila = [];
  for (let inicio = 0; inicio < n * n; inicio++) {
    if (!bits[inicio] || visto[inicio]) continue;
    comps++;
    visto[inicio] = 1;
    pila.push(inicio);
    while (pila.length) {
      const p = pila.pop();
      const fila = Math.floor(p / n), col = p % n;
      // 8-conectado: dos piezas que solo se tocan por una ESQUINA (vértice
      // compartido, no arista) siguen siendo UNA figura tangram legítima —
      // y con 4-conectado el muestreo de la rejilla podía partir esa unión
      // en dos según la resolución (comprobado: 200px→2, 240px→1 para la
      // misma silueta). 8-conectado no depende de ese azar de muestreo.
      const vecinos = [
        [fila - 1, col], [fila + 1, col], [fila, col - 1], [fila, col + 1],
        [fila - 1, col - 1], [fila - 1, col + 1], [fila + 1, col - 1], [fila + 1, col + 1],
      ];
      for (const [r, c] of vecinos) {
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const idx = r * n + c;
        if (bits[idx] && !visto[idx]) { visto[idx] = 1; pila.push(idx); }
      }
    }
  }
  return comps;
}
