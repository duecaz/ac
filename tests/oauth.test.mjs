// Fase A — login con Google (OAuth2 contra PocketBase). Verifica el parseo de
// proveedores (compat PB <0.23 / ≥0.23), la validación de `state` (anti-CSRF) y
// el cuerpo del canje del code. El redirect real necesita Google+PB, no testeable
// aquí. Run: node tests/oauth.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Mocks de navegador mínimos.
const ss = new Map();
global.sessionStorage = {
  getItem: (k) => (ss.has(k) ? ss.get(k) : null),
  setItem: (k, v) => ss.set(k, v),
  removeItem: (k) => ss.delete(k),
};
const ls = new Map();
global.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, v), removeItem: (k) => ls.delete(k) };

let fetchScript = [];
const fetchCalls = [];
global.fetch = async (url, opts = {}) => {
  fetchCalls.push({ url, opts });
  const n = fetchScript.shift() || { status: 200, body: {} };
  return { status: n.status, ok: n.status >= 200 && n.status < 300, json: async () => n.body };
};

const auth = await import('../core/auth.js');

// ── listOAuthProviders: forma PB ≥0.23 (oauth2.providers) ────────────────────
{
  fetchScript = [{ status: 200, body: { oauth2: { providers: [{ name: 'google', state: 'S1', codeVerifier: 'V1', authURL: 'https://accounts.google.com/o/oauth2/auth?client_id=x&redirect_uri=' }] } } }];
  const provs = await auth.listOAuthProviders();
  assert.strictEqual(provs.length, 1, 'un proveedor');
  assert.strictEqual(provs[0].name, 'google', 'es google');
  ok('listOAuthProviders parsea la forma PB ≥0.23');
}

// ── compat forma PB <0.23 (authProviders) ────────────────────────────────────
{
  fetchScript = [{ status: 200, body: { authProviders: [{ name: 'google', state: 'S2', codeVerifier: 'V2', authURL: 'u' }] } }];
  const provs = await auth.listOAuthProviders();
  assert.strictEqual(provs[0].state, 'S2', 'lee authProviders (PB viejo)');
  ok('listOAuthProviders compat PB <0.23');
}

// ── completeOAuthLogin valida el state (anti-CSRF) ───────────────────────────
{
  ss.set('ww.oauth.pending', JSON.stringify({ provider: 'google', state: 'GOOD', codeVerifier: 'V', redirectUrl: 'https://aulareto.com/teacher.html' }));
  await assert.rejects(() => auth.completeOAuthLogin('code123', 'EVIL'), /Estado OAuth no coincide/, 'rechaza state que no coincide');
  ok('completeOAuthLogin rechaza un state falso (anti-CSRF)');
}

// ── completeOAuthLogin canjea el code y guarda sesión + token de Google ──────
{
  ss.set('ww.oauth.pending', JSON.stringify({ provider: 'google', state: 'GOOD', codeVerifier: 'VER', redirectUrl: 'https://aulareto.com/teacher.html' }));
  fetchScript = [{ status: 200, body: { token: 'PBTOKEN', record: { id: 'u_1', email: 'p@e.com', name: 'Profe' }, meta: { accessToken: 'GOOGLETOK', expiry: null } } }];
  fetchCalls.length = 0;
  const data = await auth.completeOAuthLogin('code123', 'GOOD');
  const body = JSON.parse(fetchCalls[0].opts.body);
  assert.strictEqual(body.provider, 'google', 'envía provider');
  assert.strictEqual(body.code, 'code123', 'envía el code');
  assert.strictEqual(body.codeVerifier, 'VER', 'envía el codeVerifier guardado');
  assert.strictEqual(body.redirectURL, 'https://aulareto.com/teacher.html', 'envía el redirectURL usado');
  assert.strictEqual(data.record.id, 'u_1', 'devuelve el record del usuario');
  assert.strictEqual(auth.getAuthToken(), 'PBTOKEN', 'guardó el token PB');
  assert.strictEqual(auth.getAuthUserId(), 'u_1', 'getAuthUserId → id del profe (para owner)');
  assert.strictEqual(auth.getGoogleAccessToken(), 'GOOGLETOK', 'guardó el accessToken de Google (para Classroom)');
  assert.strictEqual(ss.get('ww.oauth.pending'), undefined, 'limpió el pending OAuth');
  ok('completeOAuthLogin canjea el code y deja sesión + token Google');
}

// ── oauthRedirectUrl canonicaliza /teacher → /teacher.html ──────────────────
// GitHub Pages sirve teacher.html también como /teacher (sin extensión). El
// redirect_uri debe COINCIDIR EXACTO con el autorizado en Google (que es
// .../teacher.html), así que entrar por /teacher debe mandar igualmente /teacher.html.
{
  for (const [pathname, expected] of [
    ['/teacher',       'https://aulareto.com/teacher.html'],
    ['/teacher.html',  'https://aulareto.com/teacher.html'],
    ['/teacher/',      'https://aulareto.com/teacher.html'],
    // …y desde CUALQUIER otra página se vuelve también a teacher.html, que es
    // la única que sabe canjear el código. Con la portada mandando `/` o
    // `/index.html`, Google respondía «Acceso bloqueado: la solicitud de esta
    // aplicación no es válida» (400 redirect_uri_mismatch) en su propia página,
    // donde la app ya no puede explicar nada.
    ['/',              'https://aulareto.com/teacher.html'],
    ['/index.html',    'https://aulareto.com/teacher.html'],
    ['/student.html',  'https://aulareto.com/teacher.html'],
    // Y si la app se sirve en un subdirectorio (GitHub Pages sin dominio
    // propio: duecaz.github.io/ac/), la URI es la de ESE directorio.
    ['/ac/index.html', 'https://aulareto.com/ac/teacher.html'],
  ]) {
    global.location = { origin: 'https://aulareto.com', pathname };
    assert.strictEqual(auth.oauthRedirectUrl(), expected, `redirect canónico para ${pathname}`);
  }
  delete global.location;
  ok('oauthRedirectUrl da UNA sola URI (teacher.html) desde cualquier página — evita redirect_uri_mismatch');
}

delete global.fetch; delete global.sessionStorage; delete global.localStorage;
console.log(`\noauth.test: ${passed} checks passed`);
