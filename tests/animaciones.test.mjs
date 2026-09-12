// LA REGLA DE LAS ANIMACIONES — solo `transform` y `opacity` (Fase 3 de
// `docs/handoff-rendimiento-animaciones.md`).
//
// POR QUÉ. La pizarra del aula es 1280×720 CSS a DPR 3 (3840×2160 píxeles
// reales) con una GPU modesta. Lo que se MUEVE por el compositor (`transform`,
// `opacity`) cuesta lo mismo a 1080p que a 4K: el navegador no repinta píxeles,
// compone capas. Todo lo demás —`width`, `top`, `margin`, `text-indent` (que
// recalculan la MAQUETA en cada cuadro) y `filter`/`box-shadow`/`text-shadow`
// (que repintan una región 4K en cada cuadro)— cuesta NUEVE veces más en la
// pizarra que en el portátil donde se programa. Por eso el defecto nunca se ve
// al escribirlo: se ve con la clase delante.
//
// Tres reglas, ejecutables sobre el CSS del JUEGO (styles/ sin el chrome) y
// sobre los TEMAS (un skin pinta el mismo juego):
//   a) un `@keyframes` solo puede animar `transform`/`opacity`;
//   b) una `transition` no puede tocar maqueta ni pintura pesada;
//   c) una animación INFINITA no puede llevar `filter` en la misma regla
//      (el desenfoque se re-aplica en cada vuelta; se pinta UNA vez o no se pinta).
//
// Es un RATCHET: la deuda de hoy queda congelada abajo con su motivo y solo
// puede encoger. Una animación NUEVA nace limpia.
//
// Run: node tests/animaciones.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = join(ROOT, 'styles');

// CHROME = lo que NO es el juego (barra del profe, editor, paletas). Es la misma
// lista que usa el ratchet de estilos; se copia aquí porque importar esa suite la
// ejecutaría dos veces, y justo debajo se comprueba que las dos NO divergen (§21b:
// la misma regla escrita dos veces acaba diciendo dos cosas).
const CHROME = ['backgrounds', 'editor', 'home', 'player', 'skins', 'soloAnim', 'theme', 'touch'];
{
  const src = readFileSync(join(ROOT, 'tests', 'styles.test.mjs'), 'utf8');
  const m = /const EXCLUDED = \[([^\]]*)\]/.exec(src);
  assert.ok(m, 'tests/styles.test.mjs ya no declara EXCLUDED: esta copia se quedó sin referencia');
  const suyo = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.deepStrictEqual(CHROME, suyo,
    'la lista de chrome DIVERGE de EXCLUDED en tests/styles.test.mjs: un CSS quedaría fuera de una ley y dentro de la otra');
}

// ── PROPIEDADES PROHIBIDAS EN MOVIMIENTO ────────────────────────────────────
// Nombre de propiedad exacto (el `-` es frontera de palabra, así que `max-width`
// cae con `width` — a propósito: animar el tope también recalcula la maqueta).
const PROHIBIDAS = [
  ['width', /(?<![\w])(?:min-|max-)?width(?![-\w])/],
  ['height', /(?<![\w])(?:min-|max-)?height(?![-\w])/],
  ['top', /(?<![-\w])top(?![-\w])/],
  ['left', /(?<![-\w])left(?![-\w])/],
  ['right', /(?<![-\w])right(?![-\w])/],
  ['bottom', /(?<![-\w])bottom(?![-\w])/],
  ['margin', /(?<![-\w])margin(?:-[a-z]+)*(?![-\w])/],
  ['text-indent', /(?<![-\w])text-indent(?![-\w])/],
  ['background-position', /(?<![-\w])background-position(?![-\w])/],
  ['filter', /(?<![-\w])(?:backdrop-)?filter(?![-\w])/],
  ['box-shadow', /(?<![-\w])box-shadow(?![-\w])/],
  ['text-shadow', /(?<![-\w])text-shadow(?![-\w])/],
  // `all` es el comodín: transiciona TODO, incluidas las de arriba.
  ['all', /(?<![-\w])all(?![-\w])/],
];
// Lo que SÍ puede cambiar cuadro a cuadro dentro de un @keyframes.
const LIBRES = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale',
  'animation-timing-function', 'offset-distance', 'visibility']);

const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

/** Declaraciones `prop: valor` de un cuerpo de regla (sin bloques anidados). */
function declaraciones(body) {
  return body.split(';').map(d => d.trim()).filter(Boolean).map(d => {
    const i = d.indexOf(':');
    return i < 0 ? null : { prop: d.slice(0, i).trim().toLowerCase(), valor: d.slice(i + 1).trim() };
  }).filter(/** @returns {d is {prop:string,valor:string}} */ d => !!d);
}

/** Saca los bloques `@keyframes nombre { … }` (con llaves emparejadas) y
 *  devuelve el CSS sin ellos + la lista de bloques. */
