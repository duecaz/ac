// GIRO de la ruleta — geometría + animación en UN solo sitio (C4).
// Antes estaba copiado TRES veces con constantes distintas: templates/wheel
// (duración configurable, tope 30 s), templates/question-live (3.5 s fijos) y
// views/studentLive (3.5 s, inline). La aguja está a la IZQUIERDA (−90°) en las
// tres; la fórmula del ángulo final es idéntica y ahora vive aquí.
// Vive en core (barrido B3, 2026-09-02), junto a render.js/logic.js: pieza del
// BUCLE «pedir la palabra» (`rules.selector`), compartida por Ruleta y Abre
// Cajas — antes en `templates/wheel/`, importada por una vista (§0).
import { pickIndex } from './logic.js';

export const SPIN_TURNS = 5;              // vueltas completas antes de frenar
const SPIN_EASE  = 'cubic-bezier(.17,.67,.21,.99)';
export const SPIN_DUR_DEFAULT = 4000;     // configurable por la actividad (rules.spinDurationMs)
export const SPIN_DUR_PICK    = 3500;     // "elegir pregunta" (abre-cajas / en vivo)
export const SPIN_DUR_MAX     = 30000;    // tope de lo configurable

/** Duración configurada por la actividad, acotada y con default sano.
 *  @param {unknown} ms @returns {number} */
export function clampSpinDur(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return SPIN_DUR_DEFAULT;
  return Math.min(n, SPIN_DUR_MAX);
}

/** Ángulo final para caer en `target` (0-based) de `count` gajos, girando SIEMPRE
 *  hacia delante desde `rotation` y dejando la aguja izquierda sobre el centro
 *  del gajo. Puro — el mismo número en las tres ruletas.
 *  @param {number} rotation @param {number} count @param {number} target
 *  @returns {number} */
export function spinTarget(rotation, count, target) {
  const arc = 360 / count;
  const base = Math.ceil((rotation + 1) / 360) * 360;
  return base + 360 * SPIN_TURNS + (360 - (target * arc + arc / 2)) - 90;
}

/** Ángulo equivalente en [0,360) para "congelar" la rueda tras el giro.
 *  @param {number} rotation @returns {number} */
export function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

/** Lanza la transición CSS del giro sobre el <svg> (forzando reflow para que
 *  dispare). El CALLER pone su propio timeout para el final — cada vista tiene
 *  su scheduler (ctx.setTimeout en live, setTimeout en solo).
 *  @param {SVGElement|HTMLElement|null|undefined} svg
 *  @param {number} rotation @param {number} durMs */
export function animateSpin(svg, rotation, durMs) {
  if (!svg) return;
  svg.style.transition = `transform ${durMs}ms ${SPIN_EASE}`;
  svg.getBoundingClientRect?.();   // reflow → la transición arranca
  svg.style.transform = `rotate(${rotation}deg)`;
}

/** EL GIRO ENTERO, una vez: elegir gajo → animar → esperar → avisar CON EL
 *  GUARD DE VIDA puesto (§23).
 *
 *  Estaba tecleado dos veces (templates/wheel y templates/question-live) y la
 *  segunda copia se dejó medio guard: preguntaba «¿existe la raíz?», y el
 *  selector del escenario es GENÉRICO —existe también en la página del juego
 *  siguiente—, así que una ruleta girando podía pintar su ganador encima de lo
 *  que ya se había montado después. Aquí el guard es un PARÁMETRO (`vivo`) y no
 *  se puede olvidar: quien llama declara qué significa «sigo en pantalla».
 *
 *  @param {{svg: SVGElement|HTMLElement|null|undefined, rotation: number,
 *    count: number, dur: number, vivo: () => boolean,
 *    alParar: (target: number, rotacionNormalizada: number) => void,
 *    elegir?: (count: number) => number,
 *    programar?: (cb: () => void, ms: number) => unknown}} o
 *  @returns {number} la rotación (acumulada, sin normalizar) que queda pintada */
export function girar({ svg, rotation, count, dur, vivo, alParar, elegir = pickIndex, programar = setTimeout }) {
  const target = elegir(count);
  const fin = spinTarget(rotation, count, target);
  animateSpin(svg, fin, dur);
  programar(() => {
    if (!vivo()) return;   // la ruta/el modo cambiaron a mitad del giro (§23)
    alParar(target, normalizeRotation(fin));
  }, dur);
  return fin;
}
