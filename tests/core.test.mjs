// Core system tests (no templates, no DOM). Verifies the plumbing behind the
// activities: result persistence routing, the pub/sub bus, and lifecycle
// teardown. Run: node tests/core.test.mjs
import assert from 'node:assert';
import { saveResult } from '../core/results.js';
import { getRemoteStore } from '../adapters/index.js';
import { emit, listen } from '../core/events.js';
import { acquire } from '../core/lifecycle.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ---------- results route through the backend adapter (not Supabase直) ----------
await saveResult({ activityId: 'a1', scoreAuto: 5, scoreFinal: 5, maxScore: 10, timeUsed: 30 });
await saveResult({ activityId: 'a2', scoreAuto: 8, scoreFinal: 9, maxScore: 10, timeUsed: 12 });
const rs = await getRemoteStore();
const results = await rs.listResults();
assert.strictEqual(results.length, 2, 'both results captured on the local backend');
assert.strictEqual(results[0].activityId, 'a1');
assert.strictEqual(results[1].scoreFinal, 9);
ok('saveResult routes through the adapter and is captured offline (no Supabase coupling)');

// fail-soft: a throwing backend must not bubble out of saveResult
const original = rs.saveResult;
rs.saveResult = async () => { throw new Error('backend down'); };
await assert.doesNotReject(() => saveResult({ activityId: 'x' }), 'saveResult swallows backend errors');
rs.saveResult = original;
ok('saveResult is fail-soft (never interrupts gameplay)');

// ---------- events bus (pub/sub) ----------
let received = null;
const off = listen('game:test', (d) => { received = d; });
emit('game:test', { v: 1 });
assert.deepStrictEqual(received, { v: 1 }, 'listener receives emitted detail');
off();
emit('game:test', { v: 2 });
assert.deepStrictEqual(received, { v: 1 }, 'unsubscribed listener stops receiving');
ok('events: emit/listen pub-sub and clean unsubscribe');

// ---------- lifecycle teardown ----------
const log = [];
const ctxA = acquire('viewA');
ctxA.add(() => log.push('A1'));
acquire('viewA'); // re-acquiring the same view disposes the previous batch
assert.deepStrictEqual(log, ['A1'], 're-acquire disposes the previous batch');

const ctxB = acquire('viewB');
ctxB.add(() => log.push('B1'));
acquire('viewC'); // a different view does NOT dispose viewB
assert.deepStrictEqual(log, ['A1'], 'acquiring another view leaves others intact');

// disposer errors are isolated (LIFO order, one throwing doesn't block others)
const ctxD = acquire('viewD');
ctxD.add(() => log.push('D-ok'));
ctxD.add(() => { throw new Error('boom'); });
acquire('viewD'); // disposes LIFO: boom (caught) then D-ok
assert.ok(log.includes('D-ok'), 'a throwing disposer does not block the rest');
ok('lifecycle: per-view teardown, isolation between views, error-safe disposers');

console.log(`\ncore.test: ${passed} checks passed`);
