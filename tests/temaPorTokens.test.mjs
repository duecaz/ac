// LA FRONTERA DEL SKIN — un tema RECOLOREA, no reforma (§3 · §0).
//
// Por qué existe (dueño, 2026-08-21): «el sistema de nombres es para que los
// skins puedan identificar pocas partes y ser más transparentes». Hoy no lo es:
// `arcade` y `tv-show` nacieron ANTES de la ley de tokens y llegan con
// selectores como
//     .vs-skin-tv-show .vs-panel.vs-left .vs-body .ww-keypad-q { background: … }
// — el tema metiendo la mano hasta la chapa del enunciado de Operaciones, a
// cuatro niveles de profundidad. Cada arreglo de esta semana (columnas,
// contraste, marcos) fue pelearse con una de esas reglas.
//
// Ya hay una ley que vigila que un tema no MIDA (tests/temaSinMedidas.test.mjs).
// Esta vigila lo otro: que no PINTE dentro de la anatomía de una plantilla.
// La vía legítima existe y está probada: los tokens se pueden redefinir POR
// CONTENEDOR, que es lo que resuelve el azul/rojo por lado sin conocer el DOM:
//     .vs-skin-tv-show .vs-left  { --key-bg: linear-gradient(…); }
// Donde falte un gancho, se AÑADE el token a la plantilla con su fallback:
// ampliar el vocabulario público es legal; abrir la anatomía, no.
//
// RATCHET, no big-bang: las reglas invasoras de HOY quedan congeladas con su
// número. No puede entrar una nueva, y el número solo baja — cada tanda de la
// migración lo baja y actualiza el tope. Migrar 470 líneas de identidad visual
// de un tirón, sin valla y sin capturas, es como se rompió la barra del
// marcador (256k píxeles de diferencia).
//
// Run: node tests/temaPorTokens.test.mjs
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── QUÉ ES «ANATOMÍA DE PLANTILLA», por DESCUBRIMIENTO ──────────────────────
// No una lista de prefijos a mano (envejece y deja fuera la plantilla nueva).
// Se declara lo contrario —las hojas de CHROME, que son pocas y estables— y
// TODO lo demás en styles/ es anatomía de juego. Así una plantilla nueva nace
// protegida sin que nadie se acuerde de apuntarla.
const CHROME = {
  'home.css':        'la barra y «Mis actividades»: chrome del profe, no juego',
  'editor.css':      'el editor es un formulario, no el juego',
  'live.css':        'el tablero del docente en vivo',
  'teams.css':       'el montaje de equipos',
  'vs.css':          'la arena del duelo: marcador, escenario, paneles — de esto SÍ es dueño el tema',
  'backgrounds.css': 'las texturas de fondo (otro eje)',
  'theme.css':       'los tokens base',
  'skins.css':       'el selector de temas',
  'touch.css':       'afinado táctil',
  'soloAnim.css':    'la animación de progreso',
  'player.css':      'el marco y el HUD: superposición de plataforma, con su velo neutro',
  'scaffold.css':    'el andamio de regiones (maquetación pura: ya lo vigila temaSinMedidas)',
};

const clasesDe = (css) => new Set(
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));

const anatomia = new Set();
for (const f of readdirSync(join(ROOT, 'styles')).filter(f => f.endsWith('.css'))) {
  if (CHROME[f]) continue;
  for (const c of clasesDe(readFileSync(join(ROOT, 'styles', f), 'utf8'))) anatomia.add(c);
}
assert.ok(anatomia.size > 50, `se esperaba descubrir la anatomía de las plantillas, hay ${anatomia.size} clases`);
ok(`anatomía descubierta: ${anatomia.size} clases de juego en ${readdirSync(join(ROOT, 'styles')).filter(f => f.endsWith('.css') && !CHROME[f]).length} hojas de plantilla (las de chrome se declaran aparte, con motivo)`);

// ── LAS REGLAS DE CADA TEMA ─────────────────────────────────────────────────
/** Parte una hoja en reglas {selector, propiedades[]}, sin comentarios. */
function reglas(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...limpio.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({
    selector: m[1].trim().replace(/\s+/g, ' '),
    props: m[2].split(';').map(p => p.split(':')[0].trim()).filter(Boolean),
  }));
}

/** Las clases que el selector ALCANZA (cualquiera de sus partes). */
const clasesDelSelector = (sel) => [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]);

