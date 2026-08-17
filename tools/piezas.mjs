#!/usr/bin/env node
// EL INVENTARIO DE PIEZAS — qué elementos concretos tiene CADA actividad y
// cuánto ocupan, medido en el navegador, en ANCHO y en ALTO.
//
//   node tools/piezas.mjs            → escribe docs/piezas-por-actividad.md
//   node tools/piezas.mjs quiz math  → solo esas plantillas (no escribe el doc)
//   node tools/piezas.mjs --check    → falla si el doc no está al día
//
// POR QUÉ EXISTE (D8, docs/decisiones-pendientes.md). El dueño (2026-08-17):
// «siempre es responsive y siempre se acomodan los elementos, en vertical u
// horizontal; estudiaremos eso muy detenidamente cuando tengamos todos los
// elementos concretos por actividad para saber qué distribuir». Esa condición
// —«todos los elementos concretos»— era hasta hoy un trabajo de leer trece
// players a mano, y por eso la decisión llevaba semanas sin poderse tomar.
// Aquí la máquina la cumple: siembra las 13 con su propio defaultContent(),
// las JUEGA en Individual y enumera los bloques de primer nivel del marco con
// su caja real y su porcentaje del área.
//
// LO QUE ESTE ARCHIVO NO HACE: decidir. No hay veredicto ni salida 1 por «mal
// repartido» — el reparto es justamente lo ABIERTO de D8. El rol que propone
// (barra/carril/escenario) es una SUGERENCIA por forma, para tener de dónde
// partir; la lista de la izquierda (qué piezas hay) es el dato duro.
//
// SE MIDE EN DOS FORMAS porque el problema ES el cambio de forma: el mismo
// player en un hueco ancho (proyector) y en uno alto (móvil en vertical). Una
// pieza que en ancho es un carril lateral y en alto sigue siendo una columna
// del 25 % es exactamente lo que el andamio de regiones viene a arreglar
// (styles/scaffold.css, §3b) — y hoy solo lo usan 2 de las 13.
//
// Requiere: python3 (servidor estático) y el Chromium preinstalado.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'piezas-por-actividad.md');
const PORT = Number(process.env.PORT || 8479);
const BASE = `http://127.0.0.1:${PORT}`;
const argv = process.argv.slice(2);
const check = argv.includes('--check');
const only = argv.filter(a => !a.startsWith('--'));

// Las dos formas del hueco. No son «móvil» y «escritorio»: son ANCHO y ALTO,
// que es la pregunta de D8. El alto usa 520×900 porque es la proporción de un
// teléfono en vertical sin ser tan estrecho que todo colapse por ancho.
const FORMAS = [
  { id: 'ancho', label: 'ancho (1280×800)', vp: { width: 1280, height: 800 } },
  { id: 'alto',  label: 'alto (520×900)',   vp: { width: 520, height: 900 } },
];

// El rol que la FORMA de la pieza sugiere. Es una heurística declarada, no un
// veredicto: se lee al lado de la caja medida, que es el dato de verdad.
function rolDe(b, area) {
  const anchoRel = b.w / (area.w || 1), altoRel = b.h / (area.h || 1);
  if (altoRel <= 0.20 && anchoRel >= 0.75) return 'barra';
  if (anchoRel <= 0.34 && altoRel >= 0.55) return 'carril';
  if (anchoRel >= 0.60 && altoRel >= 0.45) return 'escenario';
  return '—';
}

