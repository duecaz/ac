// Tests for the pure wheel logic. Run: node tests/wheel.test.mjs
import assert from 'node:assert';
import { normalizeEntries, pickIndex, landingRotation, removeAt, truncLabel } from '../templates/wheel/logic.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// normalizeEntries
assert.deepStrictEqual(normalizeEntries(['a', ' ', '', 'b']), ['a', 'b'], 'drops blank entries');
assert.deepStrictEqual(normalizeEntries([]), ['(vacío)'], 'never empty');
assert.deepStrictEqual(normalizeEntries(null), ['(vacío)']);
assert.deepStrictEqual(normalizeEntries([1, 2]), ['1', '2'], 'coerces to strings');
ok('normalizeEntries: trims blanks, coerces, never empty');

// pickIndex (deterministic with injected rnd)
assert.strictEqual(pickIndex(4, () => 0), 0);
assert.strictEqual(pickIndex(4, () => 0.99), 3, 'stays in range at rnd→1');
assert.strictEqual(pickIndex(5, () => 0.5), 2);
ok('pickIndex: in [0,count) with injectable rng');

// landingRotation
assert.strictEqual(landingRotation(0, 4), 360 * 5 + 315, 'target 0 centers under pointer');
assert.strictEqual(landingRotation(1, 4), 360 * 5 + 225);
assert.ok(landingRotation(0, 4) > landingRotation(3, 4), 'later targets rotate less within the final turn');
assert.strictEqual(landingRotation(0, 4, 2), 360 * 2 + 315, 'turns are configurable');
ok('landingRotation: ≥turns full spins + centers the target slice');

// removeAt — this is the bug-fix core
const e = ['a', 'b', 'c'];
assert.deepStrictEqual(removeAt(e, 1), ['a', 'c'], 'removes the winner index');
assert.deepStrictEqual(e, ['a', 'b', 'c'], 'input not mutated (immutable)');
assert.deepStrictEqual(removeAt(['only'], 0), ['(vacío)'], 'never collapses to empty');
ok('removeAt: immutable removal, never empty (winner captured before removal)');

// truncLabel
assert.strictEqual(truncLabel('corto'), 'corto', 'short label unchanged');
assert.strictEqual(truncLabel('una etiqueta larguísima', 16).length, 16, 'capped at max');
assert.ok(truncLabel('una etiqueta larguísima', 16).endsWith('…'), 'ellipsis on truncation');
ok('truncLabel: ellipsis only when over the limit');

console.log(`\nwheel.test: ${passed} checks passed`);
