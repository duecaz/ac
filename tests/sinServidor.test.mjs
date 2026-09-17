// CUANDO NO HAY SERVIDOR, LA PANTALLA LO DICE — y la API no sale de la caché.
//
// El 2026-09-16 la API estuvo diez horas devolviendo un 301 a otro dominio. La
// aplicación lo supo desde el primer minuto y lo único que enseñó fue «Failed
// to fetch», en inglés, en un recuadro rojo. Tres vistas contaban el mismo
// fallo de tres maneras y ninguna nombraba al servidor: el reproductor decía
// «Actividad no encontrada» (con la actividad intacta en la nube) y la portada
// decía «Aún no hay actividades publicadas. Vuelve pronto».
//
// Y un 301 es «movido PERMANENTEMENTE»: cada navegador que lo recibió se lo
// guardó y siguió redirigiendo SOLO después de arreglar el servidor. Por eso la
// segunda mitad de este fichero — vaciar la caché arregla un navegador; que la
// API no se cachee los arregla todos, sin que nadie tenga que hacer nada.
//
// Run: node tests/sinServidor.test.mjs
import assert from 'node:assert';
import { esFalloDeRed, servidorCaido, mensajeParaLaPantalla, mensajeDe, MENSAJE_SIN_SERVIDOR } from '../core/frontera.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── 1. «No hubo servidor» se reconoce por el STATUS, no por el texto ──────
{
  // Lo que lanza un `fetch` que no llega: un TypeError sin `status`.
  assert.ok(esFalloDeRed(new TypeError('Failed to fetch')), 'el TypeError de fetch es fallo de red');
  // Y lo que lanza PocketBase para el mismo caso: status 0.
  assert.ok(esFalloDeRed(Object.assign(new Error('...'), { status: 0 })), 'status 0 de PB es fallo de red');
  // El navegador en otro idioma / otro motor da OTRO texto: tiene que dar igual.
  for (const t of ['Load failed', 'NetworkError when attempting to fetch resource.', 'Se produjo un error de red']) {
    assert.ok(esFalloDeRed(new TypeError(t)), `«${t}» (otro navegador) también es fallo de red`);
  }
  ok('un fallo de red se reconoce por el status, en cualquier navegador e idioma');
}

// ── 2. UN ERROR NUESTRO NO ES UNA CAÍDA ──────────────────────────────────
// La regla era «cualquier error sin status». Con ella, un defecto nuestro se le
// enseñaba al profe como «mantenimiento» y el error real se tiraba: el fallo
// mudo de R6, disfrazado de mensaje tranquilizador.
{
  for (const e of [new SyntaxError('JSON mal formado'), new ReferenceError('x is not defined'),
                   Object.assign(new Error('cancelado'), { name: 'AbortError' }), new Error('cualquier cosa')]) {
    assert.ok(!esFalloDeRed(e), `${e.constructor.name} es un defecto NUESTRO, no una caída de red`);
    assert.ok(!servidorCaido(e), `${e.constructor.name} no puede contarse como servidor caído`);
    assert.strictEqual(mensajeParaLaPantalla(e), mensajeDe(e), 'un error nuestro conserva su mensaje');
  }
  ok('un defecto del propio código NO se disfraza de «mantenimiento»');
}

// ── 2b. CONTRA-PRUEBA: lo que el servidor contesta CON CRITERIO ──────────
// Sin esto la regla sería inútil al revés: un 404 legítimo diría «mantenimiento»
// y el profe buscaría una avería que no existe.
{
  for (const status of [400, 401, 403, 404]) {
    const e = Object.assign(new Error(`HTTP ${status}`), { status });
    assert.ok(!servidorCaido(e), `HTTP ${status} es una RESPUESTA con criterio, no una caída`);
    assert.strictEqual(mensajeParaLaPantalla(e), mensajeDe(e),
      `con HTTP ${status} se enseña el mensaje del servidor, no el de mantenimiento`);
  }
  ok('400/401/403/404 conservan su propio mensaje');
}

// ── 2c. UN 5xx SÍ ES UNA CAÍDA, para quien mira la pantalla ──────────────
// Un 502 de una pasarela es la forma HABITUAL de un corte. Antes el reproductor
// lo contaba como «Actividad no encontrada» y la portada como «Aún no hay
// actividades publicadas»: dos mentiras distintas para el mismo corte.
{
  for (const status of [500, 502, 503, 504]) {
    const e = Object.assign(new Error(`HTTP ${status}`), { status });
    assert.ok(servidorCaido(e), `HTTP ${status} tiene que contarse como servidor no disponible`);
    assert.strictEqual(mensajeParaLaPantalla(e), MENSAJE_SIN_SERVIDOR);
  }
  ok('un 5xx se cuenta como caída y no como «no existe»');
}

// ── 3. El mensaje que ve una persona ──────────────────────────────────────
// Decisión del dueño (2026-09-16): al profe con la clase delante no se le
// cuenta de quién es la culpa. No puede hacer nada con eso y solo le asusta.
{
  assert.strictEqual(mensajeParaLaPantalla(new TypeError('Failed to fetch')), MENSAJE_SIN_SERVIDOR);
  assert.ok(!/fetch|network|error|failed/i.test(MENSAJE_SIN_SERVIDOR), 'el mensaje no puede traer jerga en inglés');
  for (const palabra of ['virus', 'colegio', 'filtro', 'certificado', 'firewall', 'ataque', 'hacke', 'caíd', 'caid']) {
    assert.ok(!new RegExp(palabra, 'i').test(MENSAJE_SIN_SERVIDOR),
      `el mensaje no puede hablar de «${palabra}»: alarma y no da nada que hacer`);
  }
  assert.ok(/mantenimiento/i.test(MENSAJE_SIN_SERVIDOR), 'el mensaje dice «mantenimiento»');
  ok('el mensaje es calmado, en castellano y sin señalar culpables');
}

