// Pairs content model: each item is a left/right pair (text or image).
// Used by Match Up, Find the Match, Memory, Flip Tiles, Pair/No Pair.
import { rid } from '../ids.js';
import { erroresDeLista } from '../../kernel/content/models.js';
import { renderEditorShell } from '../editorShell.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Pair} Pair
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
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

/** WRAPPER GENÉRICO DEL EDITOR — Emparejar y Memoria comparten el modelo
 *  `pairs` y con él la MISMA regla de arranque: si el contenido no es un
 *  array de pares, sembrarlo en blanco antes de montar el chasis (barrido B5,
 *  2026-09-02: los dos `renderXEditor` tenían la línea copiada, con solo el
 *  número de pares de partida distinto). El dueño de esa regla es el MODELO,
 *  no cada plantilla; cada una aporta solo sus paneles y su `seedCount`. */
/**
 * @param {Element} root
 * @param {import('../../kernel/contracts/activity.js').Activity<PairsContent>} activity
 * @param {(activity: Activity) => void} onChange
 * @param {{seedCount: number, panels: import('../editorShell.js').EditorSpec}} opts
 */
export function renderPairsEditor(root, activity, onChange, { seedCount, panels }) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: Array.from({ length: seedCount }, newPair) };
  renderEditorShell(root, /** @type {Activity} */ (a), onChange, panels);
}