// Los bloques de PRIMER NIVEL del juego. Se baja por los envoltorios de un
// solo hijo (un `<div>` que solo contiene otro `<div>` no es una pieza, es
// tubería) hasta el primer nodo que reparte de verdad. Así la lista dice
// «tablero · paleta · barra», no «wrapper > wrapper > …».
const PIEZAS = `(sel) => {
  let raiz = document.querySelector(sel);
  if (!raiz) return null;
  let hijos = [...raiz.children].filter(e => getComputedStyle(e).display !== 'none');
  while (hijos.length === 1 && hijos[0].children.length) {
    raiz = hijos[0];
    hijos = [...raiz.children].filter(e => getComputedStyle(e).display !== 'none');
  }
  const R = raiz.getBoundingClientRect();
  // El nombre de la pieza tiene que DECIR qué es. Las utilidades de Bootstrap
  // (mb-3, text-center, d-flex, row…) no dicen nada: son márgenes. Si un bloque
  // solo lleva utilidades, la pieza no tiene nombre propio — y eso ya es un
  // dato para D8: no se puede repartir lo que no está identificado.
  const UTIL = /^(m|p)[btsexy]?-|^(text|d|justify|align|flex|row|col|w|h|g|gap|border|bg|fs|fw|rounded|position|top|start|end|bottom|small|btn|badge|card|container)(-|$)/;
  const nombre = (e) => {
    const cls = [...e.classList].filter(c => !/^(is-|ww-lite)/.test(c));
    const propia = cls.find(c => !UTIL.test(c));
    if (propia) return propia;
    if (e.id) return '#' + e.id;
    const t = (e.innerText || '').trim().split('\\n')[0].slice(0, 18);
    return e.tagName.toLowerCase() + (t ? ' «' + t + '»' : '') + ' (sin nombre)';
  };
  return {
    area: { w: Math.round(R.width), h: Math.round(R.height) },
    contenedor: nombre(raiz),
    display: getComputedStyle(raiz).display,
    direccion: getComputedStyle(raiz).flexDirection || '',
    andamio: !!document.querySelector(sel + ' .ww-scaffold, ' + sel + '.ww-scaffold'),
    piezas: hijos.map(e => {
      const r = e.getBoundingClientRect();
      return {
        nombre: nombre(e),
        w: Math.round(r.width), h: Math.round(r.height),
        pw: R.width ? Math.round(r.width / R.width * 100) : 0,
        ph: R.height ? Math.round(r.height / R.height * 100) : 0,
        texto: (e.innerText || '').trim().split('\\n')[0].slice(0, 24),
      };
    }),
  };
}`;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
const bye = (code) => { try { server.kill(); } catch {} process.exit(code); };
process.on('SIGINT', () => bye(130));
await new Promise(r => setTimeout(r, 700));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: FORMAS[0].vp });
// Sin red saliente en el entorno: los CDN se sirven vacíos (igual que la matriz).
await page.route('**/esm.sh/**', r => r.fulfill({ contentType: 'application/javascript', body: 'export default function(){}' }));
await page.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));

await page.goto(`${BASE}/teacher.html?backend=local`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelector('#app')?.children.length > 0, { timeout: 20000 });

// Siembra: una actividad por plantilla con SU PROPIO defaultContent(), como la
// matriz — sin fixtures que mantener.
const seeded = await page.evaluate(async () => {
  await import('/core/registerTemplates.js');
  const { listTemplates } = await import('/core/registry.js');
  const storage = await import('/core/storage.js');
  const out = [];
  for (const T of listTemplates()) {
    const m = T.meta;
    const a = {
      id: `pz_${m.name}`, template: m.name, title: `Piezas · ${m.label || m.name}`,
      content: m.defaultContent ? m.defaultContent() : {},
      rules: m.defaultRules ? m.defaultRules() : {},
      scoring: m.defaultScoring ? m.defaultScoring() : {},
      updatedAt: new Date().toISOString(),
    };
    if (T.migrateContent) { try { a.content = T.migrateContent(a.content) ?? a.content; } catch {} }
    storage.save(a);
    out.push({ name: m.name, label: m.label || m.name, id: a.id, aspect: m.aspectRatio || '4/3' });
  }
  return out;
});

const filas = [];
for (const t of seeded) {
  if (only.length && !only.includes(t.name)) continue;
  const fila = { ...t, formas: {} };
  for (const f of FORMAS) {
    await page.setViewportSize(f.vp);
    try {
      await page.evaluate(() => { location.hash = '#/mine'; });
      await page.waitForTimeout(120);
      await page.evaluate(id => { location.hash = `#/play/${id}`; }, t.id);
      await page.waitForSelector('.ww-start-go', { timeout: 9000 });
      await page.click('.ww-start-go');
      await page.waitForSelector('#ww-player-widget *', { timeout: 12000 });
      await page.waitForTimeout(450);   // deja asentar animaciones de entrada
      const d = await page.evaluate(`(${PIEZAS})('#ww-player-widget')`);
      if (!d) { fila.formas[f.id] = { error: 'sin widget' }; continue; }
      fila.formas[f.id] = d;
    } catch (e) {
      fila.formas[f.id] = { error: String(e.message).split('\n')[0].slice(0, 70) };
    }
  }
  filas.push(fila);
}
await browser.close();

const pinta = (d) => {
  if (!d || d.error) return `_${d?.error || 'sin datos'}_`;
  return d.piezas.map(p => `\`${p.nombre}\` ${p.pw}%×${p.ph}% → **${rolDe(p, d.area)}**`).join('<br>');
};

