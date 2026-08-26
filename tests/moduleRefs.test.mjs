// RED DE SEGURIDAD Nº1 — "identificador usado sin importar".
//
// Dos veces se coló el MISMO bug en producción: `views/memoryView.js` usaba
// `teamsScoreboardHtml`/`teamsPodiumHtml` (v1.51.288) y `COVER_MS` (v1.51.289)
// sin importarlos. `node --check` no lo ve (la sintaxis es válida) y el módulo
// importa bien: el ReferenceError solo estalla cuando esa línea SE EJECUTA — al
// pintar el tablero. Resultado: "Memoria por equipos NO ABRE", encontrado por QA
// en una pizarra en vez de por CI en el commit.
//
// Este escáner construye el mapa de TODO lo que exporta el repo y marca cualquier
// fichero que USE uno de esos nombres sin importarlo ni declararlo. Es acotado a
// propósito (solo nombres que existen como export en otro módulo, o constantes
// UPPER_SNAKE): así caza la clase de bug real con cero ruido.
//
// Run: node tests/moduleRefs.test.mjs
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { TERCEROS } from './helpers/inventario.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

const SKIP_DIRS = new Set([...TERCEROS, 'docs', 'tests', 'tools']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

// Blanquea comentarios, cadenas y el TEXTO de las plantillas, dejando intactas
// las interpolaciones `${…}` (ahí sí hay código) y TODOS los saltos de línea
// (los números de línea del informe deben seguir siendo los del fichero real).
// Escáner carácter a carácter: los regex fallan con plantillas anidadas
// (`<b>${x ? `sí` : `no`}</b>`), que es justo lo que abunda en las vistas.
function stripNoise(src) {
  const out = new Array(src.length);
  const blank = (i) => { out[i] = src[i] === '\n' ? '\n' : ' '; };
  const keep = (i) => { out[i] = src[i]; };
  // Pila de plantillas abiertas: cada `${` mete un nivel de "código".
  const tpl = [];           // profundidad de llaves dentro de la interpolación actual
  let i = 0;
  while (i < src.length) {
    const c = src[i], two = src.slice(i, i + 2);
    if (tpl.length && tpl[tpl.length - 1] === null) {
      // Dentro del TEXTO de una plantilla.
      if (c === '\\') { blank(i); blank(i + 1); i += 2; continue; }
      if (two === '${') { keep(i); keep(i + 1); tpl[tpl.length - 1] = 0; i += 2; continue; }
      if (c === '`') { keep(i); tpl.pop(); i++; continue; }
      blank(i); i++; continue;
    }
    // Código normal (o dentro de una interpolación).
    if (two === '/*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; while (i < stop) blank(i++); continue; }
    if (two === '//') { while (i < src.length && src[i] !== '\n') blank(i++); continue; }
    if (c === "'" || c === '"') {
      keep(i); i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') { blank(i); if (i + 1 < src.length) blank(i + 1); i += 2; continue; }
        blank(i); i++;
      }
      if (i < src.length) keep(i++);
      continue;
    }
    if (c === '`') { keep(i); tpl.push(null); i++; continue; }
    if (tpl.length) {
      // Seguimos el balance de llaves para saber dónde acaba la interpolación.
      if (c === '{') tpl[tpl.length - 1]++;
      else if (c === '}') {
        if (tpl[tpl.length - 1] === 0) { keep(i); tpl[tpl.length - 1] = null; i++; continue; }
        tpl[tpl.length - 1]--;
      }
    }
    keep(i); i++;
  }
  return out.join('');
}

const files = walk(ROOT);

// ── 1. Mapa de exports del repo: nombre → módulos que lo exportan ────────────
const exportedBy = new Map();
const addExport = (name, file) => {
  if (!name) return;
  if (!exportedBy.has(name)) exportedBy.set(name, new Set());
  exportedBy.get(name).add(file);
};
for (const f of files) {
  const src = stripNoise(readFileSync(f, 'utf8'));
  const rel = relative(ROOT, f);
  for (const m of src.matchAll(/\bexport\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) addExport(m[1], rel);
  for (const m of src.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) addExport(m[1], rel);
  for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const piece of m[1].split(',')) {
      const as = piece.split(/\bas\b/);
      addExport((as[as.length - 1] || '').trim(), rel);
    }
  }
}

