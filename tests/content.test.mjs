// Lightweight Node test for the content engine. Run: node tests/content.test.mjs
import assert from 'node:assert';
import { getModel, listModelNames } from '../kernel/content/models.js';
import { canConvert, convert, convertibleTargets } from '../kernel/content/convert.js';
import { switchOptions, applySwitch, duplicateSwitch } from '../kernel/content/switch.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// --- models ---
// Los 8: uno por cada contentModel que declara alguna plantilla (el contrato
// tests/templateContract.test.mjs exige que TODO contentModel esté registrado).
assert.deepStrictEqual(listModelNames().sort(),
  ['ballsort', 'colorear', 'diagram', 'entries', 'items', 'pairs', 'puzzle', 'qa', 'tangram', 'textCorrection', 'words']);
ok('all eight content models registered');
assert.strictEqual(getModel('qa').validate({ items: [{}] }).ok, true);
assert.strictEqual(getModel('qa').validate({ items: [] }).ok, false);
assert.strictEqual(getModel('pairs').validate({ pairs: 'nope' }).ok, false);
assert.strictEqual(getModel('items').validate({ items: [] }).ok, true);
assert.strictEqual(getModel('words').validate({ words: 'nope' }).ok, false);
assert.strictEqual(getModel('ballsort').validate({ items: [] }).ok, true);
assert.strictEqual(getModel('diagram').validate({ image: null, pins: [] }).ok, true);
ok('model validate() returns {ok, errors}');

// --- converters ---
const qa = { items: [
  { id: 'q1', question: 'Capital de Perú', answer: 'Lima', options: ['Lima'] },
  { id: 'q2', question: '2+2', answer: '4', options: ['4'] },
] };
assert.ok(canConvert('qa', 'pairs') && canConvert('qa', 'items'));
assert.ok(canConvert('qa', 'qa'), 'identity always convertible');
assert.ok(!canConvert('textCorrection', 'qa'), 'textCorrection has no cross-model converter');
// Retirados al quedar `entries` huérfano (la Ruleta migró a items): un conversor
// hacia un modelo sin plantilla viva no se ofrece nunca — código muerto.
assert.ok(!canConvert('qa', 'entries') && !canConvert('pairs', 'entries'), 'sin conversores a entries (huérfano)');

const toPairs = convert('qa', 'pairs', qa);
assert.deepStrictEqual(toPairs.pairs.map(p => [p.left, p.right]),
  [['Capital de Perú', 'Lima'], ['2+2', '4']]);
ok('qa → pairs maps question/answer');

// qa → items (Ruleta/Abre Cajas): question→q, conserva la imagen.
const toItems = convert('qa', 'items', { items: [
  { id: 'q1', question: 'Capital de Perú', answer: 'Lima', options: ['Lima'], image: 'data:img' },
  { id: 'q2', question: '2+2', answer: '4', options: ['4'] },
] });
assert.deepStrictEqual(toItems.items.map(i => [i.question, i.image]),
  [['Capital de Perú', 'data:img'], ['2+2', null]]);
assert.ok(toItems.items.every(i => i.id?.startsWith('it_')), 'ids con prefijo it_');
ok('qa → items conserva question e image (Quiz → Ruleta restaurado)');

const pairsContent = { pairs: [
  { id: 'p1', left: 'dog', right: 'perro' },
  { id: 'p2', left: 'cat', right: 'gato' },
  { id: 'p3', left: 'sun', right: 'sol' },
] };
const backToQa = convert('pairs', 'qa', pairsContent);
assert.strictEqual(backToQa.items.length, 3);
assert.strictEqual(backToQa.items[0].answer, 'perro');
assert.ok(backToQa.items[0].options.includes('perro'), 'answer is among options');
assert.ok(backToQa.items[0].options.length > 1, 'distractors added from other rights');
ok('pairs → qa builds questions with distractors');

assert.deepStrictEqual(convert('pairs', 'items', pairsContent).items.map(i => i.question),
  ['dog', 'perro', 'cat', 'gato', 'sun', 'sol']);
ok('pairs → items flattens both sides (Match → Ruleta restaurado)');

// empty / degenerate input degrades to null
assert.strictEqual(convert('qa', 'pairs', { items: [{ question: 'x', answer: '' }] }), null);
ok('converter returns null when no valid content (graceful degradation)');

assert.deepStrictEqual(convertibleTargets('qa').sort(), ['items', 'pairs']);
ok('convertibleTargets lists reachable models');

