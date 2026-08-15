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
import { sellarHtml, htmlsDelProyecto } from '../tools/stamp-assets.mjs';

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

// ── 2. Las de CDN NO se tocan ───────────────────────────────────────────────
// Bootstrap ya viene versionado en su ruta; añadirle un parámetro solo rompería
// su caché compartida entre sitios sin ganar nada.
{
  const srcTeacher = leer('teacher.html');
  const cdn = srcTeacher.match(/<link[^>]*href="https:\/\/[^"]+"/g) || [];
  assert.strictEqual(cdn.length >= 1, true, 'teacher.html carga alguna hoja de CDN');
  for (const l of cdn) assert.ok(!/\?v=/.test(l), `una hoja de CDN no debe llevar sello: ${l}`);
  ok('las hojas de CDN se dejan como están (ya vienen versionadas en su ruta)');
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

console.log(`\n  ${passed} cacheBusting checks passed`);
