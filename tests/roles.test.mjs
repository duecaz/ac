// S3 — rol admin y guarda de reportes.
// Run: node tests/roles.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const store = new Map();
global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };

const { getAuthRole, isAdmin } = await import('../core/auth.js');
const { submitReport } = await import('../core/reports.js');

// ── getAuthRole / isAdmin leen record.role ──────────────────────────────────
{
  store.delete('ww.pb.auth');
  assert.strictEqual(getAuthRole(), null, 'sin sesión → sin rol');
  assert.strictEqual(isAdmin(), false, 'sin sesión → no admin');

  store.set('ww.pb.auth', JSON.stringify({ token: 'T', record: { id: 'u1', email: 'p@e.com' } }));
  assert.strictEqual(isAdmin(), false, 'profe normal → no admin');

  store.set('ww.pb.auth', JSON.stringify({ token: 'T', record: { id: 'u1', role: 'admin' } }));
  assert.strictEqual(getAuthRole(), 'admin', 'lee role=admin');
  assert.strictEqual(isAdmin(), true, 'role admin → isAdmin()');
  ok('getAuthRole/isAdmin reflejan el rol del record');
}

// ── submitReport exige sesión ────────────────────────────────────────────────
{
  store.delete('ww.pb.auth');
  await assert.rejects(() => submitReport('act_x', 'spam'), /Inicia sesión/, 'sin sesión no se puede reportar');
  ok('submitReport exige sesión');
}

delete global.localStorage;
console.log(`\nroles.test: ${passed} checks passed`);
