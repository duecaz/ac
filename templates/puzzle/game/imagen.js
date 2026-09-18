// La imagen del rompecabezas SIN CANVAS (norte del handoff): el SVG del banco
// se convierte UNA vez en una `data:` URL con los colores ya aplicados, y cada
// pieza es un `<div>` con esa URL de fondo. Todo por STRING, sin DOM (así se
// puede probar en Node y sirve igual en el navegador y en el editor).
//
// CONTRATO del banco (assets/juegos/dibujos): cada zona del SVG lleva
// `data-color="#rrggbb"` — el color con que ESTE juego la muestra (Colorear la
// pinta blanca; aquí se pinta con su color real). `svgAColor` aplica ese color
// como `fill` de la zona, respetando un `fill` previo si lo hubiera.
import { componerEscena } from '../../../core/escenasDibujo.js';

/**
 * La caja envolvente de una zona, en coordenadas del lienzo del SVG.
 * @typedef {Object} Bbox
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */
/**
 * Una zona reconocida del SVG. Solo `tipo` y `bbox` los usa el recorte; los
 * demás campos son los del propio primitivo (los lee quien quiera repetir la
 * geometría exacta, como la auditoría de celdas vacías de `tests/puzzle.test.mjs`).
 * @typedef {Object} Zona
 * @property {'rect'|'circle'|'ellipse'|'polygon'|'path'} tipo
 * @property {Bbox} bbox
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [w]
 * @property {number} [h]
 * @property {number} [cx]
 * @property {number} [cy]
 * @property {number} [r]
 * @property {number} [rx]
 * @property {number} [ry]
 * @property {number[]} [puntos]
 */

// Atributos con `data-color="…"` en una etiqueta abierta o autocerrada.
const ZONA_RE = /<([a-zA-Z][\w:-]*)((?:\s+[^<>]*?)?\s+data-color="([^"]*)"[^<>]*?)(\/?)>/g;

/** ¿Trae el SVG zonas `data-color`? Es lo que separa los DOS bancos: el legado
 *  (`dibujos/zonas/`) las trae y su caja se calcula del texto; las láminas de
 *  OpenMoji no traen ninguna y su caja hay que medirla en el navegador.
 *  @param {unknown} texto @returns {boolean} */
export const tieneZonas = (texto) => /\sdata-color="/.test(String(texto ?? ''));

/**
 * Devuelve el SVG (texto) con `fill` = `data-color` en cada zona. SOLO colorea:
 * el recorte del `viewBox` es de `svgParaPuzzle` (abajo), que es quien encadena
 * los pasos — antes lo llamaba esta función por dentro y el pipeline tenía dos
 * dueños a medias (§21b). Puro: no toca el DOM, no muta el argumento.
 * @param {string} texto
 * @returns {string}
 */
export function svgAColor(texto) {
  return texto.replace(ZONA_RE, (m, tag, attrs, color, cierre) => {
    const conFill = /\sfill="[^"]*"/.test(attrs)
      ? attrs.replace(/\sfill="[^"]*"/, ` fill="${color}"`)
      : `${attrs} fill="${color}"`;
    return `<${tag}${conFill}${cierre}>`;
  });
}

/** El SVG (ya coloreado) como `data:` URL lista para `background-image`.
 *  @param {string} texto @returns {string} */
export function dataUrlDeSvg(texto) {
  return `data:image/svg+xml,${encodeURIComponent(texto)}`;
}

// El margen cuando la caja viene MEDIDA (`getBBox()` del navegador): ese
// cálculo excluye el TRAZO, y las láminas de OpenMoji llevan contorno negro de
// 2 unidades — con el 4 % del banco legado el borde quedaba cortado a ras.
export const MARGEN_SIN_ZONAS = 0.06;

