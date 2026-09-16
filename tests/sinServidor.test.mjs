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
import { esFalloDeRed, mensajeParaLaPantalla, mensajeDe, MENSAJE_SIN_SERVIDOR } from '../core/frontera.js';

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

// ── 2. CONTRA-PRUEBA: el servidor que SÍ contesta no es un fallo de red ───
// Sin esto la regla sería inútil al revés: un 404 legítimo diría «mantenimiento»
// y el profe buscaría una avería que no existe.
{
  for (const status of [400, 401, 403, 404, 500, 503]) {
    const e = Object.assign(new Error(`HTTP ${status}`), { status });
    assert.ok(!esFalloDeRed(e), `HTTP ${status} es una RESPUESTA del servidor, no una caída`);
    assert.strictEqual(mensajeParaLaPantalla(e), mensajeDe(e),
      `con HTTP ${status} se enseña el mensaje del servidor, no el de mantenimiento`);
  }
  ok('un servidor que contesta (400…503) conserva su propio mensaje');
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
  } finally { rs.getActivity = original; }
  ok('EJECUTADO: caída de red y «no existe» dejan de ser el mismo caso');
}

console.log(`\nsinServidor.test: ${passed} checks passed`);
