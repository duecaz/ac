// Mode registry tests (pure). Verifies that the SINGLE source of truth for
// game-mode availability (core/modes.js) gates each mode correctly per
// activity/template — so the activity page bar can't drift from reality, and a
// new template/activity gets the right modes automatically.
//
// Run: node tests/modes.test.mjs
import assert from 'node:assert';
import { registerTemplate } from '../core/registry.js';
import { MODE_DEFS, availableModes, isModeAvailable, getMode, runMode, modesForTemplate } from '../core/modes.js';

let passed = 0;
const ok = (msg) => { passed++; console.log('  ✓', msg); };

// A fully-capable, scoring + live + async template (à la Quiz).
registerTemplate({
  meta: { name: 'm_full', label: 'Full', contentModel: 'qa', modes: { solo: true, live: true, async: true } },
  renderPlayer() {}, renderEditor() {},
  renderRound() {}, getRoundPayload() {}, scoreSubmission() { return { correct: true, points: 1 }; }
});
// A tool-only template: no scorer, no live/async (à la Ruleta).
registerTemplate({
  meta: { name: 'm_tool', label: 'Tool', contentModel: 'entries', modes: { solo: true, live: false, async: false } },
  renderPlayer() {}, renderEditor() {}
});

const ids = (act) => availableModes(act).map(m => m.id);

// ---- Registry shape (guards against accidental breakage) ----
assert.deepStrictEqual(MODE_DEFS.map(m => m.id), ['solo', 'vs', 'teams', 'live', 'task'],
  'MODE_DEFS lists the five known modes in order');
for (const m of MODE_DEFS) {
  assert.ok(m.label && m.icon && m.color, `${m.id} has label/icon/color`);
  assert.strictEqual(typeof m.isAvailable, 'function', `${m.id} has isAvailable()`);
  if (!m.embed) assert.strictEqual(typeof m.href, 'function', `${m.id} (embed:false) has href()`);
}
ok('every mode def has the required shape');

// ---- Full template with ≥2 items: everything available ----
const full = { id: 'a1', template: 'm_full', content: { items: [{}, {}, {}] } };
assert.ok(isModeAvailable('solo', full), 'solo always available');
assert.ok(isModeAvailable('vs', full), 'vs available (scorer + renderRound + ≥2 items)');
assert.ok(isModeAvailable('teams', full), 'teams available (has items)');
assert.ok(isModeAvailable('live', full), 'live available (meta.modes.live)');
assert.ok(isModeAvailable('task', full), 'task available (meta.modes.async)');
assert.deepStrictEqual(ids(full), ['solo', 'vs', 'teams', 'live', 'task'], 'full activity shows all five modes');
ok('full + ≥2 items → all modes available');

// ---- VS needs ≥2 items: one item disables VS, keeps the rest ----
const oneItem = { id: 'a2', template: 'm_full', content: { items: [{}] } };
assert.ok(!isModeAvailable('vs', oneItem), 'vs needs 2+ items');
assert.ok(isModeAvailable('teams', oneItem), 'teams ok with a single item');
ok('vs gated by item count (≥2)');

// ---- Tool template: no vs, no live; task is HIDDEN (not just disabled) ----
const tool = { id: 'a3', template: 'm_tool', content: { entries: ['a', 'b', 'c'] } };
assert.ok(!isModeAvailable('vs', tool), 'vs unavailable without a scorer');
assert.ok(!isModeAvailable('live', tool), 'live unavailable when meta.modes.live is false');
assert.ok(!isModeAvailable('task', tool), 'task unavailable when meta.modes.async is false');
assert.ok(ids(tool).includes('teams'), 'teams still offered for a tool with entries');
assert.ok(!ids(tool).includes('task'), 'task is hidden (hideWhenUnavailable) for tool template');
assert.ok(ids(tool).includes('live'), 'live stays VISIBLE-but-disabled (only task hides)');
ok('tool template hides Tarea but keeps others visible/disabled');

// ---- Empty activity: teams unavailable (no rounds) ----
const empty = { id: 'a4', template: 'm_full', content: { items: [] } };
assert.ok(!isModeAvailable('teams', empty), 'teams needs at least one round');
ok('empty activity disables teams');

// ---- modesForTemplate: capability per template (no content yet) ----
// Drives the template-selector chips: depends only on what the CLASS can do.
const Tfull = { meta: { name: 'm_full', modes: { live: true, async: true } },
  renderRound() {}, getRoundPayload() {}, scoreSubmission() {} };
const Ttool = { meta: { name: 'm_tool', modes: {} }, renderPlayer() {} };
assert.deepStrictEqual(modesForTemplate(Tfull).map(m => m.id), ['solo', 'vs', 'teams', 'live', 'task'],
  'full template can offer every mode');
assert.deepStrictEqual(modesForTemplate(Ttool).map(m => m.id), ['solo'],
  'a tool template (no scorer/renderRound/live/async) offers only solo');
// Memory is teams-capable by name even without renderRound (native mechanic).
assert.ok(modesForTemplate({ meta: { name: 'memory', modes: {} } }).some(m => m.id === 'teams'),
  'memory is teams-capable via its native mechanic');
// Every mode exposes a short label for the selector chips.
assert.ok(MODE_DEFS.every(m => typeof m.short === 'string' && m.short),
  'every mode has a short label');
ok('modesForTemplate derives template capability from the same registry');

// ---- getMode + runMode guardrails ----
assert.strictEqual(getMode('vs').id, 'vs', 'getMode finds by id');
assert.strictEqual(getMode('nope'), undefined, 'getMode returns undefined for unknown');
await assert.rejects(() => runMode('live', {}, full), /no embebible/i,
  'runMode refuses an embed:false mode (those navigate, not mount)');
ok('runMode rejects non-embeddable modes');

console.log(`\nmodes.test: ${passed} assertions passed`);
