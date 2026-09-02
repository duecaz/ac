// Pairs content model: each item is a left/right pair (text or image).
// Used by Match Up, Find the Match, Memory, Flip Tiles, Pair/No Pair.
import { rid } from '../ids.js';
import { renderEditorShell } from '../editorShell.js';
export function newEmpty() {
  return { pairs: [
    { id: rid('p_'), left: '', right: '' },
    { id: rid('p_'), left: '', right: '' },
    { id: rid('p_'), left: '', right: '' },
    { id: rid('p_'), left: '', right: '' }
  ]};
}
export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.pairs)) errs.push('pairs must be an array');
  return errs;
}
export function newPair() { return { id: rid('p_'), left: '', right: '' }; }

/** ¿ESTA PAREJA SE PUEDE JUGAR? La regla vivía copiada en siete sitios —los dos
 *  players que descartan filas, el revisor que da el visto bueno, los modos…— y
 *  con distintos criterios sobre las imágenes. Cuando el guardián y el player
 *  no usan la MISMA regla, el guardián aprueba una actividad que el player
 *  encoge en silencio, que es el fallo peor: nadie ve el error, solo faltan
 *  cosas al jugar. Una imagen cuenta como lado (una pareja dibujo↔palabra es
 *  legítima y es media razón de existir de Emparejar). */
export function pairComplete(p) {
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
export function renderPairsEditor(root, activity, onChange, { seedCount, panels }) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: Array.from({ length: seedCount }, newPair) };
  renderEditorShell(root, a, onChange, panels);
}
