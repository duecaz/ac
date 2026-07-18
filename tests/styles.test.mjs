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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync } from 'node:fs';

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles');

// CSS de juego (player). Se excluyen: theme/skins/backgrounds (definen paletas),
// editor/player-frame/touch/soloAnim/live (chrome, no el ejercicio).
const GAME = ['ballsort', 'crossword', 'diagram', 'globos', 'match', 'math', 'memory',
  'question-live', 'quiz', 'textCorrection', 'vs', 'teams', 'wordsearch'];
// Chrome/paletas explícitamente EXCLUIDOS del ratchet (no son "el juego").
const EXCLUDED = ['backgrounds', 'editor', 'live', 'player', 'scaffold', 'skins', 'soloAnim', 'theme', 'touch'];

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

if (newViolations.length) {
  console.error('\n✗ Nuevas violaciones de estilo de actividad:\n  - ' + newViolations.join('\n  - '));
  console.error('\n  Regla (CLAUDE.md): el PLAYER no lleva tamaños fijos (usa cq*/% o piso max()),');
  console.error('  y los colores pintables van por var(--ww-*) para que los skins recoloreen.');
  console.error('  Ver docs/estilos-de-actividad.md. NO agregues la violación al BASELINE.');
}
assert.strictEqual(newViolations.length, 0, `${newViolations.length} violación(es) nueva(s) de estilo — ver arriba`);
ok('sin violaciones nuevas sobre el baseline (ratchet de deuda de estilos)');

console.log(`\nstyles.test: ${passed} checks passed`);