/**
 * EL PIPELINE ENTERO de la imagen del rompecabezas, salvo medir en el
 * navegador: recorte del `viewBox` → color de las zonas → `data:` URL. Es UNA
 * función a propósito (§21b): el player y el editor llaman a ESTA, y Node
 * puede comprobar que la URL final lleva el `viewBox` recortado. Antes cada
 * llamante encadenaba `dataUrlDeSvg(svgAColor(...))` por su cuenta, y
 * `viewBoxAjustado` —escrita con su test— se quedó SIN LECTOR en el player
 * (§31): el defecto que su propio comentario describe (piezas en aire) siguió
 * vivo en pantalla mientras la suite lo daba por resuelto.
 *
 * - Con zonas `data-color` (banco legado): la caja sale del texto y se aplica
 *   el color de cada zona.
 * - Sin zonas (OpenMoji, ya coloreadas): la caja la APORTA quien llama
 *   (`caja`, medida con `getBBox()`), con `MARGEN_SIN_ZONAS`. Sin caja no hay
 *   nada que recortar y el SVG viaja tal cual. No se pasa por `svgAColor`: no
 *   habría nada que colorear y leerlo confundiría.
 * - `escena` (opcional): el decorado coloreado del tema (`escenaColorDe`,
 *   core/escenasDibujo.js). Si viene, la figura ya recortada se COMPONE sobre
 *   él (`componerEscena`, del mismo módulo: la composición figura+escena es
 *   UNA para Colorear y para el puzzle) y la imagen pasa a llenar el marco.
 *   Medido (v1.51.710, sonda por pieza en 3×3): recortar el aire dejaba 39 de
 *   51 dibujos con alguna pieza casi vacía — un sol es redondo y las esquinas
 *   no tienen nada; ningún recorte arregla la FORMA, la escena sí.
 * @param {string} texto
 * @param {{caja?: Bbox|null, escena?: string}} [opts]
 * @returns {string} la `data:` URL
 */
export function svgParaPuzzle(texto, { caja = null, escena = '' } = {}) {
  const figura = caja ? viewBoxAjustado(texto, MARGEN_SIN_ZONAS, caja)
    : tieneZonas(texto) ? svgAColor(viewBoxAjustado(texto))
    : texto;
  return dataUrlDeSvg(escena ? componerEscena(figura, escena) : figura);
}

// ── El recorte del viewBox ───────────────────────────────────────────────
//
// El banco dibuja sobre un lienzo `0 0 100 100`, pero el DIBUJO no llena ese
// lienzo (el tejado de la casa empieza en y=15, no en y=0): con el `viewBox`
// tal cual, el tablero reparte la rejilla sobre el LIENZO, no sobre el
// dibujo, y las celdas de la esquina caen en aire — piezas en blanco,
// indistinguibles entre sí (defecto medido en la captura 3×3 de la casa).
// `viewBoxAjustado` calcula la CAJA ENVOLVENTE de verdad (de las zonas, no
// del lienzo declarado), le añade un margen y la hace CUADRADA centrada
// (para que el tablero 1:1 no deforme el dibujo), y sustituye el `viewBox`.

const NUMERO_RE = /-?\d*\.?\d+(?:e-?\d+)?/g;
/** @param {unknown} s @returns {number[]} */
const numeros = (s) => (String(s ?? '').match(NUMERO_RE) || []).map(Number);

/** Los atributos de una etiqueta, tal como vienen escritos (frontera: es texto
 *  suelto de un fichero, no un DOM).
 *  @param {unknown} tagAttrs @returns {Record<string, string>} */
function atributos(tagAttrs) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const m of String(tagAttrs ?? '').matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

/**
 * Las zonas reconocibles del SVG (`rect`/`circle`/`ellipse`/`polygon`/`path`
 * con M/L/Z simples y absolutos — el vocabulario que dibuja el banco), cada
 * una con su caja envolvente `{minX,minY,maxX,maxY}`. Un `path` con curvas
 * (C/A/Q…) o comandos relativos no se reconoce y se ignora para el recorte
 * (no rompe: simplemente no aporta al cálculo de la caja).
 * @param {unknown} svgTexto
 * @returns {Zona[]}
 */
