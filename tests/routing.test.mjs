// Tests for pure routing (core/routing.js). Run: node tests/routing.test.mjs
import assert from 'node:assert';
import { compileRoute, matchRoute } from '../core/routing.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Build a routes table like the real app registers (order matters).
const R = (pattern, handler) => ({ ...compileRoute(pattern), handler });
const routes = [
  R('#/', () => 'home-root'),
  R('#/home', () => 'home'),
  R('#/edit/:id', (p) => `edit:${p.id}`),
  R('#/play/:id', (p) => `play:${p.id}`),
  R('#/reports/session/:id', (p) => `rsession:${p.id}`),
  R('#/reports/:id', (p) => `report:${p.id}`),
  R('#/task/:id/attempts', (p) => `attempts:${p.id}`),
];

function run(hash) {
  const hit = matchRoute(hash, routes);
  return hit ? hit.handler(hit.params) : null;
}

assert.strictEqual(run('#/home'), 'home');
assert.strictEqual(run('#/edit/abc'), 'edit:abc', 'captures :id param');
assert.strictEqual(run('#/edit/abc/'), 'edit:abc', 'trailing slash optional');
ok('matches static and single-param routes (trailing slash optional)');

// param values are decoded
assert.strictEqual(run('#/play/a%20b'), 'play:a b', 'decodeURIComponent on params');
ok('URL-decodes captured params');

// :id is a single segment — does NOT swallow slashes, so more specific routes win
assert.strictEqual(run('#/reports/session/x'), 'rsession:x', 'specific multi-segment route wins');
assert.strictEqual(run('#/reports/x'), 'report:x', 'single-segment report route');
assert.strictEqual(run('#/task/7/attempts'), 'attempts:7', 'param between static segments');
ok('single-segment params keep specific routes reachable (no slash swallowing)');

// empty hash falls back to '#/'
assert.strictEqual(run(''), 'home-root', "empty hash → '#/'");
assert.strictEqual(matchRoute('#/nope/nope', routes), null, 'no match → null (caller shows notFound)');
ok("empty hash defaults to '#/'; unknown route returns null");

// first registration wins on overlap
const dup = [R('#/x', () => 'first'), R('#/x', () => 'second')];
assert.strictEqual(matchRoute('#/x', dup).handler(), 'first', 'first registered route wins');
ok('registration order is respected (first match wins)');

console.log(`\nrouting.test: ${passed} checks passed`);
