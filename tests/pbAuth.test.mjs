// Fase 0/1 seguridad PB: las escrituras de actividades se firman con el token del
// profe y llevan `owner`; si el token expira y las reglas aún son públicas, hay
// fallback anónimo para no romper guardadas. Run: node tests/pbAuth.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// Mock de localStorage con sesión de profe.
const store = new Map();
store.set('ww.pb.auth', JSON.stringify({ token: 'TOK123', record: { id: 'teacher_9' } }));
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};

// Mock de fetch programable: registra cada llamada y responde por guion.
const calls = [];
let script = [];
global.fetch = async (url, opts = {}) => {
  calls.push({ url, method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body });
  const next = script.shift() || { status: 200, body: {} };
  return {
    status: next.status,
    ok: next.status >= 200 && next.status < 300,
    text: async () => JSON.stringify(next.body || {}),
    json: async () => next.body || {},
  };
};

const { createPocketbaseRemoteStore } = await import('../adapters/pocketbase/remoteStore.js');
const rs = createPocketbaseRemoteStore();
const act = { id: 'act_owned01', template: 'quiz', title: 'T', visibility: 'private', content: {} };

// ── saveActivity firma con token y añade owner ───────────────────────────────
{
  calls.length = 0;
  script = [{ status: 404, body: {} }, { status: 200, body: { id: 'actowned010000' } }]; // PATCH 404 → POST 200
  await rs.saveActivity(act);
  const post = calls.find(c => c.method === 'POST');
  assert.ok(post, 'hubo POST de creación');
  assert.strictEqual(post.headers['Authorization'], 'TOK123', 'la escritura lleva el token del profe');
  const body = JSON.parse(post.body);
  assert.strictEqual(body.owner, 'teacher_9', 'el registro incluye owner = id del profe');
  ok('saveActivity firma con token y setea owner');
}

// ── fallback anónimo si el token es rechazado (401) con reglas aún públicas ───
{
  calls.length = 0;
  // getActivity: 1ª con token → 401 → reintento sin token → 200
  script = [{ status: 401, body: {} }, { status: 200, body: { data: { id: 'x' } } }];
  const got = await rs.getActivity('act_owned01');
  assert.strictEqual(calls.length, 2, 'reintentó tras el 401');
  assert.strictEqual(calls[0].headers['Authorization'], 'TOK123', '1º intento con token');
  assert.strictEqual(calls[1].headers['Authorization'], undefined, '2º intento SIN token (fallback anónimo)');
  assert.ok(got, 'la lectura acabó devolviendo datos (no rompió)');
  ok('fallback anónimo tras 401 (no rompe con reglas públicas)');
}

// ── listActivities(ownerId) filtra por owner en el servidor (S1.4) ───────────
{
  calls.length = 0;
  script = [{ status: 200, body: { items: [] } }];
  await rs.listActivities('teacher_9');
  const url = calls[0].url;
  assert.ok(/filter=/.test(url), 'la URL incluye un filtro');
  assert.ok(decodeURIComponent(url).includes("owner='teacher_9'"), "filtra por owner='teacher_9'");
  // Sin ownerId → sin filtro (uso legado)
  calls.length = 0;
  script = [{ status: 200, body: { items: [] } }];
  await rs.listActivities();
  assert.ok(!/filter=/.test(calls[0].url), 'sin ownerId no añade filtro (compat)');
  ok('listActivities filtra por owner cuando se pide');
}

// ── UN TROPIEZO DE RED NO TE CIERRA LA SESIÓN, UN 401 SÍ ─────────────────────
// El navegador del dueño registró un fallo de CORS en `auth-refresh` (2026-08-21,
// v1.51.563): la petición ni siquiera llegó a tener respuesta. Medido después,
// el servidor estaba limpio —204 al preflight por Cloudflare Y en el origen—,
// así que fue un tropiezo puntual. Lo que decide si eso se nota o no es esta
// función: si un fallo así borrara la sesión, al profe se le cerraría la cuenta
// en mitad de la clase por un parpadeo de la red. La distinción —transitorio
// conserva, 401/403 limpia— estaba escrita en un comentario y sin test.
{
  const { authRefresh, getAuthToken } = await import('../core/auth.js');
  const sesion = () => JSON.stringify({ token: 'TOK123', record: { id: 'teacher_9' } });

  // 1) Sin respuesta (CORS / red caída): fetch LANZA.
  store.set('ww.pb.auth', sesion());
  const realFetch = global.fetch;
  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  let rec = await authRefresh();
  assert.ok(rec, 'devuelve el usuario guardado pese al fallo de red');
  assert.strictEqual(getAuthToken(), 'TOK123', 'la sesión SIGUE guardada');
  ok('CORS/red caída: conserva la sesión (no expulsa al profe)');

  // 2) 5xx del servidor: tampoco expulsa.
  global.fetch = realFetch;
  store.set('ww.pb.auth', sesion());
  script = [{ status: 503, body: {} }];
  rec = await authRefresh();
  assert.ok(rec, 'devuelve el usuario guardado pese al 5xx');
  assert.strictEqual(getAuthToken(), 'TOK123', 'la sesión SIGUE guardada');
  ok('5xx transitorio: conserva la sesión');

  // 3) CONTRA-PRUEBA: un 401 de verdad (sesión expirada) SÍ limpia — si no,
  //    se arrastraría un token muerto y cada escritura fallaría en silencio.
  store.set('ww.pb.auth', sesion());
  script = [{ status: 401, body: {} }];
  rec = await authRefresh();
  assert.strictEqual(rec, null, 'el 401 devuelve null');
  assert.strictEqual(getAuthToken(), null, 'el 401 SÍ limpia la sesión');
  ok('CONTRA-PRUEBA · 401 real: limpia la sesión (no arrastra un token muerto)');

  // 4) El camino legítimo sigue funcionando: renueva token y record.
  store.set('ww.pb.auth', sesion());
  script = [{ status: 200, body: { token: 'TOK456', record: { id: 'teacher_9', name: 'Ana' } } }];
  rec = await authRefresh();
  assert.strictEqual(rec.name, 'Ana', 'devuelve el record renovado');
  assert.strictEqual(getAuthToken(), 'TOK456', 'guarda el token nuevo');
  ok('CONTRA-PRUEBA · refresco normal: renueva token y record');
}

delete global.fetch; delete global.localStorage;

console.log(`\npbAuth.test: ${passed} checks passed`);
