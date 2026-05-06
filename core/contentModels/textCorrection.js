// Content model: a list of passages, each with character-indexed marks
// indicating which positions need a tilde / coma / punto.
//
//   passages: [
//     {
//       id: 'p1',
//       text: 'la cancion popular',
//       marks: [
//         { pos: 6, kind: 'tilde' }   // 'cancion' -> 'canción' at position 6 ('o')
//       ]
//     }
//   ]
//
// Used by the 'tildes' template (and future siblings: 'comas', 'puntos').
// Mark kinds:
//   'tilde'  → adds an acute accent to the vowel at pos
//   'coma'   → inserts a comma after pos
//   'punto'  → inserts a period after pos
//
// Resolving the corrected text from text+marks is done in core/textMarks.js
// so editor preview and player share the logic.

export function newEmpty() {
  return { passages: [{ id: rid(), text: '', marks: [] }] };
}

export function newPassage() {
  return { id: rid(), text: '', marks: [] };
}

export function validate(content) {
  const errs = [];
  if (!Array.isArray(content?.passages)) errs.push('passages must be an array');
  return errs;
}

function rid() { return 'p_' + Math.random().toString(36).slice(2, 8); }
