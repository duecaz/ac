// Tests for the offline-first merge rule (core/storageMerge.js).
// Run: node tests/storageMerge.test.mjs
import assert from 'node:assert';
import { mergeRemote } from '../core/storageMerge.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const idmigrate = (d) => d; // identity normaliser for tests
const row = (id, updatedAt, extra = {}) => ({ id, data: { id, updatedAt, ...extra } });

// newer remote overwrites older local
let local = { a: { id: 'a', updatedAt: '2026-01-01', title: 'old' } };
let merged = mergeRemote(local, [row('a', '2026-02-01', { title: 'new' })], idmigrate);
assert.strictEqual(merged.a.title, 'new', 'newer remote wins');
ok('newer remote overwrites older local');

// older remote does NOT clobber newer local (offline edit protected)
local = { a: { id: 'a', updatedAt: '2026-03-01', title: 'local-edit' } };
merged = mergeRemote(local, [row('a', '2026-01-01', { title: 'stale' })], idmigrate);
assert.strictEqual(merged.a.title, 'local-edit', 'newer local kept');
ok('older remote does not clobber a newer local edit');

// brand-new remote row is added
local = {};
merged = mergeRemote(local, [row('b', '2026-01-01')], idmigrate);
assert.ok(merged.b, 'remote-only row added');
ok('brand-new remote row is added to the cache');

// local-only row survives a sync that doesn't include it
local = { c: { id: 'c', updatedAt: '2026-01-01' } };
merged = mergeRemote(local, [row('b', '2026-01-01')], idmigrate);
assert.ok(merged.c && merged.b, 'local-only row preserved alongside new remote');
ok('local-only rows are preserved');

// tie on updatedAt favours remote (a synced edit settles deterministically)
local = { a: { id: 'a', updatedAt: '2026-01-01', title: 'local' } };
merged = mergeRemote(local, [row('a', '2026-01-01', { title: 'remote' })], idmigrate);
assert.strictEqual(merged.a.title, 'remote', 'equal timestamps → remote wins');
ok('timestamp tie favours remote');

// inputs are not mutated; migrate is applied to remote data
const origLocal = { a: { id: 'a', updatedAt: '2026-01-01' } };
const snapshot = JSON.stringify(origLocal);
let migrated = false;
mergeRemote(origLocal, [row('z', '2026-05-01')], (d) => { migrated = true; return { ...d, normalised: true }; });
assert.strictEqual(JSON.stringify(origLocal), snapshot, 'input localMap not mutated');
assert.ok(migrated, 'migrate applied to remote rows');
ok('does not mutate inputs; applies migrate to remote data');

// P1-4: una edición local PENDIENTE de subir (_unsynced) es intocable, aunque el
// remoto tenga updatedAt MAYOR (reloj desincronizado entre dispositivos).
local = { a: { id: 'a', updatedAt: '2026-01-01', title: 'local-pendiente', _unsynced: true } };
merged = mergeRemote(local, [row('a', '2026-09-01', { title: 'remote-mas-nuevo' })], idmigrate);
assert.strictEqual(merged.a.title, 'local-pendiente', 'una edición _unsynced no se pisa ni con remoto más nuevo');
ok('mergeRemote respeta _unsynced (no lo pisa el reloj de pared)');

// P1-1: un id en tombstones (borrado pendiente de confirmar) NO se reintroduce
// desde el remoto, aunque la fila siga viva en PB.
local = {};
merged = mergeRemote(local, [row('gone', '2026-05-01', { title: 'zombie' })], idmigrate, new Set(['gone']));
assert.ok(!merged.gone, 'una fila remota tumbada no resucita en el merge');
ok('mergeRemote respeta tombstones (no resucita borrados)');

// …y sin tombstone esa misma fila SÍ entra (control).
merged = mergeRemote({}, [row('gone', '2026-05-01')], idmigrate, new Set());
assert.ok(merged.gone, 'sin tombstone, la fila remota entra con normalidad');
ok('sin tombstone la fila remota entra (control)');

console.log(`\nstorageMerge.test: ${passed} checks passed`);
