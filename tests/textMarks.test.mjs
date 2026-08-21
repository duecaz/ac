// Tests for core/textMarks.js — the pure answer-key logic behind tildes & comas.
// Run: node tests/textMarks.test.mjs
import assert from 'node:assert';
import {
  isVowel, applyTilde, applyMarks, hasMarks,
  parseAccentedText, parseTextWithCommas, parseRichText, stripAccents,
  scoreMarksPerHit,
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

// ---------- tildes DESCOMPUESTAS (NFD): pegar de Word/web no debe perder marcas ----------
// 'canción jugó' con acentos combinantes (vocal + U+0301) debe contar 2 tildes, igual
// que la forma precompuesta. Sin normalizar a NFC, marks=0 → denominador falso ("3/4").
{
  const nfd = 'canción jugó'.normalize('NFD');
  const p = parseAccentedText(nfd);
  assert.strictEqual(p.text, 'cancion jugo', 'NFD: acentos combinantes eliminados del texto del alumno');
  assert.strictEqual(p.marks.filter(m => m.kind === 'tilde').length, 2, 'NFD: cuenta las 2 tildes (no 0)');
  assert.strictEqual(applyMarks(p.text, p.marks), 'canción jugó', 'NFD round-trip a precompuesto');
  // parseRichText también normaliza
  const pr2 = parseRichText('jugó, más'.normalize('NFD'));
  assert.strictEqual(pr2.marks.filter(m => m.kind === 'tilde').length, 2, 'parseRichText NFD: 2 tildes');
  ok('parse*: normaliza NFD→NFC, las tildes descompuestas se cuentan (fix denominador "3/4"→"3/8")');
}

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

// ---------- scoreMarksPerHit (NETO: +1 por buena, −1 por de más; marcar todo no gana) ----------
{
  const item = { marks: [{ pos: 3, kind: 'tilde' }, { pos: 7, kind: 'tilde' }] }; // 2 tildes
  const act = { scoring: { pointsPerCorrect: 1 } };
  const s = (v) => scoreMarksPerHit(v, item, ['tilde'], act);
  // puntos = max(0, aciertos − de más) × ppc.
  assert.deepStrictEqual(s([3, 7]), { correct: true, points: 2, hits: 2, over: 0, net: 2, total: 2, perfect: true }, 'ambas → 2 pts, perfecto');
  assert.deepStrictEqual(s([3]), { correct: true, points: 1, hits: 1, over: 0, net: 1, total: 2, perfect: false }, 'una buena → 1 pto (no perfecto: falta una)');
  // una buena + una de más → NETO 0 (la de más resta el acierto).
  assert.deepStrictEqual(s([3, 5]), { correct: false, points: 0, hits: 1, over: 1, net: 0, total: 2, perfect: false }, 'buena + de más → 0 (resta), over=1');
  assert.deepStrictEqual(s([]), { correct: false, points: 0, hits: 0, over: 0, net: 0, total: 2, perfect: false }, 'nada marcado → 0');
  // marcar TODO: los 2 aciertos se anulan con las 4 de más → neto 0 (no gana).
  const messy = s([1, 3, 5, 7, 9, 11]);
  assert.strictEqual(messy.points, 0, 'marcar todo → 0 (2 aciertos − 4 de más, con piso 0)');
  assert.strictEqual(messy.over, 4, 'las 4 de más se registran (tabla/desempate)');
  assert.strictEqual(messy.perfect, false, 'con marcas de más nunca es perfecto');
  // pointsPerCorrect (guardado EN la actividad) escala el neto por marca buena.
  assert.strictEqual(scoreMarksPerHit([3, 7], item, ['tilde'], { scoring: { pointsPerCorrect: 10 } }).points, 20, 'ppc=10 → 2 tildes × 10 = 20');
  assert.strictEqual(scoreMarksPerHit([3, 7], item, ['tilde'], {}).points, 2, 'sin scoring → ppc=1 por defecto');
  ok('scoreMarksPerHit: NETO (buenas − de más, piso 0); marcar todo no gana');
}

// ── PEGAR UN TEXTO QUE YA EXISTE ────────────────────────────────────────────
// El caso que lo pidió: el dueño quería frases de «Los nueve monstruos» y la IA
// devolvió versos AL ESTILO de Vallejo, ninguno del poema. Un modelo imita — eso
// es lo que hace bien— y para un texto concreto imitar es el resultado
// equivocado: se proyecta en clase como si fuera el poema y no lo es. Cuando el
// profe ya tiene el texto no hay nada que inventar, y este corte es exacto.
{
  const { partirEnParrafos, LINEAS_POR_PARRAFO } = await import('../core/contentModels/textCorrection.js');
  const poema = [
    '«Los nueve monstruos»',
    'Y, desgraciadamente,',
    'el dolor crece en el mundo a cada rato,',
    '',                                        // la estrofa separa, no corta
    'crece a treinta minutos por segundo, paso a paso,',
    'Jamás, hombres humanos,',
    'hubo tanto dolor en el pecho, en la solapa, en la cartera.',
  ].join('\n');

  // LA UNIDAD ES EL PÁRRAFO, NO EL VERSO. Cortar por versos daba 29 elementos de
  // una línea: «jamás el fuego nunca» no da para un ejercicio, y 29 pantallas no
  // son una clase. Tres líneas seguidas sí tienen sentido y sí dan trabajo.
  const parrafos = partirEnParrafos(poema);
  assert.strictEqual(LINEAS_POR_PARRAFO, 3, 'tres líneas por defecto (decisión del dueño)');
  assert.strictEqual(parrafos.length, 2, '7 líneas útiles en grupos de 3 → 2 párrafos (el último, corto)');
  assert.ok(parrafos[0].includes('«Los nueve monstruos»') && parrafos[0].includes('a cada rato'),
    'el párrafo junta las líneas seguidas, saltándose los blancos');
  assert.ok(!parrafos.some(p => /\n/.test(p)), 'y queda como texto continuo, que es lo que el alumno lee');

  // El número de líneas lo elige el profe: un poema no se corta como una lectura.
  assert.strictEqual(partirEnParrafos(poema, { lineas: 1 }).length, 6, 'con 1 línea, cada verso es un elemento');
  assert.strictEqual(partirEnParrafos(poema, { lineas: 6 }).length, 1, 'con 6, el poema entero cabe en uno');

  assert.deepStrictEqual(partirEnParrafos('Sí.\nNo.\n  \n', { lineas: 1 }), [],
    'los restos demasiado cortos no entran');
  assert.strictEqual(partirEnParrafos('').length, 0, 'y pegar nada no crea nada');

  // CONTRA-PRUEBA: lo pegado llega LITERAL a la actividad — es todo el motivo de
  // que exista esta puerta. Se comprueba con el parser real de Tildes.
  const verso = 'Jamás tanto cariño doloroso, jamás tanta cerca arremetió lo lejos';
  const { text, marks } = parseAccentedText(partirEnParrafos(verso, { lineas: 1 })[0]);
  assert.strictEqual(applyMarks(text, marks), verso, 'el texto vuelve tal cual: ni una palabra cambiada');

  // Y EL CRITERIO PARA DEJARLO ENTRAR: que TENGA algo que corregir. Un poema trae
  // versos sin una sola tilde; colarlos llenaba el panel de «el texto 43 no tiene
  // ninguna marca señalada» — cuarenta reproches por líneas que el profe no
  // había escrito. La marca es lo que decide, no la longitud.
  assert.strictEqual(parseAccentedText('crece a treinta minutos por segundo').marks.length, 0,
    'un verso sin tildes no da ninguna marca: en el juego no habría nada que tocar');
  assert.ok(parseAccentedText('Jamás, hombres humanos,').marks.length > 0,
    'CONTRA-PRUEBA: el verso que sí lleva tilde entra');
  ok('pegar un texto lo agrupa en párrafos y lo conserva LITERAL (la IA imita; esto no)');
}

console.log(`\ntextMarks.test: ${passed} checks passed`);
