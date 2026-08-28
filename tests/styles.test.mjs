// Lint de estilos de ACTIVIDAD — barrera anti-regresión para el estándar de
// maquetación del PLAYER (CLAUDE.md → "Estándares transversales"):
//   1) NADA con tamaño fijo en el juego: la fuente escala con el contenedor
//      (cq*/%, o un piso max()/clamp() con término responsivo), nunca un px/rem
//      que congele el crecimiento → se ve bien en 4K, 600×800, 9:16 y 16:9.
//   2) Los colores "pintables" (color/background) van por token `var(--ww-*)`
//      para que los SKINS puedan recolorear la actividad al cambiar de piel.
//
// No es un formateador: es un RATCHET (trinquete). La deuda actual queda
// congelada en BASELINE (por archivo, por valor) y NO puede crecer; cualquier
// actividad NUEVA (archivo sin baseline) debe nacer limpia. math.css y opcion.css
// son los ejemplares: 0 violaciones, baseline vacío.
//
// Run: node tests/styles.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles');

// CSS de juego (player). Se excluyen: theme/skins/backgrounds (definen paletas),
// editor/player-frame/touch/soloAnim/live (chrome, no el ejercicio).
// `opcion` es JUEGO sin discusión: es la pastilla que el alumno pulsa. Y de paso
// deshace la incoherencia que bloqueaba la TANDA 4 de temas — media pieza vivía
// en `player.css` (EXCLUIDO como chrome) y media en `live.css` (GAME), así que
// este mismo ratchet la clasificaba de dos maneras a la vez.
const GAME = ['ballsort', 'crossword', 'diagram', 'globos', 'match', 'math', 'memory', 'wheel',
  'opcion', 'question-live', 'textCorrection', 'vs', 'teams', 'wordsearch', 'live'];
// Chrome/paletas explícitamente EXCLUIDOS del ratchet (no son "el juego").
// `live` SALIÓ de esta lista en v1.51.423. Estaba clasificado como chrome y
// dentro vive el JUEGO: `.ww-opt-grid` son las opciones de respuesta que la
// clase entera lee, y llevaban `font-size: 1.5rem` FIJO — 24 px lo mismo en un
// móvil que en una pizarra 4K. El ratchet no lo veía por estar excluido; lo cazó
// la medición de legibilidad de §29. Una lista de exclusiones es una lista de
// sitios donde la ley no mira: cada entrada tiene que ser chrome DE VERDAD.
const EXCLUDED = ['backgrounds', 'editor', 'home', 'player', 'scaffold', 'skins', 'soloAnim', 'theme', 'touch'];

// Colores skin-independientes POR DISEÑO: no necesitan token.
//  · neutros (texto sobre superficies de color)
//  · paleta semántica de acierto/error (verde/rojo) — convención de toda la app
const ALLOW_COLORS = new Set(['#fff', '#ffffff', '#000', '#000000',
  '#16a34a', '#198754', '#22c55e', '#15803d',
  '#ef4444', '#dc3545', '#dc2626', '#b91c1c', '#e11d48']);

// Selectores de FORMULARIO (editor/diálogo), no el juego → el px está permitido.
const EDITOR_SEL = /edit|\.pcal|\.ws-ed|\.mem-|-ed\b|\.dg-edit/i;

const blank = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