export function zonasSvg(svgTexto) {
  const texto = String(svgTexto ?? '');
  /** @type {Zona[]} */
  const zonas = [];
  /** @param {number[]} pts @returns {Bbox} */
  const bboxDePuntos = (pts) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const [x, y] = [pts[i], pts[i + 1]];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY };
  };

  for (const m of texto.matchAll(/<rect\b([^>]*)>/g)) {
    const a = atributos(m[1]);
    const x = Number(a.x || 0), y = Number(a.y || 0);
    const w = Number(a.width || 0), h = Number(a.height || 0);
    zonas.push({ tipo: 'rect', x, y, w, h, bbox: { minX: x, minY: y, maxX: x + w, maxY: y + h } });
  }
  for (const m of texto.matchAll(/<circle\b([^>]*)>/g)) {
    const a = atributos(m[1]);
    const cx = Number(a.cx || 0), cy = Number(a.cy || 0), r = Number(a.r || 0);
    zonas.push({ tipo: 'circle', cx, cy, r, bbox: { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r } });
  }
  for (const m of texto.matchAll(/<ellipse\b([^>]*)>/g)) {
    const a = atributos(m[1]);
    const cx = Number(a.cx || 0), cy = Number(a.cy || 0);
    const rx = Number(a.rx || 0), ry = Number(a.ry || 0);
    zonas.push({ tipo: 'ellipse', cx, cy, rx, ry, bbox: { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry } });
  }
  for (const m of texto.matchAll(/<polygon\b([^>]*)>/g)) {
    const a = atributos(m[1]);
    const pts = numeros(a.points);
    if (pts.length >= 4) zonas.push({ tipo: 'polygon', puntos: pts, bbox: bboxDePuntos(pts) });
  }
  for (const m of texto.matchAll(/<path\b([^>]*)>/g)) {
    const a = atributos(m[1]);
    const d = String(a.d || '');
    // Solo M/L/Z absolutos: cualquier otra letra de comando (curvas, arcos,
    // minúsculas relativas) descarta este `path` del cálculo — norte: «path
    // con M/L/Z simples», no un parser de `d` completo.
    const comandos = d.match(/[A-Za-z]/g) || [];
    if (comandos.some(c => !'MLZ'.includes(c))) continue;
    const pts = numeros(d);
    if (pts.length >= 4) zonas.push({ tipo: 'path', puntos: pts, bbox: bboxDePuntos(pts) });
  }
  return zonas;
}

/** La caja envolvente de una lista de zonas (`zonasSvg`), o `null` si no hay
 *  ninguna reconocible.
 *  @param {Zona[]} zonas @returns {Bbox|null} */
function bboxDeZonas(zonas) {   // interna: nadie la nombra fuera (§30)
  if (!zonas.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const z of zonas) {
    if (z.bbox.minX < minX) minX = z.bbox.minX;
    if (z.bbox.maxX > maxX) maxX = z.bbox.maxX;
    if (z.bbox.minY < minY) minY = z.bbox.minY;
    if (z.bbox.maxY > maxY) maxY = z.bbox.maxY;
  }
  return { minX, minY, maxX, maxY };
}

/** Un número con `dec` decimales, sin «-0». Lo comparten el viewBox recortado
 *  (3 decimales sobre un lienzo de 100) y los contornos (4 sobre [0,1]).
 *  @param {number} n @param {number} [dec] @returns {number} */
export const redondea = (n, dec = 3) => Math.round(n * 10 ** dec) / 10 ** dec + 0;
/** @param {number} n @returns {number} */
const num = (n) => redondea(n);

/**
 * Recorta el `viewBox` del SVG a la caja envolvente REAL de sus zonas, con
 * `margen` (fracción del lado mayor de esa caja) de aire alrededor, y la hace
 * CUADRADA centrada (el tablero es 1:1; una caja rectangular deformaría el
 * dibujo al forzarla a cuadrado). Sin zonas reconocibles, o con una caja de
 * área nula, devuelve el texto TAL CUAL (nada que recortar). Puro.
 *
 * `cajaOpcional`: la caja ya medida por quien llama (el navegador la da gratis
 * con `getBBox()`, en unidades del `viewBox`). Si viene, MANDA sobre las
 * zonas: así «margen + cuadrar + reescribir el viewBox» tiene un solo dueño
 * (§21b) y el player solo aporta el dato que este módulo, puro para Node, no
 * puede obtener.
 * @param {unknown} svgTexto
 * @param {number} [margen]
 * @param {Bbox|null} [cajaOpcional]
 * @returns {string}
 */
export function viewBoxAjustado(svgTexto, margen = 0.04, cajaOpcional = null) {
  const texto = String(svgTexto ?? '');
  const caja = cajaOpcional ?? bboxDeZonas(zonasSvg(texto));
  if (!caja) return texto;
  let { minX, minY, maxX, maxY } = caja;
  const w = maxX - minX, h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return texto;

  const pad = margen * Math.max(w, h);
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;

  const lado = Math.max(maxX - minX, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const x0 = cx - lado / 2, y0 = cy - lado / 2;
  const nuevo = `${num(x0)} ${num(y0)} ${num(lado)} ${num(lado)}`;

  return /viewBox\s*=\s*"[^"]*"/.test(texto)
    ? texto.replace(/viewBox\s*=\s*"[^"]*"/, `viewBox="${nuevo}"`)
    : texto.replace(/<svg\b/, `<svg viewBox="${nuevo}"`);
}
