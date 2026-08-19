// TUMORES — código que la app NO PUEDE ALCANZAR, cazado por DESCUBRIMIENTO.
//
// Por qué existe esta suite: `views/sorteoView.js` (una ruleta de aula suelta,
// 107 líneas) vivía en el repo con su ruta `#/sorteo` registrada, sin un solo
// enlace que llevara hasta ella. Ni el dueño del proyecto sabía que estaba ahí
// («no sé cómo apareció eso»). Detrás salieron cuatro más: `core/tts.js`,
// `themes/colegios/skin.css` (un skin que ningún `registerSkin` cargaba),
// `tools/test.html` (una segunda suite de tests, en el navegador, que nadie
// abría) y el alias de ruta `#/modos`.
//
// Un tumor no es solo peso muerto: MIENTE. Se lee como código vivo al auditar,
// aparece en las búsquedas, se "arregla" cuando algo lo roza, y el día que
// alguien lo enlaza por casualidad descubre que llevaba meses roto — con la
// clase delante. Y ninguna ley lo veía: `layers` comprueba la DIRECCIÓN de los
// imports, no que exista alguno; `moduleRefs`, que lo importado exista.
//
// Regla: **todo módulo, ruta y hoja de estilo del producto tiene que ser
// ALCANZABLE**, o estar declarado abajo con su motivo. La lista se ESCANEA del
// repo, no se enumera a mano: un módulo nuevo huérfano rompe CI solo.
//
// Run: node tests/huerfanos.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── Lo que SÍ puede no tener importador, y por qué ────────────────────────
// (Si añades algo aquí, escribe el motivo: escribirlo es cuando se ve si de
//  verdad lo es. Sin motivo, es un tumor con permiso.)
const PUERTAS = [
  [/^main\.[a-z]+\.js$/,        'entrada de página: la carga el <script type=module> de su HTML'],
  [/^sw\.js$/,                  'service worker: lo registra el navegador, no un import'],
  [/^tools\//,                  'herramientas de línea de comandos: las arranca node, no un import'],
  [/^tests\//,                  'suites: las arranca tests/run.mjs'],
  [/^assets\/js\//,             'librería de terceros: se carga con un <script> creado en tiempo de ejecución'],
  [/^pocketbase\.config\.js$/,  'configuración: la leen los adaptadores por import dinámico según el backend'],
  // El único código que NO corre en el navegador: lo carga PocketBase en la Pi
  // (carpeta `pb_hooks/`). Nadie lo importa porque nadie PUEDE — está en otro
  // runtime. Existe para que la clave de la IA no tenga que viajar al navegador;
  // que el cliente y él no se desincronicen lo vigila tests/aiContent.test.mjs.
  [/^pb_hooks\//,              'hook de PocketBase: lo carga el servidor de la Pi, no un import'],
];
const puertaDe = (f) => PUERTAS.find(([re]) => re.test(f));

// ── El repo, leído ────────────────────────────────────────────────────────
const SALTAR = /node_modules|[/\\]\.git|scratchpad|docs[/\\]historico|\.min\.js$/;
function paseo(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (SALTAR.test(p)) continue;
    if (e.isDirectory()) paseo(p, out); else out.push(relative(ROOT, p).split('\\').join('/'));
  }
  return out;
}
const TODO = paseo(ROOT);
const JS = TODO.filter(f => /\.(js|mjs)$/.test(f));
const HTML = TODO.filter(f => f.endsWith('.html'));
const CSS = TODO.filter(f => f.endsWith('.css'));
const leer = (f) => readFileSync(join(ROOT, f), 'utf8');
const FUENTES = new Map(TODO.filter(f => /\.(js|mjs|html|css)$/.test(f)).map(f => [f, leer(f)]));
const TEXTO_HTML = HTML.map(f => FUENTES.get(f)).join('\n');

// ── 1. Ningún módulo sin puerta de entrada ────────────────────────────────
// Cuenta a la vez los imports ESTÁTICOS (`from '…'`), los de EFECTO SECUNDARIO
// (`import './x.js'` — así se registran las 13 plantillas) y los DINÁMICOS
// (`import('./main.teacher.js' + bust)`, que es como los HTML arrancan).
{
  const importadores = new Map(JS.map(f => [f, new Set()]));
  const RE = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g;
  for (const [f, src] of FUENTES) {
    if (!/\.(js|mjs)$/.test(f)) continue;
    for (const m of src.matchAll(RE)) {
      const destino = relative(ROOT, resolve(dirname(join(ROOT, f)), m[1])).split('\\').join('/');
      if (importadores.has(destino)) importadores.get(destino).add(f);
    }
  }
  // Un HTML puede citar el módulo por su nombre (import dinámico con cache-bust).
  const huerfanos = [...importadores]
    .filter(([f, imps]) => imps.size === 0 && !puertaDe(f) && !TEXTO_HTML.includes(f))
    .map(([f]) => f);
  assert.deepStrictEqual(huerfanos, [],
    `módulos que NADIE importa (código inalcanzable — bórralo o dale su puerta): ${huerfanos.join(' · ')}`);
  ok(`${importadores.size} módulos: todos alcanzables (${PUERTAS.length} clases de puerta declaradas)`);
}

// ── 2. Ninguna ruta sin un enlace que lleve a ella ────────────────────────
// El caso `#/sorteo`: la ruta existía, la vista pintaba, y no había forma de
// llegar salvo tecleando la dirección. Se cuenta cualquier cita FUERA de la
// declaración (un href, un navigate(), un data-attr) en código de producto.
{
  const mains = JS.filter(f => /^main\.[a-z]+\.js$/.test(f));
  const produccion = [...FUENTES].filter(([f]) => !f.startsWith('tests/') && !f.startsWith('tools/'));
  const sinEntrada = [];
  for (const m of mains) {
    for (const r of FUENTES.get(m).matchAll(/route\('([^']+)'/g)) {
      const base = r[1].split('/:')[0];
      if (base === '#/' || base === '#') continue;            // la raíz no se enlaza: se teclea
      const re = new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const citas = produccion.reduce((n, [, s]) => n + (s.match(re) || []).length, 0);
      if (citas <= 1) sinEntrada.push(`${r[1]} (${m})`);       // 1 = su propia declaración
    }
  }
  assert.deepStrictEqual(sinEntrada, [],
    `rutas a las que NO se llega desde ninguna parte del producto: ${sinEntrada.join(' · ')} — enlázala o bórrala`);
  ok('todas las rutas registradas tienen al menos un enlace que lleva a ellas');
}

// ── 3. Ninguna hoja de estilo que nadie cargue ────────────────────────────
// `themes/colegios/skin.css` eran 135 líneas que ningún profe podía ver. Una
// hoja se carga desde un <link>, desde un @import, o porque un módulo la nombra
// (`stylesheet: 'themes/arcade/skin.css'` en core/skins.js).
{
  const texto = [...FUENTES].filter(([f]) => !f.startsWith('tests/')).map(([, s]) => s).join('\n');
  const sueltas = CSS.filter(c => !texto.includes(c));
  assert.deepStrictEqual(sueltas, [],
    `hojas de estilo que nadie carga: ${sueltas.join(' · ')}`);
  ok(`${CSS.length} hojas de estilo: todas cargadas por un HTML, un @import o un módulo`);
}

// ── 4. CONTRA-PRUEBA: el escáner caza de verdad ───────────────────────────
// Sin esto, un fallo del parser (una forma de import no contemplada) dejaría la
// lista vacía y todo verde — que es justo cómo un tumor sobrevive a su vigilante.
{
  const fantasma = 'core/__tumor_de_prueba.js';
  const importadores = new Map([[fantasma, new Set()], ['core/html.js', new Set(['views/home.js'])]]);
  const cazados = [...importadores].filter(([f, i]) => i.size === 0 && !puertaDe(f)).map(([f]) => f);
  assert.deepStrictEqual(cazados, [fantasma], 'el cruce detecta un módulo sin importadores');

  // Y las puertas declaradas no son un colador: solo eximen lo que dicen.
  assert.ok(puertaDe('main.teacher.js'), 'una entrada de página está exenta');
  assert.ok(!puertaDe('views/loQueSea.js'), 'una vista NO está exenta por accidente');
  ok('CONTRA-PRUEBA: un módulo huérfano nuevo sería cazado, y las puertas no eximen de más');
}

console.log(`\n  ${passed} huerfanos checks passed`);
