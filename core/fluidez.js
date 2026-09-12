// LA FLUIDEZ SE MIDE, NO SE OPINA (Fase 0 del plan de rendimiento,
// `docs/handoff-rendimiento-animaciones.md`).
//
// «Va lenta» no es un dato: la pizarra del aula es 1280x720 CSS a DPR 3 con una
// GPU modesta, y lo que en el portátil de quien programa cuesta 4 ms, ahí cuesta
// 40. Este módulo es la ARITMÉTICA de esa medida y nada más: recibe las marcas de
// tiempo de los cuadros (lo que devuelve `performance.now()` dentro de un
// `requestAnimationFrame`) y saca los tres números que describen un tirón:
//
//   · p50 — el cuadro típico. 16,7 ms es 60 fps; 33 ms es 30 fps.
//   · p95 — el cuadro MALO de cada veinte. Es el que la clase ve: una mediana
//     buena con un p95 de 120 ms se percibe como una animación a saltos.
//   · cuadros LARGOS (>50 ms por defecto) — los tropiezos contables. Cero es la
//     meta; "tres en cinco segundos" es una frase que el dueño puede repetir.
//
// PURO a propósito (ni DOM, ni reloj, ni estado): así se prueba con marcas
// inventadas (`tests/fluidez.test.mjs`) y lo puede usar tanto la pastilla de
// `?perf=1` como cualquier sonda futura. Quien PINTA es `core/fluidezHud.js`.
//
// El percentil es por RANGO MÁS CERCANO (nada de interpolar), el mismo método
// que `tools/perf-sonda.mjs`, para que el número que se lee en la pizarra y el
// que imprime la sonda se puedan comparar sin traducir.

/**
 * @typedef {object} ResumenFluidez
 * @property {number} cuadros  cuántos intervalos se midieron (marcas - 1)
 * @property {number} p50      mediana del tiempo entre cuadros, en ms
 * @property {number} p95      percentil 95 del tiempo entre cuadros, en ms
 * @property {number} largos   cuántos intervalos superaron el umbral
 * @property {number} fps      cuadros por segundo equivalentes a la mediana
 */

/** Umbral por defecto de «cuadro largo», en ms: 50 ms es un tropiezo visible
 *  (tres cuadros perdidos a 60 Hz), no un cuadro un poco justo. */
export const UMBRAL_LARGO = 50;

/** Intervalos entre marcas consecutivas. Se ignoran las marcas que no sean
 *  números finitos y los saltos hacia atrás (un reloj que retrocede no es un
 *  cuadro).
 *  @param {readonly number[]} marcas marcas de tiempo en ms, en orden
 *  @returns {number[]} */
export function intervalos(marcas) {
  /** @type {number[]} */
  const out = [];
  let prev = null;
  for (const m of marcas) {
    if (typeof m !== 'number' || !Number.isFinite(m)) continue;
    if (prev !== null && m >= prev) out.push(m - prev);
    prev = m;
  }
  return out;
}

/** Percentil por rango más cercano sobre una lista YA ordenada de menor a mayor.
 *  @param {readonly number[]} ordenados @param {number} q 0..1
 *  @returns {number} */
export function percentil(ordenados, q) {
  if (!ordenados.length) return 0;
  const i = Math.min(ordenados.length - 1, Math.max(0, Math.floor(ordenados.length * q)));
  return ordenados[i];
}

/** Los tres números de un tramo medido.
 *  @param {readonly number[]} marcas marcas de tiempo en ms (dos o más)
 *  @param {{umbralLargo?: number}} [opts]
 *  @returns {ResumenFluidez} */
export function resumenFluidez(marcas, opts = {}) {
  const umbral = opts.umbralLargo ?? UMBRAL_LARGO;
  const ivs = intervalos(marcas);
  if (!ivs.length) return { cuadros: 0, p50: 0, p95: 0, largos: 0, fps: 0 };
  const ord = [...ivs].sort((a, b) => a - b);
  // La mediana es el rango 0,5: con 2 intervalos toma el mayor, igual que la
  // sonda (`o[o.length >> 1]`). Se redondea a una décima porque la tercera cifra
  // de un ms es ruido del reloj del navegador, no información.
  const p50 = redondea(percentil(ord, 0.5));
  const p95 = redondea(percentil(ord, 0.95));
  return {
    cuadros: ivs.length,
    p50, p95,
    largos: ivs.filter(v => v > umbral).length,
    // fps DE LA MEDIANA, no «cuadros partido por segundos»: así el número no
    // miente cuando el navegador deja de emitir cuadros (pestaña oculta), donde
    // contar cuadros daría 0 fps con la pantalla perfectamente quieta.
    fps: p50 > 0 ? Math.round(1000 / p50) : 0,
  };
}

/** @param {number} n @returns {number} */
function redondea(n) { return Math.round(n * 10) / 10; }

/** Las marcas de los últimos `ventanaMs` milisegundos, contados desde la última.
 *  La pastilla enseña «los últimos 5 s», así que la lista se poda en vez de
 *  crecer sin fin mientras la clase juega.
 *  @param {readonly number[]} marcas @param {number} ventanaMs
 *  @returns {number[]} */
export function ventana(marcas, ventanaMs) {
  if (!marcas.length) return [];
  const fin = marcas[marcas.length - 1];
  return marcas.filter(m => typeof m === 'number' && Number.isFinite(m) && fin - m <= ventanaMs);
}
