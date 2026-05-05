// Content model: a flat list of entries. Used by Wheel, Random Cards, Flashcards.
export function newEmpty() { return { entries: ['', '', '', ''] }; }
export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.entries)) errs.push('entries must be an array');
  return errs;
}
