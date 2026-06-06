// Lightweight Node test for the backend adapters. Run: node tests/adapters.test.mjs
import assert from 'node:assert';
import { createLocalRemoteStore } from '../adapters/local/remoteStore.js';
import { createPocketbaseRemoteStore } from '../adapters/pocketbase/remoteStore.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Fake localStorage-like KV so the local adapter is exercised exactly as in-browser.
function fakeKV() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

const kv = fakeKV();
const rs = createLocalRemoteStore(kv);

// empty
assert.deepStrictEqual(await rs.listActivities(), []);
assert.strictEqual(await rs.getActivity('x'), null);
ok('local store starts empty');

// save + get round-trip
const a = { id: 'act_1', template: 'quiz', content: { items: [] }, updatedAt: '2026-01-01' };
await rs.saveActivity(a);
assert.deepStrictEqual(await rs.getActivity('act_1'), a);
ok('saveActivity → getActivity round-trips the full activity');

// list shape { id, data }
await rs.saveActivity({ id: 'act_2', template: 'wheel' });
const rows = await rs.listActivities();
assert.strictEqual(rows.length, 2);
assert.ok(rows.every(r => 'id' in r && 'data' in r), 'rows are {id, data}');
ok('listActivities returns {id, data} rows for storage.sync to merge');

// persistence across instances sharing the same KV (simulates reload)
const rs2 = createLocalRemoteStore(kv);
assert.deepStrictEqual(await rs2.getActivity('act_1'), a);
ok('data persists across store instances backed by the same KV');

// delete
await rs.deleteActivity('act_1');
assert.strictEqual(await rs.getActivity('act_1'), null);
assert.strictEqual((await rs.listActivities()).length, 1);
ok('deleteActivity removes the row');

// in-memory fallback when no KV (Node without a shim)
const mem = createLocalRemoteStore(null);
await mem.saveActivity({ id: 'm1' });
assert.strictEqual((await mem.getActivity('m1')).id, 'm1');
ok('falls back to in-memory store when no KV provided');

// pocketbase stub fails loudly with the right shape
const pb = createPocketbaseRemoteStore();
await assert.rejects(() => pb.saveActivity({}), /PocketBase/);
ok('pocketbase stub rejects loudly (not silently)');

console.log(`\nadapters.test: ${passed} checks passed`);
