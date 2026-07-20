// P3-1: un requestFullscreen() DENEGADO (embed sin permiso, iOS, gesto no
// confiable) devuelve una promesa RECHAZADA. Sin capturar, dispara
// `unhandledrejection` → el boot-guard de los HTML pinta la pantalla roja de
// Error y el juego no arranca. toggleFullscreen debe tragar el rechazo.
// Run: node tests/fullscreen.test.mjs
import assert from 'node:assert';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

global.document = { fullscreenElement: null, webkitFullscreenElement: null, documentElement: {} };
const { toggleFullscreen } = await import('../core/fullscreen.js');

let unhandled = null;
process.on('unhandledRejection', (r) => { unhandled = r; });

// ── requestFullscreen que RECHAZA no debe propagar ───────────────────────────
{
  const el = { requestFullscreen: () => Promise.reject(new Error('denied by policy')) };
  const p = toggleFullscreen(el);
  assert.ok(p && typeof p.then === 'function', 'devuelve una promesa');
  await p; // debe RESOLVER (no rechazar)
  await new Promise(r => setImmediate(r)); // deja correr la cola de microtareas
  assert.equal(unhandled, null, 'no hubo unhandledRejection (no salta la pantalla roja)');
  ok('fullscreen denegado = no-op silencioso, el juego sigue');
}

// ── requestFullscreen síncrono/ausente tampoco rompe ─────────────────────────
{
  await toggleFullscreen({}); // sin requestFullscreen → optional chaining → undefined
  await toggleFullscreen({ requestFullscreen: () => undefined }); // API vieja síncrona
  ok('tolera elementos sin requestFullscreen o con retorno síncrono');
}

console.log(`\nfullscreen.test: ${passed} checks passed`);