function partirKeyframes(css) {
  const kfs = [];
  let resto = '', i = 0;
  const re = /@(?:-\w+-)?keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    resto += css.slice(i, m.index);
    let prof = 1, j = re.lastIndex;
    for (; j < css.length && prof; j++) {
      if (css[j] === '{') prof++;
      else if (css[j] === '}') prof--;
    }
    kfs.push({ nombre: m[1], cuerpo: css.slice(re.lastIndex, j - 1) });
    i = j; re.lastIndex = j;
  }
  return { resto: resto + css.slice(i), kfs };
}

/** Las tres reglas sobre UNA hoja. Devuelve strings «fichero → defecto». */
function analizar(cssCrudo, fichero) {
  const css = sinComentarios(cssCrudo);
  const { resto, kfs } = partirKeyframes(css);
  const fallos = [];

  // (a) @keyframes: solo transform/opacity.
  for (const kf of kfs) {
    const vistas = new Set();
    for (const m of kf.cuerpo.matchAll(/\{([^{}]*)\}/g)) {
      for (const d of declaraciones(m[1])) {
        if (d.prop.startsWith('--') || LIBRES.has(d.prop)) continue;
        vistas.add(d.prop);
      }
    }
    for (const p of [...vistas].sort()) {
      fallos.push(`${fichero} @keyframes ${kf.nombre} → ${p}`);
    }
  }

  // (b) transiciones sobre maqueta o pintura pesada, y (c) animación infinita
  //     con `filter` en la misma regla.
  for (const m of resto.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    const decls = declaraciones(m[2]);
    for (const d of decls) {
      const esTransicion = d.prop === 'transition' || d.prop === 'transition-property'
        || (d.prop.startsWith('--') && d.prop.endsWith('-transition'));
      if (!esTransicion) continue;
      for (const [nombre, re] of PROHIBIDAS) {
        if (re.test(d.valor)) fallos.push(`${fichero} «${sel}» transition → ${nombre}`);
      }
    }
    const infinita = decls.some(d => (d.prop === 'animation' && /\binfinite\b/.test(d.valor))
      || (d.prop === 'animation-iteration-count' && /\binfinite\b/.test(d.valor)));
    const conFiltro = decls.some(d => (d.prop === 'filter' || d.prop === 'backdrop-filter') && d.valor !== 'none');
    if (infinita && conFiltro) fallos.push(`${fichero} «${sel}» animación infinita + filter en la misma regla`);
  }
  return [...new Set(fallos)];
}

// ── LA DEUDA DE HOY, CONGELADA ──────────────────────────────────────────────
// Cada línea lleva su motivo. NO se añaden entradas: si una animación nueva
// falla, se rehace con `transform`/`opacity`. Al pagar una, se borra su línea.
const BASELINE = [
  // Fogonazo verde/rojo del duelo al responder. Es `background` (pintura, no
  // maqueta) y dura .7 s una sola vez; `styles/vs.css` lo está tocando otra
  // tanda del plan (la celebración), así que aquí no se toca.
  'styles/vs.css @keyframes vs-flash-no → background',
  'styles/vs.css @keyframes vs-flash-ok → background',
  // Latido del medallón «VS» del tema TV: anima `box-shadow` INFINITO. Para
  // rehacerlo con `transform`/`opacity` hace falta un segundo pseudo-elemento
  // (el ::before ya es el aro giratorio) y eso cambia el aspecto: es decisión
  // del dueño, no de quien mide.
  'themes/tv-show/skin.css @keyframes tvs-badge → box-shadow',
  // TRANSICIONES DE ESTADO (hover, selección, veredicto): no son bucles, cuestan
  // un puñado de cuadros mientras dura el gesto. Se congelan para que dejen de
  // ser invisibles y solo puedan bajar.
  'styles/diagram.css «.dg-label» transition → box-shadow',
  'styles/match.css «.ww-match .ww-card» transition → box-shadow',
  'styles/opcion.css «.ww-player .ww-opt-grid .ww-opt» transition → box-shadow',
  'styles/opcion.css «.ww-opt-grid .btn» transition → box-shadow',
  'styles/teams.css «.teams-chip» transition → box-shadow',
  'themes/tv-show/skin.css «.skin-tv-show .btn-primary» transition → box-shadow',
  // `--opt-transition` / `--key-transition`: el tema PIDE la ficha 3D y la tecla
  // con el vocabulario que publica el juego; el `filter` es el brillo del hover.
  'themes/tv-show/skin.css «.skin-tv-show» transition → box-shadow',
  'themes/tv-show/skin.css «.skin-tv-show» transition → filter',
  'themes/tv-show/skin.css «.vs-skin-tv-show .vs-body» transition → box-shadow',
  // El interruptor lápiz/borrador de Tildes y Comas: el relleno «se desliza»
  // porque la palabra apagada encoge su `max-width` (decisión del dueño,
  // 2026-08-16). Dura .22 s sobre una pastilla pequeña.
  'styles/textCorrection.css «.tc-switch__word» transition → width',
];

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// ── ESCANEO REAL ────────────────────────────────────────────────────────────
const hojas = [
  ...readdirSync(STYLES).filter(f => f.endsWith('.css'))
    .filter(f => !CHROME.includes(f.replace(/\.css$/, '')))
    .map(f => ({ rel: `styles/${f}`, abs: join(STYLES, f) })),
  ...readdirSync(join(ROOT, 'themes'), { withFileTypes: true }).filter(d => d.isDirectory())
    .flatMap(d => readdirSync(join(ROOT, 'themes', d.name)).filter(f => f.endsWith('.css'))
      .map(f => ({ rel: `themes/${d.name}/${f}`, abs: join(ROOT, 'themes', d.name, f) }))),
];
assert.ok(hojas.length >= 15, `solo ${hojas.length} hojas escaneadas: el escáner no está mirando el CSS del juego`);

