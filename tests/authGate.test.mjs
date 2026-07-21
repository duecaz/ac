// S1.1 — el gate de sesión: sin profe logueado, las vistas de autoría muestran la
// pantalla "entra para crear"; con sesión, delegan en la vista real.
// Run: node tests/authGate.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// DOM/localStorage mínimos para html.js/mount y auth.js.
const store = new Map();
global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
global.document = { querySelector: () => el, getElementById: () => null, createElement: () => ({ style:{}, classList:{ add(){}, remove(){} }, setAttribute(){}, appendChild(){} }), head: { appendChild(){} } };

const { requireTeacher } = await import('../core/authGate.js');
const { signOut } = await import('../core/auth.js');

// ── Sin sesión → gate (no ejecuta la vista) ─────────────────────────────────
{
  await signOut();        // resetea el cache _user de auth.js (otras suites loguean)
  store.delete('ww.pb.auth');
  let rendered = false;
  await requireTeacher('#app', () => { rendered = true; });
  assert.strictEqual(rendered, false, 'sin sesión NO renderiza la vista de autoría');
  assert.ok(/auth-gate/.test(el.innerHTML), 'pinta la pantalla del gate');
  assert.ok(/Entra|Inicia sesión|crear/i.test(el.innerHTML), 'invita a iniciar sesión');
  ok('gate: sin sesión muestra la pantalla de login');
}

// ── Con sesión → ejecuta la vista real ──────────────────────────────────────
{
  store.set('ww.pb.auth', JSON.stringify({ token: 'T', record: { id: 'u1', email: 'p@e.com' } }));
  let rendered = false;
  await requireTeacher('#app', () => { rendered = true; });
  assert.strictEqual(rendered, true, 'con sesión SÍ delega en la vista real');
  ok('gate: con sesión ejecuta la vista');
}

delete global.localStorage; delete global.document;
console.log(`\nauthGate.test: ${passed} checks passed`);
