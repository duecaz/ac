// Stability + robustness tests for the hardening work: safe localStorage
// wrappers (ls.js), the HTML builder/escaper purity (html.js), and the
// PocketBase adapter's non-JSON response handling (remoteStore pbFetch).
// Run: node tests/stability.test.mjs
import assert from 'node:assert';
import { lsGet, lsSet, lsDel } from '../core/ls.js';
import { html, escapeHtml } from '../core/html.js';
import { createPocketbaseRemoteStore } from '../adapters/pocketbase/remoteStore.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ───────────────────────── ls.js: safe localStorage ─────────────────────────
{
  // A working in-memory localStorage shim.
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  assert.strictEqual(lsGet('missing'), null, 'lsGet returns null for missing key');
  assert.strictEqual(lsGet('missing', 'fb'), 'fb', 'lsGet returns the fallback when provided');
  lsSet('k', 'v');
  assert.strictEqual(lsGet('k'), 'v', 'lsSet then lsGet round-trips');
  lsDel('k');
  assert.strictEqual(lsGet('k'), null, 'lsDel removes the key');
  ok('ls: get/set/del round-trip with a working storage');

  // Private-browsing / sandbox simulation: every call throws.
  global.localStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  };
  assert.strictEqual(lsGet('x'), null, 'lsGet swallows throw → null');
  assert.strictEqual(lsGet('x', 'fb'), 'fb', 'lsGet swallows throw → fallback');
  assert.doesNotThrow(() => lsSet('x', '1'), 'lsSet never throws');
  assert.doesNotThrow(() => lsDel('x'), 'lsDel never throws');
  ok('ls: storage that throws (private browsing) never crashes the caller');

  delete global.localStorage;
}

// ───────────────────────── html.js: builder + escaper ───────────────────────
{
  assert.strictEqual(html`a${1}b`, 'a1b', 'interpolates values');
  assert.strictEqual(html`x${null}y${false}z`, 'xyz', 'null/false render as empty');
  assert.strictEqual(html`${['a', 'b', 'c']}`, 'abc', 'arrays are joined');
  assert.strictEqual(html`${0}`, '0', 'zero is kept (not treated as empty)');
  ok('html: tagged-template builder handles values, null/false, arrays, zero');

  assert.strictEqual(escapeHtml('<a href="x">& \'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp; &#39;&lt;/a&gt;', 'escapes all five entities');
  assert.strictEqual(escapeHtml(null), '', 'null → empty string');
  assert.strictEqual(escapeHtml(42), '42', 'numbers stringify');
  ok('html: escapeHtml neutralises markup and handles nullish/number input');
}

// ─────────────── remoteStore: non-JSON responses fail loudly ────────────────
{
  const pb = createPocketbaseRemoteStore();
  const realFetch = global.fetch;

  // A gateway/proxy page (HTML, not JSON) must surface as a PocketBase error,
  // not an opaque SyntaxError from r.json().
  global.fetch = async () => ({ status: 502, ok: false, text: async () => '<html>502 Bad Gateway</html>' });
  await assert.rejects(() => pb.saveActivity({ id: 'robusttest1' }), /PocketBase error 502/,
    'non-JSON body → PocketBase error, not SyntaxError');
  ok('remoteStore: a non-JSON (gateway) response rejects with a PocketBase error');

  // A well-formed JSON error keeps its message.
  global.fetch = async () => ({ status: 400, ok: false, text: async () => JSON.stringify({ message: 'campo inválido' }) });
  await assert.rejects(() => pb.saveActivity({ id: 'robusttest2' }), /campo inválido/,
    'JSON error body preserves the PB message');
  ok('remoteStore: a JSON error body preserves PocketBase\'s own message');

  // 204 No Content (e.g. DELETE) resolves to null without parsing.
  global.fetch = async () => ({ status: 204, ok: true, text: async () => '' });
  await assert.doesNotReject(() => pb.deleteActivity('robusttest3'), '204 resolves cleanly');
  ok('remoteStore: 204 No Content resolves without a body');

  global.fetch = realFetch;
}

console.log(`\nstability.test: ${passed} checks passed`);
