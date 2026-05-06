// Pure text+marks helpers, shared by the tildes editor and player.
// kind 'tilde' applies acute accent to vowels; case-preserved.

const TILDE_MAP = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú',
  // pre-accented stays as-is
  á: 'á', é: 'é', í: 'í', ó: 'ó', ú: 'ú',
  Á: 'Á', É: 'É', Í: 'Í', Ó: 'Ó', Ú: 'Ú'
};

// Reverse map: accented vowel -> base. Only acute accents on a/e/i/o/u.
// ñ and ü are NOT considered a tilde for this exercise.
const STRIP_MAP = {
  'á':'a','é':'e','í':'i','ó':'o','ú':'u',
  'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U'
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

// Reverse of applyMarks for kind='tilde': given an accented input from the
// author, produce { text: stripped, marks: [{pos, kind:'tilde'}, ...] }.
// Positions match positions in the stripped text (lengths are equal because
// we replace 1 char with 1 char). The student sees `text` (no accents);
// `marks` is the answer key.
export function parseAccentedText(accented) {
  const chars = [...String(accented || '')];
  const text = chars.map(c => STRIP_MAP[c] ?? c).join('');
  const marks = [];
  chars.forEach((c, i) => {
    if (STRIP_MAP[c]) marks.push({ pos: i, kind: 'tilde' });
  });
  return { text, marks };
}

// Strip only the accents (no marks). Useful for previews.
export function stripAccents(s) {
  return [...String(s || '')].map(c => STRIP_MAP[c] ?? c).join('');
}
