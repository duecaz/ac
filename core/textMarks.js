// Pure text+marks helpers, shared by the tildes editor and player.
// kind 'tilde' applies acute accent to vowels; case-preserved.
//
// La PUNTUACIÓN por marcas ya NO vive aquí: se movió a core/scoring/marks.js
// (fase P1 de docs/historico/handoff-puntuacion.md — este módulo es texto, no puntos).
// Re-export de compatibilidad para los llamadores existentes:
export { scoreMarks, scoreMarksPerHit } from './scoring/marks.js';

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
  // Normaliza ANTES de calcular posiciones: (1) NFC para que las tildes DESCOMPUESTAS
  // (vocal + U+0301 combinante, típico al pegar de Word/webs) se compongan a la forma
  // precompuesta que STRIP_MAP reconoce — sin esto, media frase pegada perdía tildes
  // (la marca no se registraba → el denominador de aciertos salía menor que las tildes
  // visibles: "3/4" cuando había 8); (2) colapsa saltos de línea y espacios múltiples a
  // uno solo (los poemas pegados fluyen como párrafo y no desbordan), así text + marks
  // quedan alineados.
  const chars = [...String(accented || '').normalize('NFC').replace(/\s+/g, ' ').trim()];
  const text = chars.map(c => STRIP_MAP[c] ?? c).join('');
  const marks = [];
  chars.forEach((c, i) => {
    if (STRIP_MAP[c]) marks.push({ pos: i, kind: 'tilde' });
  });
  return { text, marks };
}

// Strip only the accents (no marks). Useful for previews.
export function stripAccents(s) {
  return [...String(s || '').normalize('NFC')].map(c => STRIP_MAP[c] ?? c).join('');
}

// Reverse of applyMarks for kind='coma': given an input where the author
// already typed commas, produce { text: without commas, marks: [{pos, kind:'coma'}] }.
// pos refers to the index of the character BEFORE the comma in the
// stripped text (so applyMarks then re-inserts the comma at pos+1).
//
// Combined with parseAccentedText this lets a single textarea capture
// both tildes and commas — useful for combined exercises.
export function parseTextWithCommas(input) {
  let stripped = '';
  const marks = [];
  for (const c of [...String(input || '').normalize('NFC')]) {
    if (c === ',') {
      if (stripped.length > 0) marks.push({ pos: stripped.length - 1, kind: 'coma' });
    } else {
      stripped += c;
    }
  }
  return { text: stripped, marks };
}

// Combined rich parse: tildes AND commas (and periods) in one pass.
export function parseRichText(input) {
  let stripped = '';
  const marks = [];
  for (const c of [...String(input || '').normalize('NFC')]) {
    if (c === ',') {
      if (stripped.length > 0) marks.push({ pos: stripped.length - 1, kind: 'coma' });
    } else if (STRIP_MAP[c]) {
      stripped += STRIP_MAP[c];
      marks.push({ pos: stripped.length - 1, kind: 'tilde' });
    } else {
      stripped += c;
    }
  }
  return { text: stripped, marks };
}

// ── Analítica por parte (M1) — helpers de texto compartidos por tildes/comas ──
// Palabra que contiene la posición `pos` del texto (para etiquetar la marca en el
// heatmap: "la clase falla en jugó"). Devuelve la palabra "cruda" del texto sin
// tildes; para la coma, la palabra ANTES de la cual iría (pos = char previo).
export function wordAtPos(text, pos) {
  const s = String(text || '');
  if (pos < 0 || pos >= s.length) return '';
  let a = pos, b = pos;
  while (a > 0 && !/\s/.test(s[a - 1])) a--;
  while (b < s.length - 1 && !/\s/.test(s[b + 1])) b++;
  return s.slice(a, b + 1).replace(/[.,;:!?()"]/g, '');
}

// Partes de un pasaje = cada marca requerida de ese `kind` (una por tilde/coma a
// colocar). key = posición; label = palabra; ok = true (todas son requeridas).
export function markPartsFor(item, kind) {
  return (item?.marks || [])
    .filter(m => m.kind === kind)
    .map(m => ({ key: m.pos, label: wordAtPos(item.text, m.pos), ok: true }));
}

// Partes que marcó una respuesta = las posiciones que tocó el alumno.
export function markValueParts(value) {
  return (Array.isArray(value) ? value : []).map(Number);
}
