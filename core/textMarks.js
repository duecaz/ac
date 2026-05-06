// Pure text+marks helpers, shared by the tildes editor and player.
// kind 'tilde' applies acute accent to vowels; case-preserved.

const TILDE_MAP = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
  // pre-accented stays as-is
  á: 'á', é: 'é', í: 'í', ó: 'ó', ú: 'ú',
  Á: 'Á', É: 'É', Í: 'Í', Ó: 'Ó', Ú: 'Ú'
};

const TILDABLE = /[aeiouáéíóúAEIOUÁÉÍÓÚ]/;

export function isVowel(ch) { return TILDABLE.test(ch); }

export function applyTilde(ch) { return TILDE_MAP[ch] ?? ch; }

// Returns the corrected text after applying marks. Used for preview.
export function applyMarks(text, marks) {
  const chars = [...text];
  // Apply tildes (in-place) first, then commas/periods (insertions) in
  // descending position to keep indices stable.
  for (const m of marks || []) {
    if (m.kind === 'tilde' && chars[m.pos] && isVowel(chars[m.pos])) {
      chars[m.pos] = applyTilde(chars[m.pos]);
    }
  }
  // Insertions: process in descending pos.
  const insertions = (marks || []).filter(m => m.kind === 'coma' || m.kind === 'punto').sort((a, b) => b.pos - a.pos);
  for (const m of insertions) {
    const sym = m.kind === 'coma' ? ',' : '.';
    chars.splice(m.pos + 1, 0, sym);
  }
  return chars.join('');
}

// True if the passage has at least one mark.
export function hasMarks(passage) {
  return Array.isArray(passage?.marks) && passage.marks.length > 0;
}
