// INVENTARIO DE BOOTSTRAP — la especificación ejecutable del futuro CSS propio.
//
// Decisión del usuario (docs/leyes.md §3): sustituir Bootstrap (CDN, 7 tags en
// los HTML) por un CSS centralizado nuestro con SOLO lo que usamos. Este script
// responde la pregunta previa a escribir una sola línea de ese CSS: ¿qué clases
// de Bootstrap usa la app DE VERDAD, y cuántas veces? Correrlo de nuevo tras
// cada limpieza dice cuánto falta.
//
//   node tools/css-inventory.mjs           # resumen por familia + top de clases
//   node tools/css-inventory.mjs --all     # todas las clases con su conteo
//
// Cuenta apariciones en class="..." (HTML/JS con plantillas literales) sobre
// views/, core/, templates/ y los 4 HTML. Lo que NO es de Bootstrap (ww-*, vs-*,
// acard-*, etc.) se ignora: eso ya es nuestro.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const showAll = process.argv.includes('--all');

// Prefijos/clases de Bootstrap que la app podría usar (lo que el inventario
// reconoce; una clase fuera de esto y de nuestros prefijos sale como "¿?").
const BS_FAMILIES = [
  // [familia, regex de la clase completa]
  ['grid',     /^(container(-fluid)?|row|col(-\d+|-(sm|md|lg|xl|xxl)(-\d+|-auto)?)?|g-\d|gx-\d|gy-\d)$/],
  ['botones',  /^(btn|btn-(sm|lg|close|link)|btn-(outline-)?(primary|secondary|success|danger|warning|info|light|dark))$/],
  ['badge',    /^(badge)$/],
  ['alert',    /^(alert|alert-(primary|secondary|success|danger|warning|info|light|dark)|alert-heading)$/],
  ['modal',    /^(modal|modal-(dialog|content|header|body|footer|title|fade|dialog-centered)|fade|show)$/],
  ['forms',    /^(form-(control|select|label|check|check-input|check-label|text|range)|input-group|input-group-text|form-control-(sm|lg)|form-select-(sm|lg))$/],
  ['tabla',    /^(table|table-(striped|hover|sm|bordered|responsive|light|dark)|thead|list-group|list-group-item|align-middle)$/],
  ['spinner',  /^(spinner-border|spinner-border-sm|spinner-grow)$/],
  ['nav',      /^(nav|navbar|nav-(link|item|tabs|pills)|navbar-(brand|nav|toggler))$/],
  ['card',     /^(card|card-(body|header|footer|title|text))$/],
  ['texto',    /^(text-(start|center|end|muted|primary|secondary|success|danger|warning|info|light|dark|white|truncate|nowrap|break)|fw-(bold|semibold|normal|light)|fst-italic|small|lead|display-[1-6]|h[1-6]|fs-[1-6])$/],
  ['spacing',  /^(m|p)(t|b|s|e|x|y)?-(0|1|2|3|4|5|auto)$/],
  ['flex',     /^(d-(flex|inline-flex|block|inline-block|none|grid)|d-(sm|md|lg|xl)-(flex|block|none)|flex-(row|column|wrap|nowrap|fill|grow-[01]|shrink-[01]|column-reverse)|justify-content-(start|center|end|between|around|evenly)|align-items-(start|center|end|stretch|baseline)|align-self-(start|center|end)|gap-\d)$/],
  ['sizing',   /^(w-(25|50|75|100|auto)|h-(25|50|75|100|auto)|mw-100|mh-100|min-vh-100|vh-100)$/],
  ['misc',     /^(rounded(-\d|-circle|-pill)?|border(-\d|-top|-bottom|-start|-end)?|shadow(-sm|-lg|-none)?|overflow-(hidden|auto|scroll)|position-(relative|absolute|fixed|sticky)|top-\d+|start-\d+|visually-hidden|opacity-\d+|img-fluid|progress|progress-bar|text-uppercase|bg-(primary|secondary|success|danger|warning|info|light|dark|white|transparent|body))$/],
];
// Nuestros prefijos: no son Bootstrap, no cuentan.
const OURS = /^(ww-|vs-|vss-|acard|home-|lp-|au-|exp-|st-|cw-|dg-|mem-|memo|teams-|bs-|tc-|rq-|ws-|pcal|login-modal|auth-|mod-|tag|icon-btn|pub-toggle|heart|t$|s$|is-|has-|open$|arcade|tvs|skin-|hl-|f-|btn-join|race-|qlw?|el-|item-|list-)/;

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(e.name)) files.push(p);
  }
})(join(ROOT, 'views'));
(function add(dirs) { for (const d of dirs) { try { (function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p);
  } })(join(ROOT, d)); } catch {} } })(['core', 'templates']);
for (const h of ['teacher.html', 'student.html', 'index.html', 'embed.html']) files.push(join(ROOT, h));

const counts = new Map();     // clase → n
for (const f of files) {
  let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
  for (const m of src.matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g)) {
    for (const cls of m[1].split(/\s+/)) {
      const c = cls.replace(/\$\{[^}]*\}/g, '').trim();
      // Solo tokens con pinta de clase: los interpolados con ternarios dentro de
      // plantillas literales dejan restos ('?', '===', '||') que no son clases.
      if (!/^[a-zA-Z][\w-]*$/.test(c)) continue;
      if (OURS.test(c)) continue;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
  }
}

const byFamily = new Map(); const unknown = new Map();
for (const [cls, n] of counts) {
  const fam = BS_FAMILIES.find(([, re]) => re.test(cls));
  if (fam) {
    if (!byFamily.has(fam[0])) byFamily.set(fam[0], { n: 0, classes: new Map() });
    const b = byFamily.get(fam[0]); b.n += n; b.classes.set(cls, n);
  } else if (/^(bi|bi-[\w-]+)$/.test(cls)) {
    // bootstrap-icons: familia aparte (es una FUENTE, no CSS de layout)
    if (!byFamily.has('icons (bi)')) byFamily.set('icons (bi)', { n: 0, classes: new Map() });
    const b = byFamily.get('icons (bi)'); b.n += n; b.classes.set(cls, n);
  } else {
    unknown.set(cls, n);
  }
}

console.log('INVENTARIO BOOTSTRAP — lo que el CSS propio tiene que cubrir\n');
const fams = [...byFamily.entries()].sort((a, b) => b[1].n - a[1].n);
for (const [fam, { n, classes }] of fams) {
  console.log(`  ${fam.padEnd(10)} ${String(n).padStart(5)} usos · ${classes.size} clases distintas`);
  const top = [...classes.entries()].sort((a, b) => b[1] - a[1]);
  const show = showAll ? top : top.slice(0, 5);
  for (const [c, k] of show) console.log(`      ${String(k).padStart(4)}  ${c}`);
  if (!showAll && top.length > 5) console.log(`      …y ${top.length - 5} más (usa --all)`);
}
const totalBs = fams.reduce((a, [, v]) => a + v.n, 0);
console.log(`\n  TOTAL: ${totalBs} usos de Bootstrap en ${files.length} archivos.`);
if (unknown.size) {
  console.log(`\n  Sin clasificar (${unknown.size} clases — nuestras sin prefijo conocido, o Bootstrap fuera del mapa):`);
  const u = [...unknown.entries()].sort((a, b) => b[1] - a[1]).slice(0, showAll ? 999 : 15);
  for (const [c, k] of u) console.log(`      ${String(k).padStart(4)}  ${c}`);
}
console.log('\nEl CSS propio se escribe familia a familia, empezando por la de más usos;');
console.log('re-correr esto tras cada migración dice cuánto falta (debe tender a 0).');