// ── 4. EJECUTADO: la API no puede salir de la caché del navegador ────────
// Vaciar la caché arregla UN navegador; esto los arregla todos. Se comprueba
// llamando de verdad y mirando lo que recibe `fetch`, no leyendo el fichero.
{
  const { signedFetch } = await import('../core/pbHttp.js');
  /** @type {RequestInit[]} */
  const vistos = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (_u, init) => { vistos.push(init || {}); return new Response('{}', { status: 200 }); };
  try {
    await signedFetch('https://pb.ejemplo/api/health');
    await signedFetch('https://pb.ejemplo/api/x', { method: 'POST', body: '{}' });
  } finally { globalThis.fetch = real; }
  assert.strictEqual(vistos.length, 2, 'las dos peticiones llegaron a fetch');
  for (const init of vistos) {
    assert.strictEqual(init.cache, 'no-store',
      'toda petición a PocketBase debe ir con cache:"no-store" (un 301 cacheado sobrevive al arreglo del servidor)');
  }
  ok('EJECUTADO: toda petición a la API va sin caché (GET y POST)');
}

// ── 5. EJECUTADO: «no hubo servidor» ya no se disfraza de «no existe» ────
{
  const { getAnywhere } = await import('../core/storage.js');
  const { getRemoteStore } = await import('../adapters/index.js');
  const rs = await getRemoteStore();
  const original = rs.getActivity;
  try {
    // (a) la red se cae: con `estricto` sale a la superficie…
    rs.getActivity = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(() => getAnywhere('sin-red', { estricto: true }),
      'con estricto, un fallo de red NO puede devolverse como «no existe»');

    // …y sin `estricto` sigue dando null, que es lo que esperan los otros cinco
    // llamadores: cambiar eso sería romperlos de paso.
    assert.strictEqual(await getAnywhere('sin-red'), null, 'sin estricto, el comportamiento histórico no cambia');

    // (b) CONTRA-PRUEBA: el servidor SÍ contesta y dice que no existe → null
    // incluso con `estricto`. Sin esto, un 404 legítimo diría «mantenimiento» y
    // el profe buscaría una avería que no existe.
    rs.getActivity = async () => { throw Object.assign(new Error('not found'), { status: 404 }); };
    assert.strictEqual(await getAnywhere('no-existe', { estricto: true }), null,
      'un 404 del servidor sigue siendo «no encontrada», no una caída');

    // (c) …pero un 502 NO es «no existe»: la pasarela caída es un corte.
    rs.getActivity = async () => { throw Object.assign(new Error('bad gateway'), { status: 502 }); };
    await assert.rejects(() => getAnywhere('hay-corte', { estricto: true }),
      'un 5xx no puede devolverse como «no encontrada»');
  } finally { rs.getActivity = original; }
  ok('EJECUTADO: caída de red y «no existe» dejan de ser el mismo caso');
}

// ── 6. NINGÚN `fetch` a la API se queda fuera (norma pb-sin-cache) ───────
// Taparlos uno a uno aguanta hasta que alguien escriba el siguiente. La regla
// encontró tres en `views/admin/` que el barrido a mano no miró.
{
  const { scanNormsSource } = await import('../core/normsCheck.js');
  const { readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const raiz = new URL('..', import.meta.url).pathname;
  /** @param {string} dir @returns {string[]} */
  const todos = (dir) => readdirSync(join(raiz, dir), { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? todos(`${dir}/${d.name}`) : (d.name.endsWith('.js') ? [`${dir}/${d.name}`] : []));
  const ficheros = ['core', 'views', 'adapters'].flatMap(todos);
  const sueltos = ficheros.flatMap(f => scanNormsSource(f, readFileSync(join(raiz, f), 'utf8')))
    .filter(v => v.rule === 'pb-sin-cache');
  assert.deepStrictEqual(sueltos.map(v => `${v.path}:${v.line}`), [],
    'hay peticiones a PocketBase que pueden salir de la caché del navegador');
  // CONTRA-PRUEBA: la regla ve de verdad uno sin tapar, y no marca el que sí lo está.
  const malo = scanNormsSource('x.js', 'const r = await fetch(`${PB_URL}/api/health`);');
  assert.strictEqual(malo.filter(v => v.rule === 'pb-sin-cache').length, 1, 'la regla no ve un fetch sin caché');
  const bueno = scanNormsSource('x.js', "const r = await fetch(`${PB_URL}/api/health`,\n  { cache: 'no-store' });");
  assert.strictEqual(bueno.filter(v => v.rule === 'pb-sin-cache').length, 0,
    'la regla marca un fetch que SÍ lleva la opción (aunque esté en otra línea)');
  ok(`los ${ficheros.length} módulos de core/views/adapters: ni una petición a la API fuera de la norma`);
}

console.log(`\nsinServidor.test: ${passed} checks passed`);
