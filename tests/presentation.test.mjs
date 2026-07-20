// Presentation-layer tests. Lock the invariant that caused the recurring
// "theme leaks onto the whole page" bug: a SCOPED apply (an embed frame, a
// thumbnail, the editor preview) must NEVER touch <body>, and a global apply
// must theme <body> only. Also covers applyScene's lifecycle teardown.
// Run: node tests/presentation.test.mjs
import assert from 'node:assert';
import { applyScene, resetScene } from '../core/presentation.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Minimal DOM shim: just the surface skins.js / backgrounds.js touch.
function makeClassList() {
  const s = new Set();
  return {
    add: (...c) => c.forEach(x => s.add(x)),
    remove: (...c) => c.forEach(x => s.delete(x)),
    contains: (x) => s.has(x),
  };
}
const makeEl = () => ({ classList: makeClassList(), style: { setProperty() {}, removeProperty() {} } });

global.document = { body: makeEl(), documentElement: makeEl() };
const act = { presentation: { skin: 'jungle', background: 'stars' } };

// ── Global apply themes <body> ───────────────────────────────────────────────
{
  applyScene(act, null);
  assert.ok(document.body.classList.contains('skin-jungle'), 'body gets the skin');
  assert.ok(document.body.classList.contains('bg-stars'), 'body gets the background');
  ok('applyScene(activity) themes the page (body)');
}

// ── resetScene restores neutral chrome ───────────────────────────────────────
{
  resetScene();
  assert.ok(document.body.classList.contains('skin-default'), 'skin back to default');
  assert.ok(document.body.classList.contains('bg-none'), 'background back to none');
  assert.ok(!document.body.classList.contains('skin-jungle'), 'old skin removed');
  assert.ok(!document.body.classList.contains('bg-stars'), 'old background removed');
  ok('resetScene() restores neutral skin + background on the page');
}

// ── THE INVARIANT: a scoped apply must not leak onto <body> ───────────────────
{
  const frame = makeEl();
  applyScene(act, null, { target: frame });
  assert.ok(frame.classList.contains('skin-jungle'), 'frame gets the skin');
  assert.ok(frame.classList.contains('bg-stars'), 'frame gets the background');
  // Body stays exactly as resetScene left it — no leak.
  assert.ok(document.body.classList.contains('skin-default'), 'body skin untouched');
  assert.ok(document.body.classList.contains('bg-none'), 'body background untouched');
  assert.ok(!document.body.classList.contains('skin-jungle'), 'NO skin leak to body');
  assert.ok(!document.body.classList.contains('bg-stars'), 'NO background leak to body');
  ok('scoped applyScene paints only the target — never leaks onto the page');
}

// ── Lifecycle: ctx teardown auto-restores neutral chrome ─────────────────────
{
  const disposers = [];
  const ctx = { add: (fn) => disposers.push(fn) };
  applyScene(act, ctx);
  assert.ok(document.body.classList.contains('skin-jungle'), 'page themed on enter');
  disposers.forEach(d => d());
  assert.ok(document.body.classList.contains('skin-default'), 'skin reset on teardown');
  assert.ok(document.body.classList.contains('bg-none'), 'background reset on teardown');
  ok('applyScene(activity, ctx) restores neutral chrome on lifecycle teardown');
}

// ── Fallback skin is honored when the activity has none ───────────────────────
{
  resetScene();
  applyScene({ presentation: {} }, null, { defaultSkin: 'kahoot' });
  assert.ok(document.body.classList.contains('skin-kahoot'), 'falls back to kahoot');
  resetScene();
  ok('applyScene uses defaultSkin when the activity has no skin');
}

delete global.document;
console.log(`\npresentation.test: ${passed} checks passed`);
