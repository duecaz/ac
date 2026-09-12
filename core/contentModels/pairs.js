// Pairs content model: each item is a left/right pair (text or image).
// Used by Match Up, Find the Match, Memory, Flip Tiles, Pair/No Pair.
import { rid } from '../ids.js';
import { erroresDeLista } from '../../kernel/content/models.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Pair} Pair
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 */

/** @returns {PairsContent} */
export function newEmpty() {
  return { pairs: [
    { id: rid('p_'), left: '', right: '' },
    { id: rid('p_'), left: '', right: '' },
    { id: rid('p_'), left: '', right: '' },
    { id: rid('p_'), left: '', right: '' }
  ]};
}
/**
 * FRONTERA: le llega cualquier contenido.
 * @param {unknown} content
 * @returns {string[]}
 */
export function validate(content) { return erroresDeLista(content, 'pairs'); }
/** @returns {Pair} */
export function newPair() { return { id: rid('p_'), left: '', right: '' }; }

/** ¿ESTA PAREJA SE PUEDE JUGAR? La regla vivía copiada en siete sitios —los dos
 *  players que descartan filas, el revisor que da el visto bueno, los modos…— y
 *  con distintos criterios sobre las imágenes. Cuando el guardián y el player
 *  no usan la MISMA regla, el guardián aprueba una actividad que el player
 *  encoge en silencio, que es el fallo peor: nadie ve el error, solo faltan
 *  cosas al jugar. Una imagen cuenta como lado (una pareja dibujo↔palabra es
 *  legítima y es media razón de existir de Emparejar). */
/** @param {Pair|null|undefined} p */
export function pairComplete(p) {
  /** @param {unknown} v */
  const lleno = (v) => String(v ?? '').trim() !== '';
  return !!p
    && (lleno(p.left) || !!p.leftImage || !!p.image)
    && (lleno(p.right) || !!p.rightImage);
}

/** LOS PARES DE ESTA ACTIVIDAD. Dueño único del «dónde está la lista» del
 *  modelo `pairs`: Emparejar y Memoria lo tenían tecleado cada uno por su
 *  cuenta, y sin `?? []` —con el contenido a medias, el editor reventaba antes
 *  de pintar nada.
 * @param {{content?: unknown}|null|undefined} a @returns {Pair[]} */
export function paresDe(a) {
  const c = /** @type {PairsContent|null|undefined} */ (a?.content);
  return Array.isArray(c?.pairs) ? c.pairs : [];
}
