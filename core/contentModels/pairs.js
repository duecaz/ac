// Pairs content model: each item is a left/right pair (text or image).
// Used by Match Up, Find the Match, Memory, Flip Tiles, Pair/No Pair.
import { rid } from '../ids.js';
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
