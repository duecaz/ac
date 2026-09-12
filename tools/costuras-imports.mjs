// COSTURAS · B10 — IMPORTS SIN USO (docs/handoff-costuras.md §1, ley §30).
//
// Por qué existe: la lectura de 2026-09-11 (docs/handoff-simplificar.md, T7)
// encontró DIECISÉIS imports muertos repartidos por `templates/*` —
// `escapeHtml` en cinco plantillas que ya no escapan nada, `wheelSvg` en dos,
// `hudSet` en dos players, `newPair`/`buildGrid`/`generateGrid` en los que
// dejaron de construir su contenido. Ninguno rompía nada: simplemente MIENTEN
// sobre de qué depende el módulo. Un import muerto es la forma más barata de
// basura y la más fácil de vigilar, así que se vigila.
//
// El barrido de `tools/auditoria.mjs` mira el otro extremo de la costura (un
// EXPORT que nadie nombra); este mira el lado del lector: un BINDING que su
// propio fichero no nombra. Entre los dos, cada extremo del cable tiene dueño.
//
// Heurística deliberadamente conservadora, igual que la de exports: el cuerpo
// se busca ENTERO, comentarios incluidos, así que un nombre citado solo en un
// `@param {Foo}` cuenta como vivo (los typedefs importados se usan así). Lo que
// marca como muerto, lo está de verdad — un auditor que grita en falso no se
// obedece a la segunda.
//
// BASELINE 0 y ratchet: solo puede bajar.
//
//   node tools/costuras-imports.mjs           # salida legible
//   node tools/costuras-imports.mjs --json    # la lista en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');

/** Todo el código SERVIDO (lo que llega al navegador). */
function ficheros() {
  const acc = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir))) {
      if (['node_modules', '.git', 'vendor', 'assets'].includes(e)) continue;
      const rel = `${dir}/${e}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (rel.endsWith('.js')) acc.push(rel);
    }
  };
  for (const d of ['core', 'views', 'kernel', 'adapters', 'templates']) walk(d);
  for (const f of ['main.teacher.js', 'main.student.js', 'main.embed.js']) {
    if (existsSync(join(ROOT, f))) acc.push(f);
  }
  return acc;
}

// Una sentencia `import <clausula> from '<ruta>'`. La clase de carácter
// `[^'"]` casa TAMBIÉN saltos de línea a propósito: hay imports repartidos en
// cuatro líneas (`views/hostLive.js`) y también cuentan.
const RE_IMPORT = /^[ \t]*import\s+([^'"]+?)\s+from\s*['"][^'"]+['"];?[ \t]*$/gm;

/** Los nombres LOCALES que una cláusula de import mete en el módulo. */
export function bindingsDe(clausula) {
  const nombres = [];
  const llaves = clausula.match(/\{([^}]*)\}/);
  if (llaves) {
    for (const parte of llaves[1].split(',')) {
      const t = parte.trim();
      if (t) nombres.push(t.split(/\s+as\s+/).pop().trim());
    }
  }
  const resto = clausula.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
  const ns = resto.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (ns) nombres.push(ns[1]);
  else if (resto && /^[A-Za-z_$][\w$]*$/.test(resto)) nombres.push(resto);
  return nombres;
}

/** @param {string} src @returns {{nombre: string, linea: number}[]} */
export function muertosEn(src) {
  const cuerpo = src.replace(RE_IMPORT, '');
  const out = [];
  for (const m of src.matchAll(RE_IMPORT)) {
    const linea = src.slice(0, m.index).split('\n').length;
    for (const n of bindingsDe(m[1])) {
      // Sin `\b`: con `$`/`$$` el \b nunca casa (la lección de los exports).
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`(?<![\\w$])${esc}(?![\\w$])`).test(cuerpo)) out.push({ nombre: n, linea });
    }
  }
  return out;
}

// ── CONTRA-PRUEBA sintética: si el detector no ve lo plantado a propósito, no
// se confía en el resto de la salida (código 2). Va con su gemelo en VERDE: un
// barrido demasiado ciego y uno demasiado celoso fallan igual de caro.
function contraPrueba() {
  const rotos = [];
  const malo = [
    "import { vivo, muerto } from './x.js';",
    "import * as Nadie from './y.js';",
    "import Def from './z.js';",
    'export function f() { return vivo + Def; }',
  ].join('\n');
  const vistos = muertosEn(malo).map(h => h.nombre).sort();
  if (vistos.join(',') !== 'Nadie,muerto') rotos.push(`no ve los muertos plantados (vio: ${vistos.join(',') || '—'})`);
  const bueno = [
    "import { usado } from './x.js';",
    "import * as NS from './y.js';",
    'const a = NS.algo(usado);',
    '/** @param {Tipo} t */ function g(t) { return [a, t]; }',
    "import { Tipo } from './t.js';",
  ].join('\n');
  if (muertosEn(bueno).length) rotos.push('grita en falso sobre imports vivos (uno de ellos solo citado en JSDoc)');
  const multilinea = [
    'import { uno,',
    '         dos }',
    "       from './x.js';",
    'export const r = uno;',
  ].join('\n');
  if (muertosEn(multilinea).map(h => h.nombre).join(',') !== 'dos') rotos.push('no lee un import repartido en varias líneas');
  return rotos;
}

const rotos = contraPrueba();
if (rotos.length) {
  console.error('❌ CONTRA-PRUEBA ROTA — el barrido no caza lo que dice cazar:');
  for (const r of rotos) console.error(`   · ${r}`);
  process.exit(2);
}

// ════════════════════════════════════════════════════════════════════════
const hallazgos = [];
for (const f of ficheros()) {
  for (const h of muertosEn(readFileSync(join(ROOT, f), 'utf8'))) {
    hallazgos.push({ fichero: f, ...h });
  }
}

// BASELINE escrito a mano (nunca «lo que haya hoy»). Ratchet: solo baja.
const BASELINE = 0;

if (asJson) {
  console.log(JSON.stringify({ baseline: BASELINE, hallazgos }, null, 2));
  process.exit(hallazgos.length > BASELINE ? 1 : 0);
}

console.log('COSTURAS · B10 — imports que el módulo no usa\n');
if (hallazgos.length) {
  console.log(`  ❌ ${hallazgos.length} import(s) sin uso (baseline ${BASELINE}):`);
  for (const h of hallazgos) console.log(`     ${h.fichero}:${h.linea}  ${h.nombre}`);
  console.log('     → se BORRAN del import (§30: lo que no tiene lector, no está).');
} else {
  console.log(`  ✅ 0 imports sin uso (baseline ${BASELINE})`);
}
console.log(`\nB10: ${hallazgos.length} hallazgo(s) (baseline ${BASELINE})`);
process.exit(hallazgos.length > BASELINE ? 1 : 0);
