// SOLO/Wordwall foundation tests (pure logic). Run: node tests/solo.test.mjs
// Covers the non-DOM core that the single-device experience relies on:
// answer-checking, scoring, and activity migration/normalisation.
import assert from 'node:assert';
import { isCorrect } from '../core/contentModels/qa.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';
import { scoreMathSubmission } from '../templates/math/scorer.js';
import { scoreWordsearch } from '../templates/wordsearch/scorer.js';
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
// Desde P2 (handoff-puntuacion) el scorer devuelve además el MÉRITO hits/total.
assert.deepStrictEqual(scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 3 }, activity: flat }),
  { correct: true, points: 3, hits: 1, total: 1 }, 'flat: uses item.points (+mérito 1/1)');
assert.deepStrictEqual(scoreQuizSubmission({ value: 'a', item: { answer: 'b', points: 3 }, activity: flat }),
  { correct: false, points: 0, hits: 0, total: 1 }, 'flat: wrong → 0 when no penalty (+mérito 0/1)');
assert.deepStrictEqual(
  scoreQuizSubmission({ value: 'a', item: { answer: 'b' }, activity: { scoring: { pointsPerWrong: -1 } } }),
  { correct: false, points: -1, hits: 0, total: 1 }, 'flat: negative penalty applies on wrong');
assert.strictEqual(
  scoreQuizSubmission({ value: 'x', item: { answer: null }, activity: flat }).correct, null,
  'unscorable item → correct null');
ok('scoreQuizSubmission: flat scoring, penalties, unscorable');

// velocidad speed scoring (solo advanced + live)
const velocidad = { scoring: { mode: 'velocidad' }, live: { questionTimer: 20, speedBonusMax: 1000 } };
const fast = scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 2 }, msTaken: 0, activity: velocidad, mode: 'solo' });
const slow = scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 2 }, msTaken: 20000, activity: velocidad, mode: 'solo' });
assert.strictEqual(fast.points, 2000, 'velocidad: instant answer = base*500 + full speed bonus');
assert.strictEqual(slow.points, 1000, 'velocidad: at deadline = base*500 + 0 bonus');
assert.ok(fast.points > slow.points, 'velocidad: faster scores higher');
const live = scoreQuizSubmission({ value: 'a', item: { answer: 'a', points: 2 }, msTaken: 0,
  activity: { live: { pointsModel: 'velocidad', questionTimer: 20, speedBonusMax: 1000 } }, mode: 'live' });
assert.strictEqual(live.points, 2000, 'live mode honours live.pointsModel=velocidad');
ok('scoreQuizSubmission: velocidad speed bonus (solo advanced + live)');

// ---------- P5: escala UNIFICADA (docs/historico/handoff-puntuacion.md) ----------
// math en VIVO paga con el MISMO bonus de velocidad que quiz (antes: 1 plano
// mientras quiz pagaba ~1500 en la misma sesión de clase).
{
  const liveVelocidad = { live: { pointsModel: 'velocidad', questionTimer: 20, speedBonusMax: 1000 } };
  const m = scoreMathSubmission({ value: '4', item: { answer: '4', points: 2 }, msTaken: 0, activity: liveVelocidad, mode: 'live' });
  assert.deepStrictEqual(m, { correct: true, points: 2000, hits: 1, total: 1 }, 'math live = misma fórmula velocidad que quiz');
  assert.strictEqual(scoreMathSubmission({ value: '4', item: { answer: '4' }, activity: {} }).points, 1, 'math solo plano = 1');
  ok('P5 math: awardPoints — plano en solo, velocidad en vivo (como quiz)');
}
// wordsearch: ppc default 1 (antes 10), SIN bonus de longitud ni velocidad propio.
{
  const act = { content: { words: ['ELEFANTE', 'SOL'] }, scoring: {} };
  assert.deepStrictEqual(scoreWordsearch({ value: 'elefante', activity: act }), { correct: true, points: 1, hits: 1, total: 1 },
    'palabra larga = 1 punto (sin bonus de longitud, default 1)');
  assert.deepStrictEqual(scoreWordsearch({ value: 'luna', activity: act }), { correct: false, points: 0, hits: 0, total: 1 },
    'palabra fuera de la lista → 0');
  assert.strictEqual(scoreWordsearch({ value: 'sol', activity: { ...act, scoring: { pointsPerCorrect: 5 } } }).points, 5,
    'respeta pointsPerCorrect de la actividad');
  ok('P5 wordsearch: escala común (ppc→awardPoints), sin monedas propias');
}

// ---------- migrate / normalize ----------
// v1 (legacy { items }) migrates all the way to SCHEMA_VERSION.
const v1 = { id: 'a1', template: 'quiz', items: [{ question: 'q', answer: 'a' }],
             createdAt: '2026-01-01', updatedAt: '2026-01-01' };
const m = migrate(v1);
assert.strictEqual(m.schemaVersion, SCHEMA_VERSION, 'reaches current schema');
// Se comparan los CAMPOS del ítem, no el objeto exacto: con las plantillas
// registradas (como en la app real, y como quedan si otra suite las registró
// antes) migrate NORMALIZA además el ítem (p.ej. `answerIdx` del modelo qa). El
// deepStrictEqual de antes fijaba el comportamiento del registro VACÍO — un
// mundo que en producción no existe.
assert.strictEqual(m.content.items.length, 1, 'items moved into content');
assert.strictEqual(m.content.items[0].question, 'q', 'question preserved');
assert.strictEqual(m.content.items[0].answer, 'a', 'answer preserved');
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
