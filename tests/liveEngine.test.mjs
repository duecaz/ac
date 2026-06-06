// Simulates a full LIVE match in memory (no Supabase, no DOM) to prove the flow
// works locally. Run: node tests/liveEngine.test.mjs
import assert from 'node:assert';
import { createLiveRoom } from '../kernel/live/engine.js';
import { registerTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Register a quiz-like template using the REAL pure scorer + a round payload.
registerTemplate({
  meta: { name: 'quiz_live', contentModel: 'qa', modes: { live: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
  renderPlayer() {}, renderEditor() {},
  scoreSubmission: scoreQuizSubmission,
  getRoundPayload(activity, ctx) {
    const it = activity.content.items[ctx.itemIndex];
    return it ? { question: it.question, options: it.options } : null;
  },
});

const activity = {
  id: 'a_live', template: 'quiz_live',
  scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 },
  live: { maxPlayers: 3, allowLateJoin: true },
  content: { items: [
    { id: 'q1', question: '2+2', answer: '4', options: ['3', '4', '5'], points: 1 },
    { id: 'q2', question: 'Capital de Perú', answer: 'Lima', options: ['Lima', 'Quito'], points: 2 },
  ] },
};

const room = createLiveRoom(activity, { code: 'ABC123' });

// ----- lobby & join -----
const ana = room.join('u-ana', 'Ana');
const beto = room.join('u-beto', 'Beto');
assert.strictEqual(room.state.players.length, 2);
assert.deepStrictEqual(room.join('u-ana', 'Ana'), ana, 'rejoin returns the same player (reconnect)');
assert.throws(() => room.join('u-x', 'a'), /Apodo/, 'bad nickname rejected at join');
ok('lobby: join, reconnect, nickname validation');

// maxPlayers enforced
room.join('u-c', 'Caro');
assert.throws(() => room.join('u-d', 'Dani'), /llena/, 'maxPlayers enforced');
ok('lobby: maxPlayers enforced');

// ----- round 1 -----
room.dispatch('start');
assert.strictEqual(room.phase, 'question');
assert.strictEqual(room.currentItem, 0);
// payload hides the answer
assert.ok(!('answer' in room.roundPayload()), 'round payload strips the answer (anti-cheat)');

// answers are NOT scored on submit
room.submit(ana.id, 0, '4', 500);
room.submit(beto.id, 0, '3', 800);
assert.strictEqual(room.state.answers[`0:${ana.id}`].correct, null, 'no scoring on submit');
ok('round1: start, answer-stripped payload, submissions unscored until settle');

// can't submit to the wrong item / phase
assert.throws(() => room.submit(ana.id, 1, 'x'), /fase/, 'cannot answer a non-current item');

// settle scores server-side
room.dispatch('reveal');
assert.strictEqual(room.phase, 'reveal');
assert.strictEqual(room.state.players.find(p => p.id === ana.id).score, 1, 'Ana correct → +1');
assert.strictEqual(room.state.players.find(p => p.id === beto.id).score, 0, 'Beto wrong → 0');
ok('round1: reveal settles scores server-side (Ana 1, Beto 0)');

// settle is idempotent (no double credit)
room.settle(0);
assert.strictEqual(room.state.players.find(p => p.id === ana.id).score, 1, 'idempotent settle');
ok('settle is idempotent (no double scoring on re-settle)');

// ----- advance to round 2 -----
room.dispatch('leaderboard');
const lb1 = room.leaderboard();
assert.deepStrictEqual(lb1[0], { rank: 1, name: 'Ana', score: 1 }, 'Ana leads');
room.dispatch('next');
assert.strictEqual(room.currentItem, 1);
assert.strictEqual(room.phase, 'question');
ok('leaderboard then next → question @1');

// round 2: Beto answers correctly (worth 2), Ana wrong
room.submit(ana.id, 1, 'Quito', 400);
room.submit(beto.id, 1, 'Lima', 600);
room.dispatch('reveal');
assert.strictEqual(room.state.players.find(p => p.id === beto.id).score, 2, 'Beto +2 on q2');
ok('round2: scoring accumulates across rounds');

// ----- end -----
const plan = room.dispatch('next'); // last item → end
assert.deepStrictEqual(plan, { type: 'end' });
assert.strictEqual(room.phase, 'ended');
assert.throws(() => room.join('u-late', 'Late'), /terminado/, 'cannot join an ended room');

const final = room.leaderboard();
assert.deepStrictEqual(final.map(r => [r.name, r.score]), [['Beto', 2], ['Ana', 1], ['Caro', 0]], 'final ranking by score');
ok('end: last item ends the match; final leaderboard ordered by score');

console.log(`\nliveEngine.test: ${passed} checks passed`);
