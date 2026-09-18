// Scorer PURO de Colorear — contrato: SIEMPRE {correct, points, hits, total}.
//
// NO HAY CLAVE DE RESPUESTA, así que «acertar» no existe: un dibujo no se
// corrige. Lo que se mide es CUÁNTO SE PINTÓ, que es lo único honrado que se
// puede medir de colorear — y desde que se pinta a mano alzada (v1.51.704) se
// mide de verdad: la fracción de la lámina que quedó con tinta.
//
// Antes se contaban «zonas tocadas / zonas del dibujo». Ese número decía muy
// poco —tocar cuatro veces daba el 100 %— y además desapareció con las zonas:
// las láminas de OpenMoji son línea pura y no tienen ninguna.
//
// LA META NO ES CUBRIRLO TODO. Pintar el 100 % de un lienzo rectangular
// significa haberlo emborronado entero, saliéndose por todas partes; una lámina
// bien coloreada cubre una parte del hueco y deja fondo. Por eso el techo de
// puntos se alcanza en `LLENO` (35 %) y de ahí no sube: premia haber pintado con
// ganas, no haber tapado la hoja. Es una decisión de producto, escrita aquí
// porque es el único sitio donde alguien la va a buscar.
import { basePoints } from '../../core/scoring/index.js';

/** Puntos por terminarlo cuando la actividad no dice otra cosa. */
export const PUNTOS_TERMINAR = 100;

/** Cobertura (0-1) a partir de la cual se da el máximo. */
export const LLENO = 0.35;

/** Cobertura mínima para considerar que se ha pintado ALGO: por debajo de esto
 *  son dos rayas sueltas, y decirle «¡Bien hecho!» a eso es mentirle. */
export const MINIMO = 0.02;

/**
 * `value = { pintado, trazos }` — `pintado` es la fracción del lienzo con tinta
 * (0-1) que mide el player muestreando; `trazos` cuántas veces se apoyó el dedo.
 * @typedef {Object} ValorColorear
 * @property {number} [pintado]
 * @property {number} [trazos]
 */
/**
 * @param {Partial<import('../../kernel/contracts/session.js').ScoreInput>} [o]
 * @returns {import('../../kernel/contracts/session.js').ScoreResult & {lead: string}}
 */
export function scoreColorearSubmission({ value, item, activity } = {}) {
  const v = /** @type {ValorColorear} */ (value && typeof value === 'object' ? value : {});
  const techo = basePoints(item, activity?.scoring ?? { pointsPerCorrect: PUNTOS_TERMINAR });
  // `Math.min(1, …)` antes de nada: un `pintado` imposible (>1) que llegue de
  // donde sea no puede dar más puntos que el techo (§22, el cliente AFIRMA).
  const pintado = Math.min(1, Math.max(0, Number(v.pintado) || 0));
  const trazos = Math.max(0, Math.round(Number(v.trazos) || 0));
  const points = Math.round(techo * Math.min(pintado, LLENO) / LLENO);
  const pct = Math.round(pintado * 100);
  return {
    correct: pintado >= MINIMO,
    points,
    // `hits`/`total` siguen siendo el par que exige el contrato del scorer; aquí
    // son el porcentaje pintado sobre 100, que es lo que la tabla puede enseñar
    // sin inventarse una escala propia.
    hits: pct,
    total: 100,
    lead: pintado >= MINIMO
      ? `Pintaste ${pct} % del dibujo en ${trazos} trazo${trazos === 1 ? '' : 's'}`
      : 'Casi no pintaste nada… ¡prueba otra vez!',
  };
}