// NOTA: el check "todo conversor une modelos con plantilla viva" vive en
// tests/templateContract.test.mjs — necesita registrar las 12 plantillas, y
// hacerlo AQUÍ contaminaba las suites que corren después en run.mjs (migrate()
// empieza a aplicar el migrateContent real de cada plantilla registrada).

// --- switch engine (with fake template registry) ---
const T = (name, contentModel, extra = {}) => ({
  meta: { name, label: name, contentModel, modes: { solo: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}), ...extra },
  renderPlayer() {}, renderEditor() {},
});
const templates = [
  T('quiz', 'qa'), T('match', 'pairs'), T('memory', 'pairs'),
  T('wheel', 'items'), T('tildes', 'textCorrection'),
];

const activity = { template: 'quiz', content: qa, rules: { timer: 99 } };
const opts = switchOptions(activity, templates);
const names = opts.map(o => o.template.meta.name);
assert.ok(!names.includes('quiz'), 'switch excludes self');
assert.ok(!names.includes('tildes'), 'switch excludes unreachable textCorrection');
assert.ok(names.includes('match') && names.includes('wheel'), 'offers reachable targets');
assert.ok(opts.every(o => o.valid), 'all offered options validate');
ok('switchOptions lists reachable, valid targets and excludes self/unreachable');

const switched = applySwitch(activity, 'match', templates);
assert.strictEqual(switched.template, 'match');
assert.strictEqual(switched.content.pairs.length, 2);
assert.notStrictEqual(switched.rules, activity.rules, 'rules reset to target defaults');
assert.strictEqual(activity.template, 'quiz', 'input activity not mutated');
ok('applySwitch converts content and does not mutate input');

assert.strictEqual(applySwitch(activity, 'tildes', templates), null);
ok('applySwitch returns null for impossible switch');

// --- DUPLICAR como otra plantilla (D2 opción b) — la vía NO destructiva ------
// Desde la página de JUGAR, «otra plantilla» se toca por curiosidad («a ver
// cómo queda de globos»). Antes eso solo previsualizaba y no guardaba nada, y
// el dueño lo leyó como que «ya no convierte». Convertirlo en el sitio habría
// sido peor: lo que la plantilla destino no usa se pierde para siempre. Estas
// dos comprobaciones son justo esa promesa — nace una copia, la original no se
// toca — y la contra-prueba de que el destino imposible no inventa nada.
{
  const original = { id: 'act_orig', template: 'quiz', title: 'Capitales',
                     content: qa, rules: { timer: 99 }, visibility: 'public',
                     author: { id: 'u1', name: 'Profe' } };
  const antes = JSON.stringify(original);
  const copia = duplicateSwitch(original, 'match', templates, { id: 'act_nueva', now: '2026-08-18T00:00:00.000Z' });

  assert.ok(copia, 'la copia se crea');
  assert.notStrictEqual(copia.id, original.id, 'la copia tiene id PROPIO (si no, sobrescribe la original)');
  assert.strictEqual(copia.template, 'match', 'la copia lleva la plantilla pedida');
  assert.strictEqual(copia.forkOf, original.id, 'la copia recuerda de quién salió');
  assert.ok(copia.title.includes('Capitales'), 'conserva el título…');
  assert.ok(/\(.+\)/.test(copia.title), '…y añade la plantilla entre paréntesis, para distinguirlas en Mis actividades');
  assert.strictEqual(copia.visibility, 'unlisted', 'nace como borrador: publicar la copia lo decide quien la hizo');
  assert.strictEqual(copia.author, null, 'sin autor heredado — lo pone save() con la sesión de quien duplica');
  assert.ok(copia.content.pairs?.length, 'el contenido viene CONVERTIDO al modelo del destino');
  assert.strictEqual(JSON.stringify(original), antes,
    'LA ORIGINAL NO SE TOCA — es la promesa entera de esta vía frente a «Cambiar formato»');
  ok('duplicateSwitch crea una copia convertida y deja intacta la original (D2 · opción b)');

  assert.strictEqual(duplicateSwitch(original, 'tildes', templates, { id: 'x', now: 'x' }), null,
    'CONTRA-PRUEBA: a un destino inalcanzable no se le inventa una copia vacía');
  ok('duplicateSwitch devuelve null cuando la conversión no es posible');
}

console.log(`\ncontent.test: ${passed} checks passed`);
