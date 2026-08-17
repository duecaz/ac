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
// NADIE. Este test fija que la ronda de dibujo trae el mando y que habla con el
// canvas — o el mando vuelve a quedarse sin cable.
//
// FORMA (dueño, 2026-08-15): un INTERRUPTOR, no dos pastillas. Y con él, las
// otras dos correcciones de la misma captura, que son de la misma barra: el
// botón de pantalla completa vive DENTRO de ella, y el marco deja de ser una
// segunda tarjeta alrededor de la hoja. Esas dos NO se comprueban aquí: son
// PÍXELES (¿queda sombra?, ¿dentro de qué caja está el botón?) y una regla CSS
// puede existir y aun así perder por especificidad —ya pasó con `:has()`—, así
// que viven en `tools/matrix-smoke.mjs`, que las mide con estilos computados en
// un navegador de verdad. Aquí queda lo que solo se puede ver leyendo el código.
//
// Run: node tests/tcTools.test.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { citaDeFuente } from './helpers/fuente.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(join(ROOT, f), 'utf8');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const ronda = leer('core/textCorrectionRound.js');
const canvas = leer('core/textCorrectionDraw.js');
const css = leer('styles/textCorrection.css');

// ── 1. UN interruptor con los dos lados a la vista ──────────────────────────
{
  citaDeFuente(ronda, /class="tc-switch"/, 'el mando lápiz/borrador existe', 'textCorrectionRound.js');
  citaDeFuente(ronda, /data-side="pen"/, 'con su lado LÁPIZ', 'textCorrectionRound.js');
  citaDeFuente(ronda, /data-side="eraser"/, 'y su lado BORRADOR', 'textCorrectionRound.js');
  assert.strictEqual((ronda.match(/class="tc-switch"/g) || []).length, 1,
    'es UN mando, no dos controles sueltos');
  ok('la ronda trae UN mando con los dos lados siempre a la vista');
}

// ── 1b. TOCAR EL LADO ACTIVO NO CAMBIA DE HERRAMIENTA ──────────────────────
// Al pasar de bolita a dos pastillas etiquetadas, el mando dejó de parecer un
// interruptor y pasó a parecer un SELECTOR — pero el manejador seguía siendo un
// conmutador ciego: el alumno en «Lápiz» que toca «Lápiz» se llevaba el
// borrador, y su siguiente trazo borraba una marca. En Tildes/Comas el puntaje
// es NETO, así que ese gesto costaba puntos sin decir nada.
{
  citaDeFuente(ronda, /closest\('\.tc-switch__side'\)\?\.dataset\.side/,
    'manda el LADO tocado, no un toggle a ciegas', 'textCorrectionRound.js');
  citaDeFuente(ronda, /if \(borrar === sw\.classList\.contains\('is-on'\)\) return;/,
    'y tocar el que ya estaba activo no cambia nada', 'textCorrectionRound.js');
  ok('tocar la pastilla activa NO cambia de herramienta (no se borra una marca por error)');
}

