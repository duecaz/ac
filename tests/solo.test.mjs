// SOLO/Wordwall foundation tests (pure logic). Run: node tests/solo.test.mjs
// Covers the non-DOM core that the single-device experience relies on:
// answer-checking, scoring, and activity migration/normalisation.
import assert from 'node:assert';
import { isCorrect } from '../core/contentModels/qa.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';
import { migrate, normalize, activityItemCount, newActivityId, newActivity } from '../core/migrate.js';
import { registerTemplate } from '../core/registry.js';
import { SCHEMA_VERSION } from '../core/constants.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ---------- qa.isCorrect (accent/case-insensitive matching) ----------
assert.strictEqual(isCorrect({ answer: 'Canción' }, 'cancion'), true);
assert.strictEqual(isCorrect({ answer: 'Lima' }, '  lima  '), true);
assert.strictEqual(isCorrect({ answer: 'Lima' }, 'Cusco'), false);
assert.strictEqual(isCorrect({ answer: null }, 'x'), null, 'no answer key → null (unscorable)');
assert.strictEqual(isCorrect({ answer: ['rojo', 'colorado'] }, 'COLORADO'), true, 'array answers match any');
assert.strictEqual(isCorrect({ answer: ['rojo', 'colorado'] }, 'azul'), false);
ok('isCorrect: case/accent-insensitive, trims, supports array answers, null when unscorable');

// ---------- scoreQuizSubmission (pure, shared SOLO + LIVE) ----------
const flat = { scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 } };
assert.deepStrictEqual(scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 3 }, activity: flat }),
  { correct: true, points: 3 }, 'flat: uses item.points');
assert.deepStrictEqual(scoreQuizSubmission({ value: 'a', item: { answer: 'b', points: 3 }, activity: flat }),
  { correct: false, points: 0 }, 'flat: wrong → 0 when no penalty');
assert.deepStrictEqual(
  scoreQuizSubmission({ value: 'a', item: { answer: 'b' }, activity: { scoring: { pointsPerWrong: -1 } } }),
  { correct: false, points: -1 }, 'flat: negative penalty applies on wrong');
assert.strictEqual(
  scoreQuizSubmission({ value: 'x', item: { answer: null }, activity: flat }).correct, null,
  'unscorable item → correct null');
ok('scoreQuizSubmission: flat scoring, penalties, unscorable');

// kahoot speed scoring (solo advanced + live)
const kahoot = { scoring: { mode: 'kahoot' }, live: { questionTimer: 20, speedBonusMax: 1000 } };
const fast = scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 2 }, msTaken: 0, activity: kahoot, mode: 'solo' });
const slow = scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 2 }, msTaken: 20000, activity: kahoot, mode: 'solo' });
assert.strictEqual(fast.points, 2000, 'kahoot: instant answer = base*500 + full speed bonus');
assert.strictEqual(slow.points, 1000, 'kahoot: at deadline = base*500 + 0 bonus');
assert.ok(fast.points > slow.points, 'kahoot: faster scores higher');
const live = scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 2 }, msTaken: 0,
  activity: { live: { pointsModel: 'kahoot', questionTimer: 20, speedBonusMax: 1000 } }, mode: 'live' });
assert.strictEqual(live.points, 2000, 'live mode honours live.pointsModel=kahoot');
ok('scoreQuizSubmission: kahoot speed bonus (solo advanced + live)');

// ---------- migrate / normalize ----------
// v1 (legacy { items }) migrates all the way to SCHEMA_VERSION.
const v1 = { id: 'a1', template: 'quiz', items: [{ question: 'q', answer: 'a' }],
             createdAt: '2026-01-01', updatedAt: '2026-01-01' };
const m = migrate(v1);
assert.strictEqual(m.schemaVersion, SCHEMA_VERSION, 'reaches current schema');
assert.deepStrictEqual(m.content.items, [{ question: 'q', answer: 'a' }], 'items moved into content');
assert.ok(m.rules && m.scoring && m.review && m.presentation && m.live, 'all sections filled');
assert.strictEqual(m.visibility, 'private');
ok('migrate: legacy v1 → current schema, items relocated, defaults filled');

// Idempotency: migrating an already-current activity changes nothing.
assert.deepStrictEqual(migrate(m), m, 'migrate is idempotent on a current activity');
ok('migrate: idempotent');

// normalize fills defaults from generic constants when template unknown.
const n = normalize({ id: 'x', template: 'doesNotExist', createdAt: 'c', updatedAt: 'u' });
assert.strictEqual(n.rules.shuffleOptions, true, 'generic DEFAULT_RULES applied');
assert.strictEqual(n.scoring.mode, 'flat');
assert.strictEqual(n.title, 'Sin título');
ok('normalize: generic defaults when template not registered');

// normalize prefers the template's own default factories when present.
registerTemplate({ meta: { name: 't_factory', contentModel: 'qa', modes: { solo: true },
  defaultRules: () => ({ timer: 42, custom: true }) }, renderPlayer() {}, renderEditor() {} });
const nf = normalize({ id: 'y', template: 't_factory' });
assert.strictEqual(nf.rules.timer, 42, 'template defaultRules used');
assert.strictEqual(nf.rules.custom, true);
ok('normalize: template default factories override generics');

// activityItemCount across content shapes.
assert.strictEqual(activityItemCount({ content: { items: [1, 2, 3] } }), 3);
assert.strictEqual(activityItemCount({ content: { pairs: [1, 2] } }), 2);
assert.strictEqual(activityItemCount({ content: { entries: ['a'] } }), 1);
assert.strictEqual(activityItemCount({ content: { passages: [1, 2, 3, 4] } }), 4);
assert.strictEqual(activityItemCount({ content: {} }), 0);
ok('activityItemCount: counts items/pairs/entries/passages, 0 when empty');

// newActivityId shape + newActivity is normalised.
assert.match(newActivityId(), /^act_[0-9a-zA-Z]{10}$/, 'id format act_<10>');
const fresh = newActivity('t_factory');
assert.strictEqual(fresh.template, 't_factory');
assert.strictEqual(fresh.schemaVersion, SCHEMA_VERSION);
assert.strictEqual(fresh.rules.timer, 42, 'newActivity uses template defaults');
ok('newActivityId/newActivity: well-formed and normalised');

console.log(`\nsolo.test: ${passed} checks passed`);
