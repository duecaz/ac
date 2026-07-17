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
