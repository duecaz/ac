// Tests for core/textMarks.js — the pure answer-key logic behind tildes & comas.
// Run: node tests/textMarks.test.mjs
import assert from 'node:assert';
import {
  isVowel, applyTilde, applyMarks, hasMarks,
  parseAccentedText, parseTextWithCommas, parseRichText, stripAccents,
} from '../core/textMarks.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ---------- isVowel / applyTilde ----------
assert.ok(isVowel('a') && isVowel('Á') && isVowel('í'));
assert.ok(!isVowel('ñ') && !isVowel('b') && !isVowel(' '));
assert.strictEqual(applyTilde('a'), 'á');
assert.strictEqual(applyTilde('O'), 'Ó');
assert.strictEqual(applyTilde('é'), 'é', 'already accented stays');
assert.strictEqual(applyTilde('b'), 'b', 'non-vowel unchanged');
ok('isVowel/applyTilde: vowels (ñ/ü excluded), case preserved, idempotent');

// ---------- parseAccentedText (author types accents → stripped text + marks) ----------
const pa = parseAccentedText('canción');
assert.strictEqual(pa.text, 'cancion', 'accents stripped, length preserved');
assert.deepStrictEqual(pa.marks, [{ pos: 5, kind: 'tilde' }], 'mark at the accented index');
// Round-trip: applying the marks rebuilds the original.
assert.strictEqual(applyMarks(pa.text, pa.marks), 'canción', 'parse→apply round-trips');
ok('parseAccentedText: strips accents, records positions, round-trips via applyMarks');

const multi = parseAccentedText('árbol pequeño'); // á at 0, ñ NOT a tilde
assert.strictEqual(multi.text, 'arbol pequeño');
assert.deepStrictEqual(multi.marks, [{ pos: 0, kind: 'tilde' }], 'ñ is not treated as a tilde');
ok('parseAccentedText: ñ left intact, only acute accents become marks');

// ---------- parseTextWithCommas ----------
const pc = parseTextWithCommas('hola, mundo');
assert.strictEqual(pc.text, 'hola mundo', 'comma removed from student text');
assert.deepStrictEqual(pc.marks, [{ pos: 3, kind: 'coma' }], 'pos = char BEFORE the comma');
assert.strictEqual(applyMarks(pc.text, pc.marks), 'hola, mundo', 'comma re-inserted at pos+1');
ok('parseTextWithCommas: removes commas, marks preceding char, round-trips');

// leading comma is ignored (no preceding char)
assert.deepStrictEqual(parseTextWithCommas(', hola').marks, [], 'leading comma has no anchor → dropped');
ok('parseTextWithCommas: leading comma without anchor is dropped');

// ---------- parseRichText (accents + commas in one pass) ----------
const pr = parseRichText('canción, popular');
assert.strictEqual(pr.text, 'cancion popular');
assert.deepStrictEqual(pr.marks, [{ pos: 5, kind: 'tilde' }, { pos: 6, kind: 'coma' }]);
assert.strictEqual(applyMarks(pr.text, pr.marks), 'canción, popular', 'rich parse round-trips');
ok('parseRichText: tildes + commas together, round-trips via applyMarks');

// ---------- applyMarks ordering (insertions descending keep indices stable) ----------
const txt = 'abcde';
const marks = [{ pos: 0, kind: 'coma' }, { pos: 3, kind: 'coma' }];
assert.strictEqual(applyMarks(txt, marks), 'a,bcd,e', 'multiple insertions land correctly');
ok('applyMarks: multiple comma insertions stay aligned');

// ---------- stripAccents / hasMarks ----------
assert.strictEqual(stripAccents('Canción Ágil'), 'Cancion Agil');
assert.ok(hasMarks({ marks: [{ pos: 1, kind: 'tilde' }] }));
assert.ok(!hasMarks({ marks: [] }) && !hasMarks({}));
ok('stripAccents removes accents; hasMarks detects presence');

console.log(`\ntextMarks.test: ${passed} checks passed`);
