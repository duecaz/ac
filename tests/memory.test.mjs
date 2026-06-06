// Simulates a TEAMS memory game in memory (no DOM) to prove the flip/match/turn
// loop. Run: node tests/memory.test.mjs
import assert from 'node:assert';
import { createMemoryGame } from '../kernel/session/memory.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const activity = { content: { pairs: [
  { id: 'A', left: 'dog', right: 'perro' },
  { id: 'B', left: 'cat', right: 'gato' },
] } };
// order maps deck index → built-card index. Built deck (pre-shuffle) is:
//   0:A-dog 1:A-perro 2:B-cat 3:B-gato
// Lay them out in a known order so the test can pick deterministically.
const g = createMemoryGame(activity, { teams: ['Rojo', 'Azul'], order: [0, 2, 1, 3] });
// Now state.cards = [A-dog, B-cat, A-perro, B-gato]
const ids = g.state.cards.map(c => c.id);

assert.strictEqual(g.activeTeam().name, 'Rojo');
assert.strictEqual(g.totalPairs, 2);

// Rojo flips a miss: A-dog (idx0) + B-cat (idx1) → different pairId.
assert.deepStrictEqual(g.flip(ids[0]), { ok: true, pair: false });
let r = g.flip(ids[1]);
assert.strictEqual(r.matched, false, 'two different pairIds → miss');
assert.strictEqual(g.activeTeam().name, 'Rojo', 'turn not passed until cover()');
assert.throws(() => { if (!g.flip(ids[2]).ok) throw new Error('blocked'); }, /blocked/, 'cannot flip a 3rd while two are up');
g.cover();
assert.strictEqual(g.activeTeam().name, 'Azul', 'miss → turn passes after cover');
assert.strictEqual(g.state.cards[0].flipped, false, 'missed cards flipped back down');
ok('miss: two unmatched cards, turn passes to the next team on cover()');

// Azul matches A: A-dog (idx0) + A-perro (idx2).
g.flip(ids[0]);
r = g.flip(ids[2]);
assert.strictEqual(r.matched, true, 'same pairId → match');
assert.strictEqual(r.keepsTurn, true, 'match keeps the turn');
assert.strictEqual(g.activeTeam().name, 'Azul', 'still Azul after a match');
assert.strictEqual(g.activeTeam().score, 1, 'match scores a point');
assert.ok(g.state.cards[0].matched && g.state.cards[2].matched, 'matched cards stay up');
ok('match: same pairId scores, keeps the turn, cards stay matched');

// Azul matches B too → all pairs gone → game ends.
g.flip(ids[1]); // B-cat
r = g.flip(ids[3]); // B-gato
assert.strictEqual(r.matched, true);
assert.strictEqual(r.ended, true, 'last match ends the game');
assert.strictEqual(g.status, 'ended');
assert.strictEqual(g.leaderboard()[0].name, 'Azul');
assert.strictEqual(g.leaderboard()[0].score, 2);
ok('end: clearing the board ends the game; leaderboard ranks teams');

console.log(`\nmemory.test: ${passed} checks passed`);