// ── 2. Por fichero: nombres importados + declarados ──────────────────────────
function bindingsOf(src) {
  const names = new Set();
  const add = (n) => { if (n && /^[A-Za-z_$][\w$]*$/.test(n)) names.add(n); };
  // imports
  for (const m of src.matchAll(/\bimport\s+([\s\S]*?)\s+from\s*['"`]/g)) {
    const clause = m[1];
    for (const b of clause.matchAll(/\{([^}]*)\}/g)) {
      for (const piece of b[1].split(',')) {
        const as = piece.split(/\bas\b/);
        add((as[as.length - 1] || '').trim());
      }
    }
    for (const b of clause.matchAll(/\*\s+as\s+([A-Za-z_$][\w$]*)/g)) add(b[1]);
    const def = clause.replace(/\{[^}]*\}/g, '').replace(/\*\s+as\s+[\w$]+/g, '');
    for (const piece of def.split(',')) add(piece.trim());
  }
  // declaraciones: const/let/var (incl. destructuring), function, class
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]/g)) {
    for (const piece of m[1].split(',')) {
      const as = piece.includes(':') ? piece.split(':')[1] : piece;
      add((as || '').replace(/=.*$/, '').replace(/^\s*\.\.\./, '').trim());
    }
  }
  for (const m of src.matchAll(/\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  // parámetros y capturas: generoso a propósito (preferimos no dar falsos positivos)
  for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/\(([^()]*)\)\s*=>/g)) {
    for (const piece of m[1].split(',')) add(piece.replace(/[={[].*$/s, '').replace(/^\s*\.\.\./, '').trim());
  }
  for (const m of src.matchAll(/(?:function\s*\*?\s*[\w$]*\s*|\b[\w$]+\s*)\(([^()]*)\)\s*\{/g)) {
    for (const piece of m[1].split(',')) add(piece.replace(/[={[].*$/s, '').replace(/^\s*\.\.\./, '').trim());
  }
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) add(m[1]);          // x => …
  for (const m of src.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  // Parámetros DESESTRUCTURADOS: renderItem({ item, idx, submit }) — los nombres
  // de dentro son bindings, no referencias libres.
  for (const m of src.matchAll(/\(\s*\{([^{}]*)\}\s*(?:,|\))/g)) {
    for (const piece of m[1].split(',')) {
      const as = piece.includes(':') ? piece.split(':')[1] : piece;
      add((as || '').replace(/=.*$/s, '').replace(/^\s*\.\.\./, '').trim());
    }
  }
  // Métodos abreviados de objeto/clase: `stop() { … }` declara, no referencia.
  for (const m of src.matchAll(/^[ \t]*(?:async\s+|get\s+|set\s+|static\s+)*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm)) add(m[1]);
  return names;
}

// Referencias "libres": un identificador NO precedido de `.` ni de `{`/`,` en
// posición de clave, y que no sea una propiedad (`obj.NOMBRE`) ni una clave
// (`NOMBRE:`). Nos quedamos con las que apuntan a algo exportado en el repo.
function freeRefs(src) {
  const out = new Map(); // name → primera línea
  // Las propias sentencias import/export NO son referencias (ahí `activityItemCount`
  // de `import { activityItemCount as itemCount }` es el nombre de origen, no un uso).
  const lines = src
    .replace(/\bimport\s+[\s\S]*?\s+from\s*['"`][^'"`]*['"`]/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\bexport\s*\{[^}]*\}(\s*from\s*['"`][^'"`]*['"`])?/g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of line.matchAll(/([.?]\s*)?\b([A-Za-z_$][\w$]*)\b\s*(:)?/g)) {
      const [, dot, name, colon] = m;
      if (dot || colon) continue;            // obj.name  /  { name: … }
      if (!out.has(name)) out.set(name, i + 1);
    }
  }
  return out;
}

// Globales del navegador/JS que nunca se importan.
const GLOBALS = new Set(`
window document navigator location history screen console alert confirm prompt
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
queueMicrotask structuredClone fetch Headers Request Response FormData URL URLSearchParams
Blob File FileReader Image Audio AudioContext Worker WebSocket EventSource AbortController
localStorage sessionStorage indexedDB caches crypto performance matchMedia getComputedStyle
CustomEvent Event MouseEvent KeyboardEvent PointerEvent TouchEvent DragEvent ResizeObserver
IntersectionObserver MutationObserver DOMParser XMLSerializer XMLHttpRequest DOMException
Object Array String Number Boolean Symbol BigInt Function Math JSON Date RegExp Error
TypeError RangeError SyntaxError ReferenceError EvalError URIError AggregateError
Map Set WeakMap WeakSet Promise Proxy Reflect Intl globalThis undefined null NaN Infinity
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI
Uint8Array Int8Array Uint16Array Int16Array Uint32Array Int32Array Float32Array Float64Array
ArrayBuffer DataView TextEncoder TextDecoder btoa atob process module require exports
import export default this arguments super new typeof instanceof void delete in of
if else for while do switch case break continue return function class const let var
try catch finally throw yield await async static get set extends implements
true false SVGElement HTMLElement Node NodeList Element Text CSS speechSynthesis
SpeechSynthesisUtterance MediaRecorder OffscreenCanvas Path2D DeviceOrientationEvent
`.trim().split(/\s+/));

// ── 3. El chequeo ────────────────────────────────────────────────────────────
const violations = [];
for (const f of files) {
  const rel = relative(ROOT, f);
  const src = stripNoise(readFileSync(f, 'utf8'));
  const bound = bindingsOf(src);
  const refs = freeRefs(src);
  for (const [name, line] of refs) {
    if (bound.has(name) || GLOBALS.has(name)) continue;
    const owners = exportedBy.get(name);
    // Solo delatamos nombres que EXISTEN como export en otro módulo del repo:
    // es la firma inequívoca de "olvidé el import" (y evita falsos positivos).
    if (!owners || (owners.size === 1 && owners.has(rel))) continue;
    violations.push({ file: rel, line, name, from: [...owners].filter(o => o !== rel).join(', ') });
  }
}

if (violations.length) {
  console.error('\n  Identificadores usados SIN importar (ReferenceError en cuanto se ejecute esa línea):');
  for (const v of violations) console.error(`    ✗ ${v.file}:${v.line} — «${v.name}» se exporta en ${v.from}`);
}
assert.strictEqual(violations.length, 0,
  `${violations.length} identificador(es) usados sin importar — ver lista arriba`);
ok(`${files.length} módulos: 0 identificadores usados sin importar (${exportedBy.size} exports mapeados)`);

// ── 4. El escáner se caza a sí mismo (guard del guard) ───────────────────────
{
  const fake = `
    import { mount } from '../core/html.js';
    export function paint() {
      mount('#x', teamsScoreboardHtml([], 't1', false));
      setTimeout(() => cover(), COVER_MS);
    }`;
  const src = stripNoise(fake);
  const bound = bindingsOf(src);
  const refs = freeRefs(src);
  const caught = [...refs.keys()].filter(n => !bound.has(n) && !GLOBALS.has(n) && exportedBy.has(n));
  assert.ok(caught.includes('teamsScoreboardHtml'), 'el escáner caza el import olvidado de teamsScoreboardHtml');
  assert.ok(caught.includes('COVER_MS'), 'el escáner caza la constante olvidada COVER_MS');
  assert.ok(!caught.includes('mount'), 'lo que SÍ está importado no se marca');
  ok('el escáner reproduce los dos bugs reales de memoryView (y no marca lo importado)');
}

console.log(`\nmoduleRefs.test: ${passed} checks passed`);