// Recorre el CSS por bloques {sel { decls }} rastreando el selector para saltar
// los scopes de editor. Devuelve { fonts:Set, colors:Set } de VIOLACIONES.
// El TERCER argumento de un `clamp(a, b, c)` — el techo — o null si no lo es.
// Se parte a mano respetando paréntesis: `clamp(1rem, calc(2cqmin + 1px), 2rem)`
// tiene comas dentro que un `split(',')` destrozaría.
function topeDeClamp(v) {
  const m = /clamp\s*\(/.exec(v);
  if (!m) return null;
  let prof = 0, arg = '', args = [];
  for (let i = m.index + m[0].length; i < v.length; i++) {
    const c = v[i];
    if (c === '(') prof++;
    else if (c === ')') { if (!prof) break; prof--; }
    if (c === ',' && !prof) { args.push(arg); arg = ''; continue; }
    arg += c;
  }
  args.push(arg);
  return args.length === 3 ? args[2].trim() : null;
}
// ¿Es un valor CONGELADO? `em` no cuenta: escala con el texto del elemento.
const esLiteral = (v) => /\d(px|rem)\b/.test(v) && !/cq|vw|vh|vmin|vmax|%/.test(v);

function scan(css) {
  const fonts = new Set(), colors = new Set(), ceilings = new Set();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim(), body = m[2];
    if (EDITOR_SEL.test(sel)) continue;           // formulario: px permitido
    if (/\.vs-skin-/.test(sel)) continue;          // paleta propia de un skin
    // font-size congelado
    for (const d of body.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
      const v = d[1].trim();
      // UN `clamp()` CON TERCER ARGUMENTO LITERAL ES UN TECHO DISFRAZADO DE PISO,
      // y era el agujero por el que se colaba lo que esta ley existe para cazar.
      // El escaneo dejaba pasar cualquier valor con una unidad responsiva EN
      // CUALQUIER POSICIÓN, así que `clamp(.45rem, 2cqmin, 1.05rem)` pasaba por
      // «piso responsivo» — y era el tope que congelaba las letras de la Sopa en
      // 16.8px mientras la rejilla crecía a 1316px en una pizarra 4K (v1.51.601).
      // Un `max()` sí es un piso de verdad; en un `clamp` hay que mirar el TERCER
      // argumento, que es donde vive el techo.
      const techo = topeDeClamp(v);
      if (techo) { if (esLiteral(techo)) fonts.add(v.replace(/\s+/g, ' ')); continue; }
      if (/cq|vw|vh|vmin|vmax|%/.test(v)) continue;                       // responsivo
      if (/\bvar\(/.test(v)) continue;                                    // derivado de var
      if (/\d(px|rem|em)\b/.test(v)) fonts.add(v.replace(/\s+/g, ' '));
    }
    // TECHOS DE TAMAÑO. §3 lo prohíbe desde siempre («nada con tamaño fijo que
    // congele el crecimiento»), pero la ley solo vigilaba tipografía y color: el
    // `max-width: 580px` de la rejilla de la Sopa dejaba la actividad clavada
    // con hueco para 718px, y ninguna red lo vio. Se congela lo que hay hoy y no
    // puede crecer — el mismo trato que la deuda de fuentes y colores.
    for (const d of body.matchAll(/(?:^|[;\s])(max-width|max-height|width|height)\s*:\s*([^;}]+)/g)) {
      const v = d[2].trim();
      // OJO: aquí NO se salta `var(`. `max-width: var(--x, 580px)` es el patrón
      // habitual del repo y escondía exactamente el techo que esta red vino a
      // cazar — el token puede no estar definido y entonces manda el literal. Un
      // `var()` SIN respaldo en px/rem se cae solo unas líneas más abajo.
      // `max(12px, Xcqmin)` es un PISO de legibilidad, que §3 permite expresamente.
      if (/max\s*\(/.test(v) && !/clamp\s*\(/.test(v) && /cq|vw|vh|vmin|vmax|%/.test(v)) continue;
      // `calc(100vh - 70px)` tampoco: es una RESTA sobre una medida del viewport
      // (descontar una barra), no un tope. Un techo LIMITA; esto acompaña.
      if (/calc\s*\(/.test(v) && !/clamp\s*\(|min\s*\(/.test(v) && /cq|vw|vh|vmin|vmax|%/.test(v)) continue;
      // `em` NO congela: escala con el propio texto del elemento (iconos).
      if (!/\d(px|rem)\b/.test(v)) continue;
      const tope = topeDeClamp(v);
      if (tope && !esLiteral(tope)) continue;                // clamp con techo responsivo
      ceilings.add(`${d[1]}:${v.replace(/\s+/g, ' ')}`);
    }
    // color pintable hardcodeado (no token)
    for (const d of body.matchAll(/(?:^|[;\s])(color|background|background-color)\s*:\s*([^;}]+)/g)) {
      const v = d[2];
      if (/var\(/.test(v)) continue;
      for (const hex of (v.match(/#[0-9a-fA-F]{3,8}\b/g) || [])) {
        if (ALLOW_COLORS.has(hex.toLowerCase())) continue;
        colors.add(`${d[1]}:${hex.toLowerCase()}`);
      }
    }
  }
  return { fonts, colors, ceilings };
}

// ── BASELINE: deuda registrada, congelada. No agregar entradas nuevas: si una
// actividad nueva falla, arréglala (relativo + token), no la metas aquí. Al
// arreglar deuda existente, borra su entrada. ────────────────────────────────
const BASELINE = {
  ballsort:      { fonts: ['.82rem', '.9rem'], colors: ['background:#2a3140', 'color:#ffd34d'] },
  crossword:     { fonts: [], colors: [] },
  match:         { fonts: ['.82rem', '.9rem'], colors: ['background:#6366f1', 'background:#94a3b8'] },
  memory:        { fonts: ['1.4rem', '1rem'], colors: ['background:#d1fae5', 'color:#065f46'] },
  'question-live': { fonts: ['1.3rem', '1.8rem'], colors: [] },
  // ENTRÓ al escáner en v1.51.423 (estaba excluido como "chrome" y dentro vivía
  // el juego). Lo GORDO ya está arreglado: las opciones de respuesta
  // (`.ww-opt-grid`) escalan con el marco y su contraste llega a 6,2:1. Esto
  // que queda es el podio y la clasificación —pantallas de remate, no de
  // jugar—, congelado como deuda: el ratchet solo encoge.
  live:          { fonts: ['.85em'],
                   colors: ['background:#fbbf24', 'background:#d97706', 'color:#141c2e',
                            'color:#5b6472', 'background:#243149', 'color:#e5edf9',
                            'background:#2d3d59', 'background:#f5c518', 'background:#ffd534'] },
  textCorrection: { fonts: ['1.1rem'], colors: ['color:#0f5132', 'color:#842029'] },
  vs:            { fonts: ['.95rem', '1.05rem', '1.35rem', '1.7rem', '1rem', '2.6rem', '4.6rem'],
                   colors: ['background:#f8f9fa', 'color:#0d6efd', 'color:#2563eb', 'color:#6c757d', 'color:#f9c700'] },
  teams:         { fonts: ['1.1rem', '1.2rem', '1.4rem', '1rem'],
                   colors: ['color:#6c757d'] },
  wordsearch:    { fonts: ['.72rem', '.85em'],
                   colors: ['color:#4f46e5', 'color:#6c757d'] },
};

// ── TECHOS, congelados aparte (v1.51.602) ────────────────────────────────────
// Dos agujeros que la ley §3 prohibía desde siempre y esta red no miraba:
//   · `clamps` — un `clamp(a, b, LITERAL)` es un TECHO disfrazado de piso. El
//     escaneo dejaba pasar cualquier valor con una unidad responsiva en
//     CUALQUIER posición, así que los 25 de aquí abajo eran invisibles. Uno de
//     ellos —`clamp(.45rem, 2cqmin, 1.05rem)` en la Sopa— congelaba las letras
//     en 16.8px mientras la rejilla crecía a 1316px en una pizarra 4K.
//   · `ceilings` — el `max-width: 580px` de esa misma rejilla la dejaba clavada
//     con hueco para 718px. La ley solo vigilaba tipografía y color.
// Se aplazó dos veces con «destaparía media app». Medido: son 61 entradas, no
// media app — y entre ellas están cuatro rejillas con el MISMO defecto que la
// Sopa (memory 720px, question-live 720/480/460, ballsort 1100px). Ninguna se
// arregla aquí: cada una cambia píxeles y necesita su propia medición. Se
// CONGELAN para que dejen de ser invisibles y solo puedan bajar.
//
// TERCER agujero (v1.51.606): al dejar de saltar `var(` —el motivo está donde se
// quitó el `continue`, en `scan()`— once techos más salieron a la luz; se
// congelan igual que los otros.
const TECHOS = {
  ballsort: { ceilings: ['height:12px', 'height:40px', 'height:var(--bs-ball-size, 36px)', 'max-width:1100px', 'width:12px', 'width:16px', 'width:40px', 'width:var(--bs-ball-size, 36px)', 'width:var(--bs-tube-w, 48px)'] },
  crossword: { clamps: ['clamp(.63rem, 1.5cqw, .78rem)', 'clamp(.68rem, 1.7cqw, .9rem)'], ceilings: ['height:var(--cw-cell, 36px)', 'width:clamp(130px, 24cqw, 240px)', 'width:var(--cw-cell, 36px)'] },
  diagram: { ceilings: ['height:20px', 'width:20px'] },
  match: { ceilings: ['height:20px', 'height:54px', 'width:20px'] },
  memory: { ceilings: ['height:90px', 'max-width:720px'] },
  'question-live': { ceilings: ['height:60px', 'height:90px', 'max-width:480px', 'max-width:720px', 'width:min(100%, 460px)'] },
  'textCorrection': { clamps: ['clamp(.68rem, 2.1cqmin, 1.05rem)', 'clamp(.7rem, 2.3cqmin, 1.4rem)', 'clamp(.8rem, 2.1cqmin, 1.3rem)', 'clamp(.9rem, 2.6cqmin, 1.7rem)', 'clamp(1.5rem, 4.5vw, 2.6rem)'] },
  vs: { clamps: ['clamp(.85rem, 9cqw, 1.4rem)', 'clamp(.7rem, 2.4cqw, 1rem)', 'clamp(.85rem, 4cqw, 1.3rem)', 'clamp(.8rem, 1.6cqw, 1.15rem)', 'clamp(1.1rem, 2.4cqw, 1.8rem)', 'clamp(1rem, 2cqw, 1.6rem)', 'clamp(2rem, 7vw, 3.6rem)', 'var(--vss-label-size, clamp(.5rem, 1.3cqh, 1.3rem))', 'var(--vss-name-size, clamp(.78rem, 2.2cqh, 2.4rem))', 'var(--vss-score-size, clamp(1.5rem, 3.8cqh, 4.2rem))'], ceilings: ['height:2.2rem', 'height:4px', 'height:52px', 'height:76px', 'height:clamp(90px, 32cqh, 280px)', 'height:var(--vss-alto, clamp(46px, 7.5cqh, 132px))', 'height:var(--vss-av, clamp(2rem, 5cqh, 5.5rem))', 'height:var(--vss-badge, 50px)', 'max-width:18rem', 'max-width:420px', 'max-width:560px', 'max-width:640px', 'width:2.2rem', 'width:52px', 'width:var(--vss-av, clamp(2rem, 5cqh, 5.5rem))', 'width:var(--vss-badge, 50px)', 'width:var(--vss-mid, 68px)'] },
  teams: { clamps: ['clamp(.8rem, 4cqmin, 1.3rem)', 'clamp(.9rem, 1.8vw, 1.4rem)', 'clamp(1.1rem, 6cqmin, 2.2rem)', 'clamp(1rem, 5cqmin, 1.8rem)'], ceilings: ['max-width:340px', 'max-width:900px'] },
  wordsearch: { clamps: ['clamp(.72rem, 1.4cqw, .88rem)', 'clamp(1.2rem, 4cqmin, 2rem)', 'clamp(1rem, 3cqmin, 1.4rem)'], ceilings: ['max-width:150px'] },
  live: { clamps: ['clamp(1.5rem, 7vw, 2.5rem)', 'clamp(2rem, 8vw, 5rem)'], ceilings: ['height:120px', 'height:160px', 'height:220px'] },
};

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const newViolations = [];

// …y en el otro sentido: una entrada del BASELINE cuyo defecto YA NO está en el
// CSS es HOLGURA — deuda pagada que sigue apuntada, y por cuyo hueco cabe una
// regresión nueva del mismo valor sin que el ratchet la vea. Este es el mismo
// anti-inflado que ya tenía `citasFuente` y aquí faltaba (lo encontró la
// primera pasada de /auditoria, 2026-08-28).
const holguras = [];
for (const g of GAME) {
  const css = blank(readFileSync(join(STYLES, `${g}.css`), 'utf8'));
  const { fonts, colors, ceilings } = scan(css);
  const base = BASELINE[g] || { fonts: [], colors: [] };
  const techos = TECHOS[g] || {};
  const baseFonts = new Set([...base.fonts, ...(techos.clamps || [])]);
  const baseColors = new Set(base.colors);
  const baseTechos = new Set(techos.ceilings || []);
  for (const v of fonts) if (!baseFonts.has(v)) newViolations.push(`${g}.css: font-size fija sin token responsivo → "${v}"`);
  for (const v of colors) if (!baseColors.has(v)) newViolations.push(`${g}.css: color pintable hardcodeado (usa var(--ww-*)) → "${v}"`);
  for (const v of ceilings) if (!baseTechos.has(v)) newViolations.push(`${g}.css: TECHO fijo que congela el crecimiento (§3) → "${v}"`);
  for (const v of base.fonts) if (![...fonts].includes(v)) holguras.push(`${g}: fonts "${v}"`);
  for (const v of base.colors) if (![...colors].includes(v)) holguras.push(`${g}: colors "${v}"`);
}
assert.deepStrictEqual(holguras, [],
  `HOLGURA en el BASELINE (la deuda ya se pagó: borra su entrada para que el ratchet apriete):\n  ${holguras.join('\n  ')}`);

// LOS EJEMPLARES deben quedar SIEMPRE limpios — y tienen que tener algo que
// mirar: `quiz.css` estaba en esta lista y se quedó SIN REGLAS al mudarse la
// opción a `opcion.css` (v1.51.599). Una aserción sobre un fichero vacío no
// puede fallar: llevaba una versión dando verde gratis mientras anunciaba que
// vigilaba al ejemplar. Ahora el ejemplar es el que de verdad enseña algo, y se
// comprueba que TIENE reglas antes de celebrar que están limpias.
for (const clean of ['math', 'opcion']) {
  const css = blank(readFileSync(join(STYLES, `${clean}.css`), 'utf8'));
  const { fonts, colors, ceilings } = scan(css);
  assert.ok((css.match(/\{/g) || []).length >= 3,
    `${clean}.css es el ejemplar y está vacío: una aserción sobre la nada no vigila nada`);
  assert.strictEqual(fonts.size + colors.size + ceilings.size, 0,
    `${clean}.css debe seguir 100% relativo + tokenizado, sin techos (ejemplar)`);
}
ok('math.css y opcion.css siguen limpios y con contenido (0 fija / 0 color / 0 techo)');

// ── THEMES en el escáner de px (§3, R3) ──────────────────────────────────────
// Los skins definen su PALETA (colores propios, por diseño: el escáner de arriba
// salta `.vs-skin-*` a propósito), pero un `font-size` FIJO congela el escalado
// igual que en cualquier CSS de juego — la pizarra 4K y el móvil 9:16 no
// perdonan según quién pinte. Aquí se escanean SOLO los tamaños, con su propio
// baseline congelado (mismo contrato ratchet: solo encoge, nunca crece).
const THEME_BASELINE = {
  arcade:   ['.45rem', '.5em', '.5rem'],
  'tv-show': ['1.05rem', '1.4rem'],
};
{
  const themesDir = join(STYLES, '..', 'themes');
  for (const d of readdirSync(themesDir, { withFileTypes: true }).filter(x => x.isDirectory())) {
    const css = blank(readFileSync(join(themesDir, d.name, 'skin.css'), 'utf8'));
    const fonts = new Set();
    const re = /([^{}]+)\{([^{}]*)\}/g; let m;
    while ((m = re.exec(css))) {
      for (const decl of m[2].matchAll(/font-size\s*:\s*([^;}]+)/g)) {
        const v = decl[1].trim();
        if (/cq|vw|vh|vmin|vmax|%/.test(v)) continue;
        if (/(max|clamp)\s*\(/.test(v) && /cq|vw|vh|vmin|%/.test(v)) continue;
        if (/\bvar\(/.test(v)) continue;
        if (/\d(px|rem|em)\b/.test(v)) fonts.add(v.replace(/\s+/g, ' '));
      }
    }
    const base = new Set(THEME_BASELINE[d.name] || []);
    for (const v of fonts) if (!base.has(v)) {
      newViolations.push(`themes/${d.name}/skin.css: font-size fija nueva → "${v}" (un skin cambia TOKENS, no congela tamaños)`);
    }
  }
  ok(`themes en el escáner de px (${Object.keys(THEME_BASELINE).length} baselines congelados, solo encogen)`);
}

// COMPLETITUD: todo styles/*.css debe estar CLASIFICADO — en GAME (se escanea)
// o en EXCLUDED (chrome/paleta, no juego). Sin esto, el CSS de una actividad
// NUEVA escaparía del ratchet en silencio ("una actividad nueva debe nacer
// limpia" solo se cumple si su CSS entra al escáner).
{
  const all = readdirSync(STYLES).filter(f => f.endsWith('.css')).map(f => f.replace(/\.css$/, ''));
  const unclassified = all.filter(n => !GAME.includes(n) && !EXCLUDED.includes(n));
  assert.deepStrictEqual(unclassified, [],
    `styles/*.css sin clasificar: ${unclassified.join(', ')} — añádelo a GAME (CSS de juego, ` +
    `se escanea) o a EXCLUDED (chrome/paleta) en tests/styles.test.mjs`);
  const ghosts = [...GAME, ...EXCLUDED].filter(n => !all.includes(n));
  assert.deepStrictEqual(ghosts, [], `listas apuntan a CSS inexistente: ${ghosts.join(', ')}`);
  ok(`completitud: ${all.length} CSS clasificados (${GAME.length} juego · ${EXCLUDED.length} excluidos)`);
}

// THEMES (ley de estilo §3): todo `stylesheet:` declarado en core/skins.js debe
// existir en disco (si no, el skin carga un 404 silencioso), y todo
// themes/*/skin.css debe estar REFERENCIADO por un registerSkin — un skin
// huérfano en disco es deuda declarada, no un archivo fantasma sin dueño.
{
  const ROOT = join(STYLES, '..');
  const skinsSrc = readFileSync(join(ROOT, 'core/skins.js'), 'utf8');
  const declared = [...skinsSrc.matchAll(/stylesheet:\s*'([^']+)'/g)].map(m => m[1]);
  for (const p of declared) {
    assert.ok(statSync(join(ROOT, p), { throwIfNoEntry: false }), `core/skins.js declara stylesheet inexistente: ${p}`);
  }
  // Huérfanos CONOCIDOS: vacío desde v1.51.415 — `themes/colegios/skin.css`
  // llevaba en disco sin ningún `registerSkin` que lo cargara (135 líneas que
  // NADIE podía elegir) y se BORRÓ en la caza de tumores. La lista es ratchet:
  // solo encoge. Un skin nuevo sin registrar rompe CI aquí.
  const KNOWN_ORPHANS = [];
  const themeFiles = readdirSync(join(ROOT, 'themes'), { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => `themes/${d.name}/skin.css`)
    .filter(p => statSync(join(ROOT, p), { throwIfNoEntry: false }));
  const orphans = themeFiles.filter(p => !declared.includes(p) && !KNOWN_ORPHANS.includes(p));
  assert.deepStrictEqual(orphans, [],
    `themes/*/skin.css sin registerSkin que lo use: ${orphans.join(', ')} — regístralo en core/skins.js o documenta la deuda`);
  ok(`themes: ${declared.length} stylesheet(s) declarados existen · sin huérfanos nuevos (${KNOWN_ORPHANS.length} deuda conocida)`);
}

// ── EL VEREDICTO GANA AL SKIN (hallazgo del compañero, 2026-08-09) ───────────
// El player ponía btn-success/btn-danger al responder, pero los fondos por
// forma y los skins (que se cargan DESPUÉS) los pisaban por especificidad:
// «al fallar no se pone rojo». Regla ejecutable, por DESCUBRIMIENTO: la
// especificidad (nº de clases/pseudoclases) de las reglas de veredicto debe
// SUPERAR la de todo selector que pinte fondo sobre `.ww-shape-N`, esté donde
// esté (styles/ y themes/*/skin.css) — un skin nuevo no puede recuperar el bug.
{
  const REPO = join(STYLES, '..');
  const clsCount = (sel) => (sel.match(/\.[\w-]+|:[\w-]+/g) || []).length;
  const shapeFiles = [
    ...readdirSync(STYLES).filter(f => f.endsWith('.css')).map(f => join(STYLES, f)),
    ...readdirSync(join(REPO, 'themes'), { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => join(REPO, 'themes', d.name, 'skin.css')),
  ];
  // Por DESCUBRIMIENTO en los mismos ficheros: reglas de VEREDICTO (verde/rojo
  // sobre opciones) y reglas de FORMA — estén donde estén hoy o mañana.
  const verdicts = [], shapes = [];
  for (const f of shapeFiles) {
    let css; try { css = blank(readFileSync(f, 'utf8')); } catch { continue; }
    for (const m of css.matchAll(/([^{}]+)\{[^}]*background[^}]*\}/g)) {
      for (const sel of m[1].split(',').map(s => s.trim())) {
        const esOpcion = /\.ww-shape-\d|\.ww-opt-grid|\.ww-options|\.ww-opt\b|\.rq-opt\b/.test(sel);
        if (!esOpcion) continue;
        (/\.btn-(success|danger)\b/.test(sel) ? verdicts : shapes)
          .push({ f: f.split('/').slice(-2).join('/'), sel, n: clsCount(sel) });
      }
    }
  }
  // Individual (.ww-opt) y rondas (.rq-opt) tienen que estar CUBIERTOS los dos:
  // el arreglo de v1.51.431 solo cubría el player y en carrera seguía sin rojo.
  assert.ok(verdicts.some(v => /\.ww-opt\b/.test(v.sel)), 'veredicto declarado para el player Individual (.ww-opt)');
  assert.ok(verdicts.some(v => /\.rq-opt\b/.test(v.sel)), 'veredicto declarado para las rondas (.rq-opt)');
  const verdictMin = Math.min(...verdicts.map(v => v.n));
  const losers = shapes.filter(s => s.n >= verdictMin)
    .map(s => `${s.f}: «${s.sel}» (${s.n} ≥ ${verdictMin})`);
  assert.deepStrictEqual(losers, [],
    `fondos de forma que PISAN el verde/rojo del veredicto (sube la especificidad del veredicto):\n  ${losers.join('\n  ')}`);
  ok(`veredicto (verde/rojo) por encima de todo fondo de forma/skin, en player Y rondas (especificidad ${verdictMin})`);

  // ── LA TINTA VIAJA CON LA FORMA (§3c · ronda del compañero, prueba 10) ─────
  // Mismo escaneo, otra propiedad. Un selector que pinta una OPCIÓN no puede
  // fijar `color` a un literal: la tinta la manda `--ww-shape-N-fg`, que el tema
  // ya declara y que CI mide en `tests/contrast.test.mjs`.
  // Por qué es DESCUBRIMIENTO y no una lista: el mismo `color:#fff` apareció
  // TRES veces —página de tv-show (2,2:1), duelo de tv-show (1,7:1) y duelo de
  // arcade (1,4:1, el peor del repo)— y arreglar la primera dejó vivas las otras
  // dos. Arcade además declaraba tinta OSCURA en sus cuatro formas: su CSS
  // pisaba su propia respuesta. Ninguna red lo veía: la tortura solo juega el
  // modo Individual, así que el duelo quedaba fuera de su cono.
  const tintasFijas = [];
  for (const f of shapeFiles) {
    let css; try { css = blank(readFileSync(f, 'utf8')); } catch { continue; }
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const cuerpo = m[2];
      // `color:` propio, no `background-color` ni `border-color`.
      const decl = cuerpo.match(/(^|[;{\s])color\s*:\s*([^;}]+)/);
      if (!decl) continue;
      const valor = decl[2].trim();
      // Vale cualquier token del tema (`--ww-shape-N-fg` en las fichas de color,
      // `--ww-card-fg` en la opción lisa): lo que se persigue es el LITERAL.
      if (/var\(\s*--ww-/.test(valor) || valor === 'inherit') continue;
      for (const sel of m[1].split(',').map(s => s.trim())) {
        // Solo lo que PINTA una opción: `.ww-q`/`.ww-phead` son texto sobre el
        // lienzo (los rige la tinta del fondo), no fichas de color.
        if (!/\.ww-shape-\d|\.ww-opt\b|\.rq-opt\b/.test(sel)) continue;
        // El VEREDICTO es la excepción declarada: verde/rojo con letra blanca es
        // su convención y ya tiene su propia regla ejecutable (arriba).
        if (/\.btn-(success|danger)\b/.test(sel)) continue;
        tintasFijas.push(`${f.split('/').slice(-2).join('/')}: «${sel}» → color: ${valor}`);
      }
    }
  }
  assert.deepStrictEqual(tintasFijas, [],
    'opciones con la tinta fija (usa var(--ww-shape-N-fg), que el tema declara y CI mide):\n  '
    + tintasFijas.join('\n  '));
  ok('ninguna opción fija su tinta a un literal: la trae el token del tema (escaneo de styles/ + themes/)');
}

// ── LA IMAGEN NO DESBORDA SIN MARCO (§3 · ronda del 2026-08-11, prueba 12) ───
// El estándar de maquetación vive bajo `.ww-play-page .ww-player-frame`, que solo
// monta la página del profe: en TAREA y EN VIVO la plantilla va directa a `#app`.
// Con el tope de la imagen únicamente dentro del marco, una foto de 1280 px
// empujaba la tarea a 1288 px en un iPhone de 390 (medido: el alumno veía «una
// esquinita»). Aquí se exige que EXISTA un tope fuera del marco; el ancho real
// lo mide la sonda de navegador, esto impide que la regla se pierda en un
// refactor sin que nadie lo note hasta la clase siguiente.
{
  const css = blank(readFileSync(join(STYLES, 'player.css'), 'utf8'));
  const topes = [];
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/max-width\s*:\s*100%/.test(m[2])) continue;
    for (const sel of m[1].split(',').map(s => s.trim())) {
      if (/\bimg\b/.test(sel)) topes.push(sel);
    }
  }
  assert.ok(topes.length, 'player.css debe topar el ancho de las imágenes del juego');
  const sinMarco = topes.filter(s => !/ww-player-frame|ww-play-page/.test(s));
  assert.ok(sinMarco.length,
    `el tope de la imagen SOLO existe dentro del marco (${topes.join(' · ')}) — en tarea y en vivo no hay marco y la foto desborda`);
  // CONTRA-PRUEBA: la comprobación distingue de verdad marco de no-marco.
  assert.strictEqual(
    ['.ww-play-page .ww-player-frame .ww-q-media img'].filter(s => !/ww-player-frame|ww-play-page/.test(s)).length, 0,
    'un tope escrito solo dentro del marco no contaría como tope global');
  ok(`la imagen del juego tiene tope fuera del marco (${sinMarco.length} regla(s)): tarea y en vivo no desbordan`);
}

if (newViolations.length) {
  console.error('\n✗ Nuevas violaciones de estilo de actividad:\n  - ' + newViolations.join('\n  - '));
  console.error('\n  Regla (CLAUDE.md): el PLAYER no lleva tamaños fijos (usa cq*/% o piso max()),');
  console.error('  y los colores pintables van por var(--ww-*) para que los skins recoloreen.');
  console.error('  Ver docs/estilos-de-actividad.md. NO agregues la violación al BASELINE.');
}
assert.strictEqual(newViolations.length, 0, `${newViolations.length} violación(es) nueva(s) de estilo — ver arriba`);
ok('sin violaciones nuevas sobre el baseline (ratchet de deuda de estilos)');

console.log(`\nstyles.test: ${passed} checks passed`);
