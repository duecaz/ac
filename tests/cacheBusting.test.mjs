// EL CSS TIENE QUE LLEGAR CUANDO LLEGA EL JS.
//
// Dos veces en el mismo día (dueño, 2026-08-15): se publica un arreglo, el chip
// de la barra ya dice la versión nueva, y la pantalla sigue con el fallo de
// antes. No fallaba el arreglo — fallaba la premisa de que el chip prueba algo
// sobre los ESTILOS. El chip sale de `core/constants.js`, o sea del JS; las
// hojas son ficheros aparte que GitHub Pages sirve con `max-age=600`. Con un
// cambio casi todo de CSS —como el reparto de alturas de la pantalla del
// alumno— la app queda MEZCLADA: módulos nuevos, estilos viejos.
//
// Peor que el retraso es lo que hace con los reportes: convierte cualquier
// hallazgo visual en una adivinanza («¿está mal, o es la caché?»), y esa duda
// se la come el que prueba, no el que programó.
//
// La regla: toda hoja PROPIA se pide con `?v=<VERSION>`. Es un escaneo de los
// HTML del proyecto, no una lista: una página nueva queda cubierta el día que
// se escribe.
// Run: node tests/cacheBusting.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from '../core/constants.js';
import { sellarHtml, htmlsDelProyecto, modulosDelProyecto, importMapHtml } from '../tools/stamp-assets.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(ROOT, f), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const HTMLS = htmlsDelProyecto();

// ── 1. Toda hoja propia se pide con la versión ──────────────────────────────
{
  const sinSellar = [];
  let total = 0;
  for (const f of HTMLS) {
    for (const m of leer(f).matchAll(/<link\b[^>]*\bhref="((?:styles|themes)\/[^"]+\.css)([^"]*)"/g)) {
      total++;
      if (m[2] !== `?v=${VERSION}`) sinSellar.push(`${f} → ${m[1]}${m[2]}`);
    }
  }
  assert.ok(total >= 10, `el escáner debería ver todas las hojas de las páginas, vio ${total}`);
  assert.deepStrictEqual(sinSellar, [],
    `hojas sin sellar con v${VERSION} (llegarán tarde y el chip de versión mentirá):\n   ${sinSellar.join('\n   ')}\n   Corre: node tools/stamp-assets.mjs`);
  ok(`las ${total} hojas propias de las ${HTMLS.length} páginas se piden con ?v=${VERSION}`);
}

// ── 2. Las de vendor/ NO se sellan ──────────────────────────────────────────
// Bootstrap ya viene versionado EN SU RUTA (`vendor/bootstrap-5.3.3/…`), que es
// justamente por qué la versión va en el nombre de la carpeta: el navegador no
// puede servir la anterior desde caché. Añadirle además un `?v=` la volvería a
// descargar en cada versión de la app —228 KB por cada parche— sin ganar nada.
// (Hasta v1.51.594 esto miraba las hojas de CDN; desde que Bootstrap es local
// el trato es el mismo, y la razón también.)
{
  const srcTeacher = leer('teacher.html');
  const externas = srcTeacher.match(/<link[^>]*href="vendor\/[^"]+"/g) || [];
  assert.strictEqual(externas.length >= 1, true, 'teacher.html carga las hojas de vendor/');
  for (const l of externas) assert.ok(!/\?v=/.test(l), `una hoja de vendor/ no debe llevar sello: ${l}`);
  ok('las hojas de vendor/ se dejan como están (ya vienen versionadas en su ruta)');
}

// ── 3. CONTRA-PRUEBA: el sellador sella y es idempotente ────────────────────
// Si `sellarHtml` no encajara con nada, el chequeo 1 pasaría solo porque el
// fichero ya estaba bien, y el día que alguien añada una hoja no se enteraría.
{
  const crudo = '<link rel="stylesheet" href="styles/x.css">';
  const viejo = '<link rel="stylesheet" href="styles/x.css?v=0.0.1">';
  assert.strictEqual(sellarHtml(crudo, '9.9.9'), '<link rel="stylesheet" href="styles/x.css?v=9.9.9">');
  assert.strictEqual(sellarHtml(viejo, '9.9.9'), '<link rel="stylesheet" href="styles/x.css?v=9.9.9">',
    'un sello viejo se REEMPLAZA (si no, se acumularían)');
  assert.strictEqual(sellarHtml(sellarHtml(crudo, '9.9.9'), '9.9.9'), sellarHtml(crudo, '9.9.9'),
    'sellar dos veces da lo mismo');
  const cdn = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap/x.css">';
  assert.strictEqual(sellarHtml(cdn, '9.9.9'), cdn, 'no toca las de CDN');
  ok('CONTRA-PRUEBA: el sellador encaja, reemplaza el sello viejo y es idempotente');
}