const encontrados = [];
for (const h of hojas) encontrados.push(...analizar(readFileSync(h.abs, 'utf8'), h.rel));

const nuevas = encontrados.filter(v => !BASELINE.includes(v));
if (nuevas.length) {
  console.error('\n✗ animaciones que repintan o recalculan la maqueta en cada cuadro:\n  - ' + nuevas.join('\n  - '));
  console.error('\n  Regla: dentro del juego solo se animan `transform` y `opacity` (y los lienzos');
  console.error('  llevan tope). Ver docs/estilos-de-actividad.md §3d. NO la añadas al BASELINE.');
}
assert.strictEqual(nuevas.length, 0, `${nuevas.length} animación(es) cara(s) nueva(s) — ver arriba`);
ok(`${hojas.length} hojas de juego y temas escaneadas: ninguna animación cara nueva sobre el baseline`);

// …y al revés: una entrada del BASELINE cuyo defecto ya no existe es HOLGURA —
// deuda pagada que sigue apuntada y por cuyo hueco cabe la misma regresión.
const holguras = BASELINE.filter(b => !encontrados.includes(b));
assert.deepStrictEqual(holguras, [],
  `HOLGURA en el BASELINE (la deuda ya se pagó: borra su línea):\n  ${holguras.join('\n  ')}`);
ok(`baseline sin holgura: las ${BASELINE.length} entradas congeladas siguen existiendo`);

// ── LA RED EN ROJO: se PLANTA una hoja con los tres defectos ────────────────
// Sin esto, la suite podría estar mirando a otro lado y dar verde para siempre.
{
  const scratch = mkdtempSync(join(tmpdir(), 'ww-anim-'));
  const malo = join(scratch, 'plantada.css');
  writeFileSync(malo, `
    @keyframes mala-marquesina { from { text-indent: 100%; } to { text-indent: -240%; } }
    .plantada-marquesina { animation: mala-marquesina 16s linear infinite; }
    .plantada-hover { transition: box-shadow .2s, width .3s; }
    .plantada-aro { filter: blur(3px); animation: mala-marquesina 4s linear infinite; }
  `);
  const vistos = analizar(readFileSync(malo, 'utf8'), 'plantada.css');
  rmSync(scratch, { recursive: true, force: true });
  assert.ok(vistos.includes('plantada.css @keyframes mala-marquesina → text-indent'),
    `la red NO ve un @keyframes que anima la maqueta: ${vistos.join(' · ')}`);
  assert.ok(vistos.includes('plantada.css «.plantada-hover» transition → box-shadow'),
    `la red NO ve una transición sobre pintura pesada: ${vistos.join(' · ')}`);
  assert.ok(vistos.includes('plantada.css «.plantada-hover» transition → width'),
    `la red NO ve una transición sobre la maqueta: ${vistos.join(' · ')}`);
  assert.ok(vistos.includes('plantada.css «.plantada-aro» animación infinita + filter en la misma regla'),
    `la red NO ve un desenfoque girando sin parar: ${vistos.join(' · ')}`);
  ok('en ROJO con una hoja plantada: ve el text-indent en marcha, la transición cara y el blur girando');
}

// ── CONTRA-PRUEBA: el camino legítimo sigue ─────────────────────────────────
// Una animación de las buenas —mover, girar, desvanecer, y un `filter` QUIETO—
// no puede romper CI, o la ley se volvería «no animes» y se acabaría apagando.
{
  const bueno = `
    @keyframes buena-gira { to { transform: rotate(360deg); } }
    @keyframes buena-entra { from { opacity: 0; transform: translateY(10px) scale(.9); } to { opacity: 1; transform: none; } }
    .buena-aro { animation: buena-gira 4s linear infinite; will-change: transform; }
    .buena-tarjeta { transition: transform .15s, opacity .2s, background .15s, color .15s, border-color .2s; }
    .buena-foto { filter: blur(3px); }
    .buena-pop { animation: buena-entra .5s ease-out both; }
  `;
  assert.deepStrictEqual(analizar(bueno, 'legitima.css'), [],
    'la ley está DEMASIADO cerrada: una animación legítima de transform/opacity rompería CI');
  ok('contra-prueba: girar, entrar, desvanecer y un filter QUIETO siguen pasando');
}

console.log(`\nanimaciones.test: ${passed} checks passed`);
