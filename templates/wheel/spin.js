// GIRO de la ruleta — geometría + animación en UN solo sitio (C4).
// Antes estaba copiado TRES veces con constantes distintas: templates/wheel
// (duración configurable, tope 30 s), templates/question-live (3.5 s fijos) y
// views/studentLive (3.5 s, inline). La aguja está a la IZQUIERDA (−90°) en las
// tres; la fórmula del ángulo final es idéntica y ahora vive aquí.
export const SPIN_TURNS = 5;              // vueltas completas antes de frenar
export const SPIN_EASE  = 'cubic-bezier(.17,.67,.21,.99)';
export const SPIN_DUR_DEFAULT = 4000;     // ruleta suelta (rules.spinDurationMs)
export const SPIN_DUR_PICK    = 3500;     // "elegir pregunta" (abre-cajas / en vivo)
export const SPIN_DUR_MAX     = 30000;    // tope de lo configurable

/** Duración configurada por la actividad, acotada y con default sano. */
export function clampSpinDur(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return SPIN_DUR_DEFAULT;
  return Math.min(n, SPIN_DUR_MAX);
}

/** Ángulo final para caer en `target` (0-based) de `count` gajos, girando SIEMPRE
 *  hacia delante desde `rotation` y dejando la aguja izquierda sobre el centro
 *  del gajo. Puro — el mismo número en las tres ruletas. */
export function spinTarget(rotation, count, target) {
  const arc = 360 / count;
  const base = Math.ceil((rotation + 1) / 360) * 360;
  return base + 360 * SPIN_TURNS + (360 - (target * arc + arc / 2)) - 90;
}

/** Ángulo equivalente en [0,360) para "congelar" la rueda tras el giro. */
export function normalizeRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

/** Lanza la transición CSS del giro sobre el <svg> (forzando reflow para que
 *  dispare). El CALLER pone su propio timeout para el final — cada vista tiene
 *  su scheduler (ctx.setTimeout en live, setTimeout en solo). */
export function animateSpin(svg, rotation, durMs) {
  if (!svg) return;
  svg.style.transition = `transform ${durMs}ms ${SPIN_EASE}`;
  svg.getBoundingClientRect?.();   // reflow → la transición arranca
  svg.style.transform = `rotate(${rotation}deg)`;
}
