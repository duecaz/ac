// LIVE pure-logic tests: phase machine + nickname filter. Run: node tests/live.test.mjs
import assert from 'node:assert';
import { PHASES, isLastItem, planTransition } from '../core/livePhases.js';
import { isAcceptableNickname } from '../core/nicknameFilter.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ---------- phase machine: the happy path of a 2-item game ----------
const TOTAL = 2;
let s = { phase: PHASES.LOBBY, current_item: -1, status: 'lobby' };

let plan = planTransition(s, 'start', TOTAL);
assert.deepStrictEqual(plan, { type: 'patch', patch: { status: 'running', phase: 'question', current_item: 0 } });
s = { ...s, ...plan.patch };
ok('start: lobby → question @0');

plan = planTransition(s, 'reveal', TOTAL);
assert.deepStrictEqual(plan, { type: 'settle', itemIndex: 0 }, 'reveal = server-side settle of current item');
s = { ...s, phase: PHASES.REVEAL }; // the EF flips phase to reveal
ok('reveal: question → settle(itemIndex) (scoring is server-side)');

plan = planTransition(s, 'leaderboard', TOTAL);
assert.deepStrictEqual(plan.patch, { phase: 'leaderboard' });
s = { ...s, ...plan.patch };
ok('leaderboard: reveal → leaderboard');

plan = planTransition(s, 'next', TOTAL);
assert.deepStrictEqual(plan, { type: 'patch', patch: { phase: 'question', current_item: 1 } }, 'advances item');
s = { ...s, ...plan.patch };
ok('next: leaderboard → question @1 (not last)');

// reveal then next on the LAST item → end
s = { phase: PHASES.REVEAL, current_item: 1, status: 'running' };
assert.strictEqual(isLastItem(s, TOTAL), true);
assert.deepStrictEqual(planTransition(s, 'next', TOTAL), { type: 'end' }, 'last item → end');
ok('next on last item → end');

// ---------- invalid transitions are rejected (not silently applied) ----------
assert.strictEqual(planTransition({ phase: PHASES.QUESTION, current_item: 0 }, 'leaderboard', TOTAL).type, 'invalid');
assert.strictEqual(planTransition({ phase: PHASES.LOBBY, current_item: -1 }, 'next', TOTAL).type, 'invalid');
assert.strictEqual(planTransition({ phase: PHASES.LOBBY }, 'start', 0).type, 'invalid', 'cannot start an empty activity');
assert.strictEqual(planTransition({ phase: PHASES.QUESTION }, 'bogus', TOTAL).type, 'invalid');
ok('invalid transitions rejected with a reason');

// end is always allowed
assert.deepStrictEqual(planTransition({ phase: PHASES.QUESTION, current_item: 0 }, 'end', TOTAL), { type: 'end' });
ok('end is allowed from any phase');

// ---------- nickname filter ----------
assert.strictEqual(isAcceptableNickname('Pepe').ok, true);
assert.strictEqual(isAcceptableNickname('José_99').ok, true, 'letters/digits/._- allowed (accents ok)');
assert.strictEqual(isAcceptableNickname('a').ok, false, 'too short');
assert.strictEqual(isAcceptableNickname('x'.repeat(41)).ok, false, 'too long');
assert.strictEqual(isAcceptableNickname('hola<script>').ok, false, 'invalid characters');
assert.strictEqual(isAcceptableNickname('idiota').ok, false, 'blocklist');
assert.strictEqual(isAcceptableNickname('IDIÓTA').ok, false, 'blocklist after accent/case normalisation');
assert.strictEqual(isAcceptableNickname(42).ok, false, 'non-string rejected');
assert.strictEqual(isAcceptableNickname('  Ana  ').value, 'Ana', 'trims and returns clean value');
ok('nickname filter: length, charset, accent/case-insensitive blocklist, trimming');

console.log(`\nlive.test: ${passed} checks passed`);
