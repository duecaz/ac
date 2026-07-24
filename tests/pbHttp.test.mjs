// signedFetch — política de auth de PocketBase en un solo sitio. Fija: firma con
// el token del profe si hay sesión, va anónimo si no, y ante 401/403 con token
// reintenta SIN auth (fallback: no romper lo que hoy funciona con reglas
// públicas). Run: node tests/pbHttp.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Mock de localStorage (lo lee core/auth.js loadStored → getAuthToken).
let stored = null;
global.localStorage = { getItem: () => stored, setItem: () => {}, removeItem: () => {} };
const setToken = (t) => { stored = t ? JSON.stringify({ token: t, record: { id: 'u1' } }) : null; };

const { signedFetch } = await import('../core/pbHttp.js');

function fakeFetch(script) {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, auth: opts.headers?.Authorization ?? null, method: opts.method || 'GET' });
    const status = typeof script === 'function' ? script(calls.length) : script;
    return { status, ok: status >= 200 && status < 300, json: async () => ({}), text: async () => '{}' };
  };
  return calls;
}

// ── sin sesión → sin Authorization (alumno anónimo) ──────────────────────────
{
  setToken(null);
  const calls = fakeFetch(200);
  await signedFetch('http://pb/x', { method: 'POST', body: '{}' });
  assert.strictEqual(calls.length, 1, 'una sola petición');
  assert.strictEqual(calls[0].auth, null, 'sin token → sin Authorization');
  ok('signedFetch: alumno sin sesión va anónimo (NO-OP)');
}

// ── con sesión → firma con el token ──────────────────────────────────────────
{
  setToken('TOK123');
  const calls = fakeFetch(200);
  await signedFetch('http://pb/x', { method: 'PATCH', body: '{}' });
  assert.strictEqual(calls[0].auth, 'TOK123', 'profe logueado → Authorization con el token');
  ok('signedFetch: el profe firma sus escrituras con el token');
}

// ── token caduco (401) → reintenta SIN auth (no rompe reglas públicas) ────────
{
  setToken('EXPIRED');
  const calls = fakeFetch((n) => n === 1 ? 401 : 200);
  const r = await signedFetch('http://pb/x', { method: 'POST', body: '{}' });
  assert.strictEqual(calls.length, 2, 'dos intentos: firmado, luego anónimo');
  assert.strictEqual(calls[0].auth, 'EXPIRED', 'primer intento firmado');
  assert.strictEqual(calls[1].auth, null, 'segundo intento anónimo (fallback)');
  assert.strictEqual(r.status, 200, 'devuelve la respuesta del fallback');
  ok('signedFetch: 401/403 con token → fallback anónimo (no rompe lo público)');
}

delete global.fetch; delete global.localStorage;
console.log(`\npbHttp.test: ${passed} checks passed`);