// La FICHA de cabecera es obligatoria para todo doc vivo (tests/docs.test.mjs):
// tipo · a qué doc sube · quién lo vigila. Va aquí porque el doc es generado —
// si se escribiera a mano, la primera regeneración la borraría.
let md = `# Piezas por actividad — inventario GENERADO\n\n`;
md += `> **Tipo**: generado · **Sube a**: [\`docs/README.md\`](README.md) · **Vigila**: \`tools/piezas.mjs --check\`\n\n`;
md += `> No editar a mano: sale de \`node tools/piezas.mjs\` (mide en el navegador).\n`;
md += `> Es el dato que le faltaba a **D8** (\`docs/decisiones-pendientes.md\`): qué\n`;
md += `> elementos concretos tiene cada actividad y cuánto ocupan cuando el hueco es\n`;
md += `> ANCHO y cuando es ALTO. El **rol** es una sugerencia por forma (barra si es\n`;
md += `> baja y ancha, carril si es estrecha y alta, escenario si es la masa) — la\n`;
md += `> decisión de cómo repartir sigue abierta.\n\n`;
md += `Andamio = la plantilla ya usa \`styles/scaffold.css\` (roles declarados, §3b).\n\n`;
md += `| Actividad | Proporción | Andamio | Piezas en **ancho** (1280×800) | Piezas en **alto** (520×900) |\n`;
md += `|---|---|---|---|---|\n`;
for (const f of filas) {
  const andamio = f.formas.ancho?.andamio ? '✅' : '—';
  md += `| **${f.label}** (\`${f.name}\`) | \`${f.aspect}\` | ${andamio} | ${pinta(f.formas.ancho)} | ${pinta(f.formas.alto)} |\n`;
}

// Lo que salta a la vista sin abrir el navegador: cuántas piezas cambian de rol
// al girar el hueco. Es la pregunta de D8 en un número.
const giros = filas.map(f => {
  const a = f.formas.ancho, b = f.formas.alto;
  if (!a?.piezas || !b?.piezas) return { name: f.name, label: f.label, n: null };
  const rb = new Map(b.piezas.map(p => [p.nombre, rolDe(p, b.area)]));
  const n = a.piezas.filter(p => rb.has(p.nombre) && rb.get(p.nombre) !== rolDe(p, a.area)).length;
  return { name: f.name, label: f.label, n, total: a.piezas.length };
});
md += `\n## Qué cambia al girar el hueco\n\n`;
md += `Piezas que cambian de rol entre ancho y alto (misma pieza, otra función):\n\n`;
for (const g of giros) {
  md += `- **${g.label}**: ${g.n == null ? '_no medible_' : `${g.n} de ${g.total}`}\n`;
}

// PIEZAS SIN NOMBRE PROPIO: un bloque cuyo único identificador es un margen de
// Bootstrap (`mb-3`) o un `<div>` pelado no se puede repartir — no hay a qué
// darle un rol. Es la primera tarea que sale sola de este inventario.
const anonimas = filas.flatMap(f => (f.formas.ancho?.piezas || [])
  .filter(p => /\(sin nombre\)$/.test(p.nombre))
  .map(p => ({ label: f.label, pieza: p.nombre })));
md += `\n## Piezas sin nombre propio\n\n`;
md += `Bloques cuyo único identificador es una utilidad de Bootstrap o un \`<div>\`\n`;
md += `pelado: no se les puede asignar un rol porque no están identificados. Ponerles\n`;
md += `clase propia es el primer paso de cualquier reparto.\n\n`;
md += anonimas.length
  ? anonimas.map(a => `- **${a.label}** → \`${a.pieza}\`\n`).join('')
  : `_Ninguna: las 13 tienen todas sus piezas nombradas._\n`;

if (!only.length) {
  if (check) {
    const actual = (() => { try { return readFileSync(OUT, 'utf8'); } catch { return ''; } })();
    if (actual !== md) { console.error(`❌ ${OUT} no está al día — corre: node tools/piezas.mjs`); bye(1); }
    console.log('✅ docs/piezas-por-actividad.md al día');
    bye(0);
  }
  writeFileSync(OUT, md);
}

console.log(`\nPIEZAS POR ACTIVIDAD (${filas.length} plantillas · 2 formas)\n`);
for (const f of filas) {
  const a = f.formas.ancho;
  console.log(`  ${f.label} (${f.aspect})${a?.andamio ? ' · andamio' : ''}`);
  if (!a?.piezas) { console.log(`     ${a?.error || 'sin datos'}`); continue; }
  for (const p of a.piezas) console.log(`     ${p.nombre.padEnd(24)} ${String(p.pw).padStart(3)}%×${String(p.ph).padStart(3)}%  ${rolDe(p, a.area)}`);
}
if (!only.length) console.log(`\n✅ escrito ${OUT.replace(ROOT + '/', '')}`);
bye(0);