// ── 4. LOS ASSETS QUE SE PIDEN POR FETCH (no por <link>) TAMBIÉN VAN SELLADOS ─
// El caso que lo destapó (dueño, 2026-08-18): editó `assets/animations/cuerda.json`
// (la animación del VS), borró cookies y Service Worker desde el admin, y
// seguía viendo la vieja. No era el SW —está desregistrado a propósito— era el
// HTTP normal + Cloudflare cacheando la URL: ese `.json` lo pide `lottie-web`
// con `fetch`, no una etiqueta `<link>`, así que `tools/stamp-assets.mjs` (que
// solo mira `<link>`) nunca lo tocaba. Aquí se escanean los módulos de `core/`
// por rutas locales `./assets/**/*.json` y se exige el mismo `?v=VERSION`.
{
  const rutaAssetJson = /(['"`])\.\/assets\/[^'"` ]+\.json(\?[^'"` ]*)?\1/g;
  const sinSellar = [];
  let total = 0;
  const fs = require('node:fs');
  const walk = (dir) => fs.readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(e => {
    const rel = join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return e.name.endsWith('.js') ? [rel] : [];
  });
  for (const f of walk('core')) {
    const src = leer(f);
    for (const m of src.matchAll(rutaAssetJson)) {
      total++;
      if (!(m[2] || '').includes(`v=${VERSION}`) && !(m[2] || '').includes('v=${VERSION}')) {
        sinSellar.push(`${f} → ${m[0]}`);
      }
    }
  }
  assert.ok(total >= 1, 'debe haber al menos un .json de assets/ referenciado desde core/ (si no, la regla no prueba nada)');
  assert.deepStrictEqual(sinSellar, [],
    `.json de assets/ sin sellar (llegarán tarde tras editarlos): ${sinSellar.join(' · ')}`);
  ok(`los ${total} .json de assets/ pedidos por fetch llevan el sello de versión`);
}

// ── 5. Y LOS MÓDULOS. Misma enfermedad, una capa más abajo ──────────────────
// (dueño, 2026-09-18) Se arregló una figura del tangram, el chip decía
// `v1.51.715` y la figura seguía rota: el chip sale de `core/constants.js`,
// que sí había llegado nuevo, mientras `siluetas.js` venía del caché. Los
// módulos se piden por su ruta pelada —solo el de entrada lleva `?_=`, y esa
// query NO se hereda—, así que cada fichero caduca por su cuenta y la app corre
// MEZCLADA. El dueño creó actividades que nacían mal media mañana.
// La cura sin build: un import map con TODOS los módulos propios sellados.
//
// AQUÍ se prueba el GENERADOR, ejecutándolo. Que las páginas de verdad pidan
// cada módulo sellado se mide en el navegador (`tools/cq-sonda.mjs`): mirar el
// HTML diría cómo está escrito, no qué pide el navegador — y el mapa lo ignora
// en silencio si va mal colocado, que es justo el fallo que habría que cazar.
{
  const modulos = modulosDelProyecto();
  assert.ok(modulos.length > 300, `el escáner debería ver los módulos del proyecto, vio ${modulos.length}`);
  for (const clave of ['core/constants.js', 'templates/tangram/game/siluetas.js', 'themes/builtin/default.js', 'main.teacher.js']) {
    assert.ok(modulos.includes(clave), `falta ${clave}: se pediría sin sellar`);
  }
  for (const fuera of ['tools/preflight.mjs', 'tests/run.mjs']) {
    assert.ok(!modulos.includes(fuera), `${fuera} no se sirve: no pinta en el mapa`);
  }

  const html = '<head><link rel="stylesheet" href="styles/x.css"></head><body><script type="module" src="main.x.js"></script></body>';
  const uno = sellarHtml(html, '9.9.9', ['core/a.js']);
  assert.ok(uno.includes('"/core/a.js": "/core/a.js?v=9.9.9"'), 'el mapa lleva el módulo sellado');
  assert.ok(uno.indexOf('importmap') < uno.indexOf('type="module" src'),
    'el mapa va ANTES del primer módulo (después, el navegador lo ignora en silencio)');
  assert.ok(uno.includes('src="main.x.js?v=9.9.9"'),
    'la entrada por `src` va sellada en el atributo: a ella el mapa NO llega, y arrastra a las demás');
  assert.strictEqual(sellarHtml(uno, '9.9.9', ['core/a.js']), uno, 'sellar dos veces da lo mismo');
  assert.strictEqual((sellarHtml(uno, '9.9.8', ['core/a.js']).match(/importmap/g) || []).length, 1,
    'una versión nueva REEMPLAZA el mapa, no lo acumula');
  const sinModulos = '<body><p>hola</p></body>';
  assert.strictEqual(sellarHtml(sinModulos, '9.9.9', ['core/a.js']), sinModulos, 'una página sin módulos no se toca');
  assert.deepStrictEqual(JSON.parse(importMapHtml(['core/a.js', 'core/b.js'], '1.0.0').replace(/<\/?script[^>]*>/g, '')).imports,
    { '/core/a.js': '/core/a.js?v=1.0.0', '/core/b.js': '/core/b.js?v=1.0.0' },
    'el mapa es un import map válido con claves ABSOLUTAS (que es como resuelve el navegador un ./x.js)');
  ok(`el generador sella los ${modulos.length} módulos en un mapa válido, colocado antes del primero y sin acumularse`);
}

console.log(`\n  ${passed} cacheBusting checks passed`);
