// Pairs content model: each item is a left/right pair (text or image).
// Used by Match Up, Find the Match, Memory, Flip Tiles, Pair/No Pair.
export function newEmpty() {
  return { pairs: [
    { id: 'p_'+rid(), left: '', right: '' },
    { id: 'p_'+rid(), left: '', right: '' },
    { id: 'p_'+rid(), left: '', right: '' },
    { id: 'p_'+rid(), left: '', right: '' }
  ]};
}
export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.pairs)) errs.push('pairs must be an array');
  return errs;
}
export function newPair() { return { id: 'p_'+rid(), left: '', right: '' }; }
function rid() { return Math.random().toString(36).slice(2, 8); }