const invasoras = {};
const temas = readdirSync(join(ROOT, 'themes'), { withFileTypes: true })
  .filter(e => e.isDirectory()).map(e => e.name);
for (const tema of temas) {
  const ruta = join(ROOT, 'themes', tema, 'skin.css');
  let css; try { css = readFileSync(ruta, 'utf8'); } catch { continue; }
  invasoras[tema] = [];
  for (const r of reglas(css)) {
    const pintadas = r.props.filter(p => !p.startsWith('--'));
    if (!pintadas.length) continue;                       // solo tokens: la vía legítima
    const toca = clasesDelSelector(r.selector).filter(c => anatomia.has(c));
    if (toca.length) invasoras[tema].push({ sel: r.selector, toca: [...new Set(toca)], props: pintadas });
  }
}

// ── EL RATCHET ──────────────────────────────────────────────────────────────
// La deuda de HOY, congelada. Cada tanda de la migración baja estos números y
// los actualiza aquí; el test falla si SUBEN (una regla invasora nueva) y
// también si BAJAN sin actualizar el tope (para que el ratchet no se quede
// mintiendo hacia arriba y deje entrar reglas gratis).
const TOPE = {
  'tv-show': 28,   // TANDA 2-3: Operaciones (ww-keypad*/ww-key*) y luego ww-opt/ww-shape
  'arcade':  12,   // idem
};
const filas = temas.map(t => ({ tema: t, n: (invasoras[t] || []).length, tope: TOPE[t] }));
console.log('\n  reglas de tema que PINTAN dentro de la anatomía de una plantilla:');
for (const f of filas) console.log(`    ${f.tema.padEnd(9)} ${String(f.n).padStart(3)}  (tope ${f.tope ?? '0 — tema nuevo, nace limpio'})`);

const subidas = filas.filter(f => f.n > (f.tope ?? 0));
assert.deepStrictEqual(subidas.map(f => `${f.tema}: ${f.n} > tope ${f.tope ?? 0}`), [],
  'un tema pinta DENTRO de una plantilla más que antes.\n'
  + 'La vía es el TOKEN (se puede redefinir por contenedor: `.vs-skin-x .vs-left { --key-bg: … }`);\n'
  + 'si falta el gancho, se añade a la plantilla con fallback.\n'
  + subidas.flatMap(f => (invasoras[f.tema] || []).slice(0, 6)
      .map(r => `  ${f.tema}: ${r.sel.slice(0, 70)} → ${r.props.join(', ')}`)).join('\n'));
ok('ningún tema pinta dentro de una plantilla MÁS que la deuda congelada (ratchet)');

const bajadas = filas.filter(f => f.tope != null && f.n < f.tope);
assert.deepStrictEqual(bajadas.map(f => `${f.tema}: ${f.n} < tope ${f.tope}`), [],
  'la deuda BAJÓ (bien) pero el tope quedó viejo: bájalo en TOPE para que el trecho ganado no se pueda perder');
ok('el tope refleja la deuda real de hoy (un ratchet suelto deja entrar reglas gratis)');

// ── CONTRA-PRUEBA: la vía legítima pasa, y una invasión nueva NO ────────────
// Sin esto el test podría estar prohibiéndolo todo —incluido lo correcto— y
// nadie lo notaría hasta intentar escribir un tema.
{
  const anatomico = [...anatomia].find(c => /^ww-key$|^ww-opt$/.test(c)) || [...anatomia][0];
  const legitimas = reglas(`
    .vs-skin-x .vs-left { --key-bg: red; --key-fg: white; }
    .vs-skin-x .vss-bar { height: 46px; background: navy; }
    .vs-skin-x .${anatomico} { --algo: 2px; }
  `);
  for (const r of legitimas) {
    const pintadas = r.props.filter(p => !p.startsWith('--'));
    const toca = clasesDelSelector(r.selector).filter(c => anatomia.has(c));
    assert.ok(!(pintadas.length && toca.length), `esta regla es legítima y el test la acusa: ${r.selector}`);
  }
  const invasora = reglas(`.vs-skin-x .${anatomico} { background: red; }`)[0];
  assert.ok(clasesDelSelector(invasora.selector).some(c => anatomia.has(c))
    && invasora.props.some(p => !p.startsWith('--')), 'el test debe cazar una invasión nueva');
  ok(`CONTRA-PRUEBA: los tokens por contenedor y el chrome del tema pasan; pintar «.${anatomico}» se caza`);
}

console.log(`\ntemaPorTokens.test: ${passed} checks passed`);
