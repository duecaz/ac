// LÁPIZ / BORRADOR en Tildes y Comas — el mando MANUAL de la pizarra.
//
// Por qué existe: la herramienta se detecta por el TAMAÑO del contacto
// (`core/penDetector.js`: punta dibuja, palma borra). Acierta casi siempre, y
// "casi siempre" con 33 críos delante no basta — en una pizarra sin calibrar, o
// con un lápiz que no reporta área de contacto, BORRAR era imposible. Y en estas
// dos actividades una marca de más RESTA (`scoreMarksPerHit`: puntaje neto), así
// que no poder borrar no es una molestia: es perder puntos por algo que el
// alumno sí sabía.
//
// El canvas ya exponía `setEraser(on)` desde el primer día… y no lo llamaba
// NADIE. Este test fija que la ronda de dibujo trae los dos botones y que el de
// borrar habla con el canvas — o el mando vuelve a quedarse sin cable.
//
// Run: node tests/tcTools.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(ROOT, f), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ronda = leer('core/textCorrectionRound.js');
const canvas = leer('core/textCorrectionDraw.js');
const css = leer('styles/textCorrection.css');

// ── 1. Los DOS botones existen en la ronda de dibujo ────────────────────────
{
  assert.match(ronda, /data-tool="pen"/, 'falta el botón de LÁPIZ');
  assert.match(ronda, /data-tool="eraser"/, 'falta el botón de BORRADOR');
  ok('la ronda de dibujo trae lápiz y borrador (los dos, siempre a la vista)');
}

// ── 2. Y están CABLEADOS al canvas ──────────────────────────────────────────
// Lo que falló antes: `setEraser` existía y no lo llamaba nadie.
{
  assert.match(canvas, /setEraser\s*\(/, 'el canvas debe seguir exponiendo setEraser');
  assert.match(ronda, /draw\.setEraser\(/, 'el botón de borrar tiene que DECÍRSELO al canvas');
  ok('el borrador está cableado: pulsarlo cambia el modo del canvas (antes era una API muerta)');
}

// ── 3. Arranca en LÁPIZ — no cuesta ni un toque responder (§29) ─────────────
// Un selector de herramienta que empiece "sin elegir" añadiría un toque a CADA
// alumno en CADA frase; el presupuesto de conducción no lo permite.
{
  const penBtn = ronda.match(/<button[^>]*data-tool="pen"[^>]*>/)?.[0] || '';
  const eraserBtn = ronda.match(/<button[^>]*data-tool="eraser"[^>]*>/)?.[0] || '';
  assert.match(penBtn, /is-on/, 'el LÁPIZ debe venir ya seleccionado');
  assert.ok(!/is-on/.test(eraserBtn), 'el borrador NO puede venir activo');
  assert.match(penBtn, /aria-pressed="true"/, 'y el estado se anuncia (aria-pressed)');
  ok('arranca en lápiz: escribir la tilde sigue costando CERO toques extra (§29)');
}

// ── 4. Se ve a 3 metros y lo recolorean los skins (§3 · R1) ─────────────────
{
  const bloque = css.slice(css.indexOf('.tc-tool'), css.indexOf('.tc-done-wrap'));
  assert.ok(/cqmin|cqh|cqw|em/.test(bloque), 'los tamaños van en unidades relativas, no en px fijos');
  assert.match(bloque, /var\(--ww-accent/, 'el color sale de un TOKEN para que el skin lo recoloree');
  assert.match(bloque, /\.tc-tool\.is-on[^}]*background/s,
    'el activo se distingue por RELLENO, no solo por matiz (mirada a 3 m, y daltonismo)');
  ok('los botones escalan con el marco y se recolorean por token (§3 · R1)');
}

// ── 5. CONTRA-PRUEBA: no son un control destructivo (§28 R2b) ──────────────
// Dentro del marco de juego solo puede haber controles DEL JUEGO: quien toca la
// pantalla suele ser un alumno, sobre la cuenta del profe.
{
  const zona = ronda.slice(ronda.indexOf('tc-tools'), ronda.indexOf('tc-done-wrap'));
  for (const prohibido of ['Borrar todo', 'Eliminar', 'Editar', 'Cerrar sesión', 'href=']) {
    assert.ok(!zona.includes(prohibido), `la barra de herramientas no puede llevar «${prohibido}»`);
  }
  assert.ok(/Borrador/.test(zona), 'borrar TRAZO sí: es del juego, no de los datos del profe');
  ok('CONTRA-PRUEBA: borra el trazo, nunca contenido del profe (§28 R2b)');
}

console.log(`\n  ${passed} tcTools checks passed`);