// ── 2. Y están CABLEADOS al canvas ──────────────────────────────────────────
// Lo que falló antes: `setEraser` existía y no lo llamaba nadie.
{
  citaDeFuente(canvas, /setEraser\s*\(/, 'el canvas sigue exponiendo setEraser', 'textCorrectionDraw.js');
  citaDeFuente(ronda, /draw\.setEraser\(/, 'y el interruptor SE LO DICE al canvas', 'textCorrectionRound.js');
  ok('el borrador está cableado: pulsarlo cambia el modo del canvas (antes era una API muerta)');
}

// ── 3. Arranca en LÁPIZ — no cuesta ni un toque responder (§29) ─────────────
// Un selector de herramienta que empiece "sin elegir" añadiría un toque a CADA
// alumno en CADA frase; el presupuesto de conducción no lo permite.
// El interruptor nace APAGADO = lápiz (`aria-pressed` habla del borrador).
{
  const sw = ronda.match(/<button[^>]*class="tc-switch"[\s\S]*?>/)?.[0] || '';
  assert.ok(!/is-on/.test(sw), 'el interruptor NO puede nacer encendido (encendido = borrador)');
  assert.match(sw, /aria-pressed="false"/, 'y el estado se anuncia (aria-pressed)');
  assert.match(sw, /data-tool="pen"/, 'nace en lápiz');
  ok('arranca en lápiz: escribir la tilde sigue costando CERO toques extra (§29)');
}

// ── 4. Se ve a 3 metros y lo recolorean los skins (§3 · R1) ─────────────────
{
  const bloque = css.slice(css.indexOf('.tc-switch'), css.indexOf('.tc-done-wrap'));
  assert.ok(/cqmin|cqh|cqw|em/.test(bloque), 'los tamaños van en unidades relativas, no en px fijos');
  assert.match(bloque, /var\(--ww-accent/, 'el color sale de un TOKEN para que el skin lo recoloree');
  assert.match(bloque, /\.tc-switch\.is-on[^}]*(background|transform)/s,
    'encendido se distingue por RELLENO y POSICIÓN, no solo por matiz (3 m y daltonismo)');
  ok('el interruptor escala con el marco y se recolorea por token (§3 · R1)');
}

// ── 4a. Icono Y palabra DENTRO de cada pastilla, y sin pedir red ───────────
// «Los iconos van dentro» (dueño, 2026-08-15, con maqueta): dos pastillas en un
// carril, cada una con su icono y su palabra, y la activa RELLENA. A 3 m un
// icono suelto no dice si escribes o borras. Y los iconos son SVG de Lucide
// PEGADOS, no una librería de CDN: la clase no se queda sin mando porque el
// colegio filtre un dominio (la lección de la CDN de Bootstrap).
{
  const bloque = css.slice(css.indexOf('.tc-switch'), css.indexOf('.tc-done-wrap'));
  for (const lado of ['pen', 'er']) {
    const zona = ronda.slice(ronda.indexOf(`tc-switch__side--${lado}`), ronda.indexOf(`tc-switch__side--${lado}`) + 220);
    assert.match(zona, /\$\{LUCIDE\.\w+\}/, `la pastilla ${lado} lleva su icono DENTRO`);
    assert.match(zona, /tc-switch__word">[^<]+</, `y su palabra DENTRO`);
  }
  citaDeFuente(bloque, /\.tc-switch\.is-on\s+\.tc-switch__side--er[\s\S]{0,200}?background:\s*var\(--ww-accent/,
    'la pastilla activa va RELLENA con el token del skin (no solo un matiz)', 'textCorrection.css');
  citaDeFuente(ronda, /<svg class="tc-ico"[\s\S]*stroke="currentColor"/,
    'los iconos son SVG en línea y toman el color del token (no una fuente ni un CDN)', 'textCorrectionRound.js');
  const zonaSw = ronda.slice(ronda.indexOf('class="tc-switch"'), ronda.indexOf('tc-passage-area'));
  assert.ok(!/https?:\/\//.test(zonaSw), 'el mando no puede depender de ningún dominio externo');
  ok('cada pastilla lleva icono Y palabra dentro; la activa va rellena · Lucide en línea, sin red');
}

// ── 4b. El botón de pantalla completa lo ALOJA la barra ────────────────────
// Que quede DENTRO de la caja de la barra y que la esquina flotante desaparezca
// se mide en el navegador (matrix-smoke, «un solo marco / botón en la barra»).
// Aquí solo el cable: un icono sin `attachFullscreenButton` es decoración.
{
  citaDeFuente(ronda, /fullscreenButtonHtml\(\{\s*inline:\s*true\s*\}\)/,
    'la barra ALOJA el botón de pantalla completa (no lo deja flotando)', 'textCorrectionRound.js');
  citaDeFuente(ronda, /attachFullscreenButton\(/,
    'y está cableado: pulsarlo expande de verdad', 'textCorrectionRound.js');
  // Y TAMBIÉN EN LA CORRECCIÓN: esa pantalla no pintaba barra, así que el botón
  // se iba a la esquina flotante y volvía en la frase siguiente. Un mando que
  // salta de sitio según la mitad del ejercicio en la que estás no es un mando.
  const corr = ronda.slice(ronda.indexOf('function reveal('), ronda.indexOf('function finish('));
  assert.match(corr, /tc-bar tc-bar--fs/, 'la pantalla de corrección también pinta su barra');
  assert.match(corr, /fullscreenButtonHtml\(\{ inline: true \}\)/, 'con el botón dentro');
  assert.match(corr, /soltarFs\(\)/, 'y lo suelta al avanzar (ley §23)');
  ok('pantalla completa vive en la barra —también en la corrección— y está cableada');
}

// ── 5. CONTRA-PRUEBA: no es un control destructivo (§28 R2b) ───────────────
// Dentro del marco de juego solo puede haber controles DEL JUEGO: quien toca la
// pantalla suele ser un alumno, sobre la cuenta del profe.
{
  // Se ancla al ROL (`edu-topbar`), que es lo que la norma define, no al nombre
  // propio de la clase — que puede cambiar con el CSS de la plantilla.
  const zona = ronda.slice(ronda.indexOf('<div class="edu-topbar'), ronda.indexOf('tc-done-wrap'));
  assert.ok(zona.length > 40, 'la barra de herramientas se localiza por su rol edu-topbar');
  for (const prohibido of ['Borrar todo', 'Eliminar', 'Editar', 'Cerrar sesión', 'href=']) {
    assert.ok(!zona.includes(prohibido), `la barra de herramientas no puede llevar «${prohibido}»`);
  }
  assert.ok(/borrador/i.test(zona), 'borrar TRAZO sí: es del juego, no de los datos del profe');
  ok('CONTRA-PRUEBA: borra el trazo, nunca contenido del profe (§28 R2b)');
}

console.log(`\n  ${passed} tcTools checks passed`);
