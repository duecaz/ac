// Lightweight Node test for the content engine. Run: node tests/content.test.mjs
import assert from 'node:assert';
import { getModel, listModelNames } from '../kernel/content/models.js';
import { canConvert, convert, convertibleTargets } from '../kernel/content/convert.js';
import { switchOptions, applySwitch } from '../kernel/content/switch.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// --- models ---
assert.deepStrictEqual(listModelNames().sort(), ['entries', 'pairs', 'qa', 'textCorrection']);
ok('all four content models registered');
assert.strictEqual(getModel('qa').validate({ items: [{}] }).ok, true);
assert.strictEqual(getModel('qa').validate({ items: [] }).ok, false);
assert.strictEqual(getModel('pairs').validate({ pairs: 'nope' }).ok, false);
ok('model validate() returns {ok, errors}');

// --- converters ---
const qa = { items: [
  { id: 'q1', question: 'Capital de Perú', answer: 'Lima', options: ['Lima'] },
  { id: 'q2', question: '2+2', answer: '4', options: ['4'] },
] };
assert.ok(canConvert('qa', 'pairs') && canConvert('qa', 'entries'));
assert.ok(canConvert('qa', 'qa'), 'identity always convertible');
assert.ok(!canConvert('textCorrection', 'qa'), 'textCorrection has no cross-model converter');

const toPairs = convert('qa', 'pairs', qa);
assert.deepStrictEqual(toPairs.pairs.map(p => [p.left, p.right]),
  [['Capital de Perú', 'Lima'], ['2+2', '4']]);
ok('qa → pairs maps question/answer');

const toEntries = convert('qa', 'entries', qa);
assert.deepStrictEqual(toEntries.entries, ['Capital de Perú', '2+2']);
ok('qa → entries maps questions');

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

assert.deepStrictEqual(convert('pairs', 'entries', pairsContent).entries,
  ['dog', 'perro', 'cat', 'gato', 'sun', 'sol']);
ok('pairs → entries flattens both sides');

// empty / degenerate input degrades to null
assert.strictEqual(convert('qa', 'pairs', { items: [{ question: 'x', answer: '' }] }), null);
ok('converter returns null when no valid content (graceful degradation)');

assert.deepStrictEqual(convertibleTargets('qa').sort(), ['entries', 'pairs']);
ok('convertibleTargets lists reachable models');

// --- switch engine (with fake template registry) ---
const T = (name, contentModel, extra = {}) => ({
  meta: { name, label: name, contentModel, modes: { solo: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}), ...extra },
  renderPlayer() {}, renderEditor() {},
});
const templates = [
  T('quiz', 'qa'), T('match', 'pairs'), T('memory', 'pairs'),
  T('wheel', 'entries'), T('tildes', 'textCorrection'),
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

console.log(`\ncontent.test: ${passed} checks passed`);
