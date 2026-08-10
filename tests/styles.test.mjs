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
// actividad NUEVA (archivo sin baseline) debe nacer limpia. math.css y quiz.css
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
const GAME = ['ballsort', 'crossword', 'diagram', 'globos', 'match', 'math', 'memory',
  'question-live', 'quiz', 'textCorrection', 'vs', 'teams', 'wordsearch', 'live'];
// Chrome/paletas explícitamente EXCLUIDOS del ratchet (no son "el juego").
// `live` SALIÓ de esta lista en v1.51.423. Estaba clasificado como chrome y
// dentro vive el JUEGO: `.ww-kahoot-grid` son las opciones de respuesta que la
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
function scan(css) {
  const fonts = new Set(), colors = new Set();
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim(), body = m[2];
    if (EDITOR_SEL.test(sel)) continue;           // formulario: px permitido
    if (/\.vs-skin-/.test(sel)) continue;          // paleta propia de un skin
    // font-size congelado
    for (const d of body.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
      const v = d[1].trim();
      if (/cq|vw|vh|vmin|vmax|%/.test(v)) continue;                       // responsivo
      if (/(max|clamp)\s*\(/.test(v) && /cq|vw|vh|vmin|%/.test(v)) continue; // piso responsivo
      if (/\bvar\(/.test(v)) continue;                                    // derivado de var
      if (/\d(px|rem|em)\b/.test(v)) fonts.add(v.replace(/\s+/g, ' '));
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
  return { fonts, colors };
}

// ── BASELINE: deuda registrada, congelada. No agregar entradas nuevas: si una
// actividad nueva falla, arréglala (relativo + token), no la metas aquí. Al
// arreglar deuda existente, borra su entrada. ────────────────────────────────
const BASELINE = {
  ballsort:      { fonts: ['.82rem', '.9rem'], colors: ['background:#2a3140', 'color:#ffd34d'] },
  crossword:     { fonts: ['.78rem'], colors: ['color:#94a3b8'] },
  match:         { fonts: ['.82rem', '.9rem'], colors: ['background:#6366f1', 'background:#94a3b8'] },
  memory:        { fonts: ['1.4rem', '1rem'], colors: ['background:#d1fae5', 'color:#065f46'] },
  'question-live': { fonts: ['1.3rem', '1.8rem'], colors: [] },
  // ENTRÓ al escáner en v1.51.423 (estaba excluido como "chrome" y dentro vivía
  // el juego). Lo GORDO ya está arreglado: las opciones de respuesta
  // (`.ww-kahoot-grid`) escalan con el marco y su contraste llega a 6,2:1. Esto
  // que queda es el podio y la clasificación —pantallas de remate, no de
  // jugar—, congelado como deuda: el ratchet solo encoge.
  live:          { fonts: ['.85em'],
                   colors: ['background:#fbbf24', 'background:#d97706', 'color:#141c2e',
                            'color:#5b6472', 'background:#243149', 'color:#e5edf9',
                            'background:#2d3d59', 'background:#f5c518', 'background:#ffd534'] },
  textCorrection: { fonts: ['1.1rem'], colors: ['background:#fffdf5', 'color:#0f5132', 'color:#1f2937', 'color:#842029'] },
  vs:            { fonts: ['.5rem', '.72rem', '.95rem', '.9rem', '1.05rem', '1.35rem', '1.7rem', '1rem', '2.6rem', '4.6rem'],
                   colors: ['background:#f8f9fa', 'color:#0d6efd', 'color:#2563eb', 'color:#6c757d', 'color:#f9c700'] },
  teams:         { fonts: ['1.1rem', '1.2rem', '1.4rem', '1rem'],
                   colors: ['background:#cfe2ff', 'background:#d1e7dd', 'background:#f1f3f5', 'color:#6c757d'] },
  wordsearch:    { fonts: ['.72rem', '.7rem', '.85em', '1rem'],
                   colors: ['background:#f8f9fa', 'color:#4f46e5', 'color:#6c757d', 'color:#adb5bd'] },
};

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };
const newViolations = [];

for (const g of GAME) {
  const css = blank(readFileSync(join(STYLES, `${g}.css`), 'utf8'));
  const { fonts, colors } = scan(css);
  const base = BASELINE[g] || { fonts: [], colors: [] };
  const baseFonts = new Set(base.fonts), baseColors = new Set(base.colors);
  for (const v of fonts) if (!baseFonts.has(v)) newViolations.push(`${g}.css: font-size fija sin token responsivo → "${v}"`);
  for (const v of colors) if (!baseColors.has(v)) newViolations.push(`${g}.css: color pintable hardcodeado (usa var(--ww-*)) → "${v}"`);
}

// math.css / quiz.css son los ejemplares: deben quedar SIEMPRE limpios.
for (const clean of ['math', 'quiz']) {
  const { fonts, colors } = scan(blank(readFileSync(join(STYLES, `${clean}.css`), 'utf8')));
  assert.strictEqual(fonts.size + colors.size, 0, `${clean}.css debe seguir 100% relativo + tokenizado (ejemplar)`);
}
ok('math.css y quiz.css siguen limpios (0 fija / 0 color hardcodeado)');

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
        const esOpcion = /\.ww-shape-\d|\.ww-kahoot-grid|\.ww-options|\.ww-opt\b|\.rq-opt\b/.test(sel);
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
