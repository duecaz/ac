// COSTURAS · B5 — LA MISMA REGLA ESCRITA DOS VECES (docs/handoff-costuras.md §1 B5).
//
// No duplicado TEXTUAL (eso lo ve cualquier linter) sino SEMÁNTICO: dos
// funciones que hacen lo mismo con otro nombre, dos frases de UI que explican
// la misma regla, y números mágicos sin dueño que se repiten porque nadie los
// declaró en un sitio. Ninguno de los tres cruces arregla nada: cada uno
// produce una LISTA para que otro agente (o el dueño) diga `misma regla` /
// `parecido de forma, distinta intención` / `misma frase` por entrada
// (plantilla de veredicto en docs/handoff-costuras.md §3).
//
//   a. FUNCIONES PARECIDAS ENTRE FICHEROS DISTINTOS — cada función
//      (declaración, expresión, método, arrow asignada) con ≥6 líneas de
//      cuerpo se normaliza (sin comentarios, sin espacios, identificadores →
//      $v, strings → $s, números → $n) y se compara por tejas (shingles,
//      k=8) con similitud de Jaccard ≥0,7 entre funciones de FICHEROS
//      DISTINTOS. Se excluyen los pares donde un fichero importa por nombre
//      a la función del otro (ya comparten: no es una copia, es un import).
//   b. FRASES DE UI REPETIDAS — literales de texto ≥25 caracteres, con
//      ≥2 palabras y alguna letra acentuada o espacio (texto humano, no
//      selector ni ruta), repetidos en ≥2 ficheros distintos.
//   c. NÚMEROS MÁGICOS CON DUEÑO AUSENTE — literales «con pinta de límite»
//      (≥100, o multiplicaciones tipo `200 * 1024`, o `0.xx`) repetidos en
//      ≥2 ficheros de core/views/templates, que no vengan de
//      core/quotas.js / core/constants.js / core/timings.js /
//      core/liveEnd.js. Si el valor coincide con una constante que alguno de
//      esos cuatro módulos EXPORTA, se dice: «hay dueño y no se usa».
//
// Estilo: como tools/costuras-contrato.mjs / costuras-declaraciones.mjs /
// costuras-cableado.mjs — ✅/❌ por cruce, baseline-ratchet (solo puede
// BAJAR), contra-prueba con fuentes SINTÉTICAS (nunca ficheros reales) que
// deben salir en las tres listas — si no, código 2, no se confía en el resto.
//
//   node tools/costuras-duplicados.mjs           # salida legible
//   node tools/costuras-duplicados.mjs --json    # las 3 listas en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { sinComentarios } from '../core/sinComentarios.js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir, acc = []) {
  if (!existsSync(join(ROOT, dir))) return acc;
  for (const e of readdirSync(join(ROOT, dir))) {
    if (['node_modules', '.git', 'vendor', 'assets'].includes(e)) continue;
    const rel = `${dir}/${e}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, acc);
    else if (e.endsWith('.js')) acc.push(rel);
  }
  return acc;
}
// (a) y (b): las CINCO capas que el enunciado pide barrer. (c) se restringe a
// core/views/templates (dicho explícitamente en docs/handoff-costuras.md §1
// B5 y en el encargo: kernel/adapters quedan fuera de los números mágicos
// porque son 28 ficheros de máquina de estados con MUY pocos literales
// numéricos propios — el ruido de esa capa está en core/views/templates).
const DIRS_TODAS = ['core', 'views', 'kernel', 'adapters', 'templates'];
const DIRS_NUMEROS = ['core', 'views', 'templates'];
const FICHEROS_TODAS = DIRS_TODAS.reduce((acc, d) => walk(d, acc), []);
const FICHEROS_NUMEROS = DIRS_NUMEROS.reduce((acc, d) => walk(d, acc), []);

// ════════════════════════════════════════════════════════════════════════
// UTILIDADES DE TEXTO COMPARTIDAS — trabajan sobre {file, raw}, nunca releen
// disco por su cuenta, para que la contra-prueba pueda pasar fuentes
// SINTÉTICAS sin tocar el filesystem.
// ════════════════════════════════════════════════════════════════════════
const blank = sinComentarios; // dueño único: core/sinComentarios.js

/** Blanquea el CONTENIDO de cadenas y plantillas (conserva delimitador y
 *  longitud, para no correr números de línea/columna) — necesario para que
 *  las búsquedas de números y de identificadores no confundan un número o
 *  una palabra clave que vive DENTRO de un string con uno de código. Se
 *  aplica siempre DESPUÉS de `blank` (sin comentarios). */
function blankStrings(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      out.push(src.slice(i, j).replace(/[^\n]/g, ' '));
      i = j;
      continue;
    }
    out.push(c);
    i++;
  }
  return out.join('');
}

function encontrarParen(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '(') depth++;
    else if (src[j] === ')') { depth--; if (depth === 0) return j; }
  }
  return -1;
}
function encontrarLlave(src, i) {
  let depth = 0, inStr = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (c === '\\') { j++; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return j; }
  }
  return -1;
}

// ════════════════════════════════════════════════════════════════════════
// (a) EXTRACCIÓN DE FUNCIONES — heurística por regex + balanceo de
// llaves/paréntesis (el mismo estilo que `parseFn`/`esStub` de
// costuras-contrato.mjs, sin el AST completo que el proyecto no usa en
// ningún tool). Cubre CUATRO formas:
//   1. declaración  `function nombre(...) { ... }`
//   2. expresión    `const nombre = function(...) { ... }`
//   3. método       `nombre(...) { ... }` (clase u objeto literal — el
//      distingo con "una llamada seguida de bloque" es que en JS válido eso
//      SOLO ocurre tras `if/for/while/switch/catch`, que se excluyen por
//      nombre; una llamada de verdad nunca lleva un `{` de bloque pegado)
//   4. arrow asignada `const nombre = (...) => { ... }` / `x => { ... }`
//      (solo cuerpo de BLOQUE — un arrow de cuerpo conciso de una sola
//      expresión no llega a 6 líneas en la práctica; se documenta como
//      límite acotado, no se persigue).
// Se exige body ≥6 líneas (contadas en el texto ORIGINAL, antes de
// normalizar) tal como pide el encargo.
// ════════════════════════════════════════════════════════════════════════
const RESERVADAS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'with', 'do', 'return',
  'typeof', 'new', 'delete', 'void', 'yield', 'await', 'in', 'of', 'else',
  'try', 'finally', 'class', 'extends', 'import', 'export', 'default',
  'super', 'this', 'static', 'case', 'instanceof',
]);
const NAME_PAREN_RE = /(^|[^.\w$])(?:function\s+)?([A-Za-z_$][\w$]*)\s*\(/g;
const FUNCEXPR_RE = /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b\s*[A-Za-z_$]*\s*\(/g;
const ARROW_RE = /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;

function lineaDe(raw, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (raw[i] === '\n') n++;
  return n;
}
function numLineas(texto) { return texto.split('\n').length; }

function extraerFuncionesDeFichero({ file, raw }) {
  const blanked = blank(raw);
  const out = [];
  const vistos = new Set(); // dedupe por índice de apertura de llave (evita doble conteo entre patrones)

  const registrar = (nombre, cierreParenIdx) => {
    if (RESERVADAS.has(nombre)) return;
    let j = cierreParenIdx + 1;
    while (j < blanked.length && /\s/.test(blanked[j])) j++;
    if (blanked[j] !== '{') return;
    if (vistos.has(j)) return;
    const cierre = encontrarLlave(blanked, j);
    if (cierre < 0) return;
    const cuerpoOriginal = raw.slice(j + 1, cierre);
    if (numLineas(cuerpoOriginal) < 6) return;
    if (esWrapperDeFirma(blanked.slice(j + 1, cierre))) return; // wrapper de firma: no es lógica duplicada
    vistos.add(j);
    out.push({ file, nombre, line: lineaDe(raw, j), cuerpo: cuerpoOriginal });
  };

  // 1+3: declaración y método/llamada-con-bloque (mismo patrón: nombre(…) {)
  {
    NAME_PAREN_RE.lastIndex = 0;
    let m;
    while ((m = NAME_PAREN_RE.exec(blanked))) {
      const parenIdx = m.index + m[0].length - 1; // el '(' que cerró el match
      const cierre = encontrarParen(blanked, parenIdx);
      if (cierre < 0) continue;
      registrar(m[2], cierre);
    }
  }
  // 2: función expresión asignada a variable
  {
    FUNCEXPR_RE.lastIndex = 0;
    let m;
    while ((m = FUNCEXPR_RE.exec(blanked))) {
      let i = FUNCEXPR_RE.lastIndex - 1; // ya apunta al '(' final del match
      while (blanked[i] !== '(') i++;
      const cierre = encontrarParen(blanked, i);
      if (cierre < 0) continue;
      registrar(m[1], cierre);
    }
  }
  // 4: arrow asignada a variable, cuerpo de bloque
  {
    ARROW_RE.lastIndex = 0;
    let m;
    while ((m = ARROW_RE.exec(blanked))) {
      const llaveIdx = ARROW_RE.lastIndex - 1; // el regex termina justo en '{'
      if (vistos.has(llaveIdx)) continue;
      const cierre = encontrarLlave(blanked, llaveIdx);
      if (cierre < 0) continue;
      const cuerpoOriginal = raw.slice(llaveIdx + 1, cierre);
      if (numLineas(cuerpoOriginal) < 6) continue;
      if (esWrapperDeFirma(blanked.slice(llaveIdx + 1, cierre))) continue; // wrapper de firma
      vistos.add(llaveIdx);
      out.push({ file, nombre: m[1], line: lineaDe(raw, llaveIdx), cuerpo: cuerpoOriginal });
    }
  }
  return out;
}

// ── NORMALIZACIÓN + TOKENIZADO ──
const KEYWORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'export', 'extends', 'finally', 'for',
  'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return',
  'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var',
  'void', 'while', 'with', 'yield', 'async', 'await', 'of', 'get', 'set',
  'null', 'true', 'false', 'undefined',
]);
const TOKEN_RE = /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+\.?\d*(?:[eE][+-]?\d+)?|[A-Za-z_$][\w$]*|=>|\?\.|\?\?|===|!==|==|!=|<=|>=|&&|\|\||\+\+|--|\*\*|[{}()[\];,.:?+\-*/%<>=!&|^~]/g;
function normalizarToken(tok) {
  const c0 = tok[0];
  if (c0 === '`' || c0 === '"' || c0 === "'") return '$s';
  if (/^\d/.test(tok)) return '$n';
  if (/^[A-Za-z_$]/.test(tok)) return KEYWORDS.has(tok) ? tok : '$v';
  return tok;
}
// DESAZUCARAR PLANTILLAS (Cruce a, corrección) — `TOKEN_RE` trataba
// `` `<a>${x.y}</a>` `` entera como UN token `$s`, interpolación incluida:
// dos rondas de `scoringPanelHtml`/`livePanelHtml` con el MISMO HTML fijo
// pero datos distintos (`${x.y}` vs `${z.w.q}`) daban 1,00 de Jaccard porque,
// tras normalizar, ambos cuerpos eran la MISMA secuencia de `$s`. La cura:
// antes de tokenizar, cada plantilla se reescribe como texto+código —
//   texto fijo         → `"$s"` (un literal, un solo token `$s` normalizado)
//   `${expr}`           → `(expr)` sin las llaves, para que TOKEN_RE tokenice
//                          la expresión como CÓDIGO de verdad (identificadores,
//                          puntos, operadores) en vez de tragarla entera.
// Recursivo: una plantilla ANIDADA dentro de una interpolación (poco común
// pero legal) se desazucara con la misma función antes de seguir.
function procesarPlantilla(src, i) {
  const n = src.length;
  const piezas = [];
  let j = i + 1;
  let inicioTexto = j;
  const cerrarTexto = (fin) => { if (fin > inicioTexto) piezas.push('"$s"'); };
  while (j < n) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '`') { cerrarTexto(j); j++; return { texto: piezas.join(' '), fin: j }; }
    if (c === '$' && src[j + 1] === '{') {
      cerrarTexto(j);
      j += 2;
      let depth = 1;
      let exprBruta = '';
      while (j < n && depth > 0) {
        const cc = src[j];
        if (cc === '"' || cc === "'") {
          let k = j + 1;
          while (k < n) { if (src[k] === '\\') { k += 2; continue; } if (src[k] === cc) { k++; break; } k++; }
          exprBruta += src.slice(j, k);
          j = k;
          continue;
        }
        if (cc === '`') {
          const r = procesarPlantilla(src, j);
          exprBruta += r.texto;
          j = r.fin;
          continue;
        }
        if (cc === '{') { depth++; exprBruta += cc; j++; continue; }
        if (cc === '}') { depth--; j++; if (depth === 0) break; exprBruta += cc; continue; }
        exprBruta += cc; j++;
      }
      piezas.push('(' + exprBruta + ')');
      inicioTexto = j;
      continue;
    }
    j++;
  }
  cerrarTexto(j); // plantilla sin cerrar: no debería darse en fuente válido
  return { texto: piezas.join(' '), fin: j };
}
function desazucararPlantillas(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === c) { j++; break; } j++; }
      out += src.slice(i, j);
      i = j;
      continue;
    }
    if (c === '`') {
      const r = procesarPlantilla(src, i);
      out += r.texto;
      i = r.fin;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
function tokenizarNormalizado(cuerpo) {
  const toks = desazucararPlantillas(cuerpo).match(TOKEN_RE) || [];
  return toks.map(normalizarToken);
}
// WRAPPER DE FIRMA (Cruce a, corrección) — una función cuyo cuerpo es UNA
// sola sentencia que reenvía la llamada (`renderXEditor(root, a, onChange,
// {…})`) no es lógica duplicada: es la FORMA que tiene el proyecto de
// registrar un editor por plantilla. Trece de esas, una por plantilla, con
// la MISMA forma «(return) NOMBRE(args)» → ruido, no costura. Se detecta
// sobre el cuerpo SIN comentarios: «return » opcional, un identificador
// llamado UNA vez, y nada después de cerrar sus paréntesis salvo `;` y
// espacio — si hubiera una segunda sentencia (otra llamada, una asignación
// antes) ya no es un wrapper puro y se conserva en el cruce.
function esWrapperDeFirma(cuerpoBlanked) {
  const t = String(cuerpoBlanked || '').trim();
  const m = /^(?:return\s+)?[A-Za-z_$][\w$]*\s*\(/.exec(t);
  if (!m) return false;
  const parenIdx = m[0].length - 1;
  const cierre = encontrarParen(t, parenIdx);
  if (cierre < 0) return false;
  const resto = t.slice(cierre + 1).trim();
  return resto === '' || resto === ';';
}
const K = 8;
function shingles(tokens) {
  const set = new Set();
  for (let i = 0; i + K <= tokens.length; i++) set.add(tokens.slice(i, i + K).join(' '));
  return set;
}
function jaccard(a, b) {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (big.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ── EXCLUSIÓN "una importa a la otra por nombre" (ya comparten, no es copia) ──
const cacheImports = new Map();
// Mapa NOMBRE ORIGINAL (el exportado por el otro módulo, no el alias local)
// → especificador — "importa a la otra por nombre" se juzga por CÓMO se
// llama la función en el fichero que la exporta, no por cómo la renombra
// quien la importa (`import { calcularTotal as sumarTodo }` sigue siendo
// una importación de `calcularTotal`).
function importsDe(file, raw) {
  if (cacheImports.has(file)) return cacheImports.get(file);
  const map = new Map();
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  const src = blank(raw);
  let m;
  while ((m = re.exec(src))) {
    for (const spec of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
      const [orig] = spec.split(/\s+as\s+/).map(s => s.trim());
      map.set(orig, m[2]);
    }
  }
  cacheImports.set(file, map);
  return map;
}
function resolverImport(fromFile, especificador) {
  if (!especificador.startsWith('.')) return null;
  let p = join(dirname(fromFile), especificador).replace(/\\/g, '/');
  if (!/\.[cm]?js$/.test(p)) p += '.js';
  return p;
}
function mismoFichero(a, b) {
  const norm = (p) => p.replace(/^\.\//, '').replace(/\.js$/, '');
  return norm(a) === norm(b);
}
function importaAlOtroPorNombre(entA, rawA, entB, rawB) {
  const impA = importsDe(entA.file, rawA);
  if (impA.has(entB.nombre)) {
    const r = resolverImport(entA.file, impA.get(entB.nombre));
    if (r && mismoFichero(r, entB.file)) return true;
  }
  const impB = importsDe(entB.file, rawB);
  if (impB.has(entA.nombre)) {
    const r = resolverImport(entB.file, impB.get(entA.nombre));
    if (r && mismoFichero(r, entA.file)) return true;
  }
  return false;
}

// Índice invertido shingle→[índices de función] para no comparar TODOS los
// pares (miles²): solo se comparan funciones que ya comparten al menos una
// teja. Documentado: es una poda, no cambia el resultado (dos funciones sin
// ninguna teja en común no pueden llegar a 0,7 de Jaccard).
const UMBRAL_FUNCIONES = 0.7; // ver nota de falsos positivos al final si sube a 0.8
function cruceFunciones(entradasPorFichero, umbral = UMBRAL_FUNCIONES) {
  const funcs = [];
  for (const { file, raw } of entradasPorFichero) {
    for (const f of extraerFuncionesDeFichero({ file, raw })) {
      const tokens = tokenizarNormalizado(f.cuerpo);
      const sh = shingles(tokens);
      if (sh.size === 0) continue; // cuerpo demasiado corto en tokens (aunque ≥6 líneas)
      funcs.push({ ...f, sh, rawByFile: raw });
    }
  }
  const rawDe = new Map(entradasPorFichero.map(e => [e.file, e.raw]));
  const bucket = new Map(); // teja → [índice]
  funcs.forEach((f, i) => {
    for (const t of f.sh) {
      if (!bucket.has(t)) bucket.set(t, []);
      bucket.get(t).push(i);
    }
  });
  const candidatos = new Set();
  for (const idxs of bucket.values()) {
    if (idxs.length < 2 || idxs.length > 400) continue; // teja demasiado común (>400 funcs): no discrimina, se descarta
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        const i = idxs[a], j = idxs[b];
        if (funcs[i].file === funcs[j].file) continue;
        candidatos.add(i < j ? `${i}:${j}` : `${j}:${i}`);
      }
    }
  }
  const salida = [];
  for (const key of candidatos) {
    const [i, j] = key.split(':').map(Number);
    const A = funcs[i], B = funcs[j];
    const sim = jaccard(A.sh, B.sh);
    if (sim < umbral) continue;
    if (importaAlOtroPorNombre(A, rawDe.get(A.file), B, rawDe.get(B.file))) continue;
    salida.push({ similitud: sim, a: { file: A.file, line: A.line, nombre: A.nombre }, b: { file: B.file, line: B.line, nombre: B.nombre } });
  }
  return salida.sort((x, y) => y.similitud - x.similitud);
}

// ════════════════════════════════════════════════════════════════════════
// (b) FRASES DE UI REPETIDAS — literales de cadena ≥25 caracteres, ≥2
// palabras, con espacio o letra acentuada (texto humano). Se excluyen
// selectores (`.foo`/`#foo`), rutas (`/a/b`, `core/x.js`), URLs, claves
// internas (`ww.*`, `--ww-*`, `data-*`) y cadenas donde la mayoría de
// caracteres no son letras (plantillas de formato, IDs).
// ════════════════════════════════════════════════════════════════════════
const STR_RE = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g;
const RE_ACENTO = /[áéíóúñüÁÉÍÓÚÑÜ]/;
// BOOTSTRAP/CSS (Cruce b, corrección) — una lista de clases (`btn btn-primary
// btn-sm`) o de valores CSS sueltos (`flex-wrap nowrap`) pasaba el filtro de
// «texto humano» porque tiene ≥2 palabras y espacio: nunca es PROSA, es
// markup copiado. Se reconoce por lo que NO tiene: ni mayúscula, ni tilde, ni
// puntuación de frase (`,.!?¡¿`) — y se excluye, SALVO que lleve `:`/`;`/`#`,
// que delata CSS-en-línea copiado a mano (`color:#fff;padding:4px`), que sí
// es una costura real.
const RE_PUNTUACION_HUMANA = /[,.!?¡¿]/;
function pareceBootstrapOCss(s) {
  if (RE_ACENTO.test(s)) return false;
  if (/[A-ZÁÉÍÓÚÑ]/.test(s)) return false;
  if (RE_PUNTUACION_HUMANA.test(s)) return false;
  return true;
}
function esFraseHumana(s) {
  if (s.length < 25) return false;
  if (/^[./#]/.test(s)) return false; // selector o ruta relativa
  if (/^https?:\/\//.test(s)) return false;
  if (/^(ww\.|--ww-|data-|core\/|views\/|templates\/|kernel\/|adapters\/)/.test(s)) return false;
  if (/\$\{/.test(s)) return false; // plantilla con interpolación: no es texto fijo comparable
  if (/[<>]/.test(s)) return false; // fragmento HTML: lo compara su propio texto interno si hace falta, no el tag
  const palabras = s.trim().split(/\s+/).filter(p => /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/.test(p));
  if (palabras.length < 2) return false;
  if (!(RE_ACENTO.test(s) || /\s/.test(s))) return false;
  const letras = (s.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) || []).length;
  if (letras / s.length < 0.5) return false; // mayoría no-letras: no es prosa
  if (pareceBootstrapOCss(s) && !/[:;#]/.test(s)) return false; // markup, no prosa
  return true;
}
// FALLBACK DEL DUEÑO (Cruce b, corrección) — `catch (err) { aviso(err.message
// || 'algo falló'); }` REPITE la frase de un `throw new Error('algo falló')`
// a propósito: es la red de seguridad de quien lanzó el error, no una copia
// ciega. Se reconoce por el contexto INMEDIATO antes de la cadena
// (`.message ||`) y se descarta SOLO si la frase tiene de verdad un
// `throw new Error(...)` en OTRO fichero (si no lo tiene en ningún sitio, no
// es un fallback de nadie: sigue contando).
const THROW_ERROR_RE = /throw\s+new\s+Error\s*\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g;
// «HAY DUEÑO Y NO SE USA» (Cruce b, corrección) — igual que en números: si la
// frase repetida es el VALOR de un `export const` en algún fichero, quien
// juzga necesita saberlo: ya hay un sitio para importarla y alguien escribió
// el literal a mano en vez de traerla.
const EXPORT_CONST_STR_RE = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g;
function extraerFrasesDeFichero({ file, raw }) {
  const src = blank(raw);
  const out = [];
  let m;
  STR_RE.lastIndex = 0;
  while ((m = STR_RE.exec(src))) {
    const s = (m[1] ?? m[2] ?? m[3] ?? '');
    if (!esFraseHumana(s)) continue;
    const antes = src.slice(Math.max(0, m.index - 40), m.index);
    out.push({ frase: s, esFallbackMessage: /\.\s*message\s*\|\|\s*$/.test(antes) });
  }
  return out;
}
function cruceFrases(entradasPorFichero) {
  const throwOwners = new Map(); // frase → Set(fichero con `throw new Error(frase)`)
  const constOwners = new Map(); // frase → 'NOMBRE (fichero)' de un export const
  for (const { file, raw } of entradasPorFichero) {
    const src = blank(raw);
    THROW_ERROR_RE.lastIndex = 0;
    let m;
    while ((m = THROW_ERROR_RE.exec(src))) {
      const frase = m[1] ?? m[2] ?? m[3] ?? '';
      if (!frase) continue;
      if (!throwOwners.has(frase)) throwOwners.set(frase, new Set());
      throwOwners.get(frase).add(file);
    }
    EXPORT_CONST_STR_RE.lastIndex = 0;
    while ((m = EXPORT_CONST_STR_RE.exec(src))) {
      const frase = m[2] ?? m[3] ?? m[4] ?? '';
      if (frase && !constOwners.has(frase)) constOwners.set(frase, `${m[1]} (${file})`);
    }
  }
  const porFrase = new Map(); // frase → Set(fichero)
  for (const { file, raw } of entradasPorFichero) {
    for (const { frase, esFallbackMessage } of extraerFrasesDeFichero({ file, raw })) {
      if (esFallbackMessage) {
        const dueños = throwOwners.get(frase);
        if (dueños && [...dueños].some(f => f !== file)) continue; // legítimo: fallback del dueño
      }
      if (!porFrase.has(frase)) porFrase.set(frase, new Set());
      porFrase.get(frase).add(file);
    }
  }
  const salida = [];
  for (const [frase, ficheros] of porFrase) {
    if (ficheros.size >= 2) {
      salida.push({ frase, ficheros: [...ficheros].sort(), dueño: constOwners.get(frase) || null });
    }
  }
  return salida.sort((a, b) => b.ficheros.length - a.ficheros.length || a.frase.localeCompare(b.frase));
}

// ════════════════════════════════════════════════════════════════════════
// (c) NÚMEROS MÁGICOS CON DUEÑO AUSENTE
// ════════════════════════════════════════════════════════════════════════
const EXCLUIDOS = new Set([0, 1, 2, 4, 8, 16, 32, 64, 100, 1000]);
function esCandidatoNumerico(valor, texto) {
  if (EXCLUIDOS.has(valor)) return false;
  if (/^0\.\d+$/.test(texto)) return true; // 0.xx
  return valor >= 100;
}
// `(?<![\w$.])` / `(?![\w$])` — un número de verdad, no el "2" de "h2" ni el
// resto de una versión "1.51.654". blankStrings() ya vació el CONTENIDO de
// cadenas y plantillas, así que un número dentro de un literal — incluido
// el caso de CSS-en-plantilla tipo `padding:${x}16px` — nunca llega aquí:
// ese es justo el hueco que pide excluir "números dentro de CSS-in-JS (px,
// %)", y en este repo (§3 estilos-de-actividad) el CSS vive en ficheros
// .css, nunca como texto JS, así que no hace falta una guarda aparte.
const NUM_RE = /(?<![\w$.])(\d+\.\d+|\d+)(?![\w$])/g;
const MULT_RE = /(\d+(?:\.\d+)?)\s*\*\s*(\d+(?:\.\d+)?)(?:\s*\*\s*(\d+(?:\.\d+)?))?/g;
// CÓDIGOS HTTP (Cruce c, corrección) — un literal con «pinta de código» (tres
// cifras, primera 1-5: 100-599) solo cuenta si aparece a ≤20 caracteres de la
// palabra «status» — así se distingue `if (status === 404)` (repetido de
// verdad, y ninguno de los cuatro módulos dueño puede ser DUEÑO de un código
// HTTP) de un 404/403/204 que apareciera SUELTO, que antes ensuciaba la
// lista con las 8 de 8 atribuciones que resultaron ruido.
function esCodigoHttpShape(valor) {
  return Number.isInteger(valor) && /^[1-5]\d\d$/.test(String(valor));
}
function cercaDePalabra(src, idx, palabra, distancia) {
  const desde = Math.max(0, idx - distancia);
  const hasta = Math.min(src.length, idx + distancia);
  return new RegExp(palabra, 'i').test(src.slice(desde, hasta));
}
function numerosDeFichero({ file, raw }) {
  const src = blankStrings(blank(raw));
  const out = [];
  let m;
  MULT_RE.lastIndex = 0;
  const cubiertos = new Set(); // índices ya contados como parte de una expresión
  while ((m = MULT_RE.exec(src))) {
    const partes = [m[1], m[2], m[3]].filter(Boolean).map(Number);
    if (partes.some(Number.isNaN)) continue;
    const valor = partes.reduce((a, b) => a * b, 1);
    const texto = [m[1], m[2], m[3]].filter(Boolean).join(' * ');
    if (esCandidatoNumerico(valor, texto) || partes.some(p => esCandidatoNumerico(p, String(p)))) {
      out.push({ texto, valor, esExpresion: true, line: lineaDe(raw, m.index) });
    }
    for (let k = m.index; k < m.index + m[0].length; k++) cubiertos.add(k);
  }
  NUM_RE.lastIndex = 0;
  while ((m = NUM_RE.exec(src))) {
    if (cubiertos.has(m.index)) continue; // ya contado dentro de una multiplicación
    const texto = m[1];
    const valor = Number(texto);
    if (!esCandidatoNumerico(valor, texto)) continue;
    if (esCodigoHttpShape(valor) && !cercaDePalabra(src, m.index, 'status', 20)) continue;
    out.push({ texto, valor, esExpresion: false, line: lineaDe(raw, m.index) });
  }
  return out.map(o => ({ ...o, file }));
}

// ── DUEÑOS: qué exporta cada uno de los cuatro módulos de límites ──
function evalNumericoSimple(expr) {
  if (!/^[\d.\s*]+$/.test(expr)) return null;
  const partes = expr.split('*').map(s => Number(s.trim()));
  if (partes.some(Number.isNaN)) return null;
  return partes.reduce((a, b) => a * b, 1);
}
function constantesDe(file, raw) {
  const src = blank(raw);
  const map = new Map(); // valor → 'NOMBRE (file)'
  const topRe = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g;
  let m;
  while ((m = topRe.exec(src))) {
    const expr = m[2].trim();
    if (/^\[[\s\S]*\]$/.test(expr)) {
      for (const parte of expr.slice(1, -1).split(',')) {
        const n = Number(parte.trim());
        if (!Number.isNaN(n) && !map.has(n)) map.set(n, `${m[1]} (${file})`);
      }
      continue;
    }
    const n = evalNumericoSimple(expr);
    if (n != null && !map.has(n)) map.set(n, `${m[1]} (${file})`);
  }
  // entradas de objeto: NOMBRE: NUM (* NUM)*  — cubre core/quotas.js (QUOTAS)
  const objRe = /(\w+)\s*:\s*((?:\d+(?:\.\d+)?)(?:\s*\*\s*\d+(?:\.\d+)?)*)/g;
  while ((m = objRe.exec(src))) {
    const n = evalNumericoSimple(m[2]);
    if (n != null && !map.has(n)) map.set(n, `${m[1]} (${file})`);
  }
  return map;
}
const MODULOS_DUEÑO = ['core/quotas.js', 'core/constants.js', 'core/timings.js', 'core/liveEnd.js'];
function mapaDueños() {
  const map = new Map();
  for (const f of MODULOS_DUEÑO) {
    if (!existsSync(join(ROOT, f))) continue;
    for (const [valor, nombre] of constantesDe(f, leer(f))) {
      if (!map.has(valor)) map.set(valor, nombre);
    }
  }
  return map;
}

// ATRIBUCIÓN DE DUEÑO (Cruce c, corrección) — «hay dueño y no se usa» solo se
// dice si el NOMBRE de la constante o el nombre de su MÓDULO aparece a ≤3
// líneas del literal: coincidir el VALOR no basta (733 puede ser cualquier
// cosa en cualquier fichero) — 8 de 8 atribuciones de la primera pasada eran
// ruido por esto exacto.
function partirDueño(dueñoRaw) {
  if (!dueñoRaw) return { nombre: null, modulo: null };
  const m = /^(\S+)\s*\((.+)\)$/.exec(dueñoRaw);
  return m ? { nombre: m[1], modulo: m[2] } : { nombre: dueñoRaw, modulo: null };
}
function cercaDelDueño(raw, line, nombre, modulo) {
  if (!raw || (!nombre && !modulo)) return false;
  const lines = raw.split('\n');
  const desde = Math.max(0, line - 1 - 3);
  const hasta = Math.min(lines.length, line - 1 + 3 + 1);
  const ventana = lines.slice(desde, hasta).join('\n');
  const moduloBase = modulo ? (modulo.split('/').pop() || '') : '';
  return (nombre && ventana.includes(nombre)) || (moduloBase && ventana.includes(moduloBase));
}
// IMPORTA DEL MÓDULO DUEÑO (Cruce c, sub-cruce nuevo) — el caso SPIN_DUR_MAX:
// un fichero que YA importa algo de `core/timings.js` y aun así escribe su
// literal a mano tiene la constante A MANO y no la usó — evidencia más
// fuerte que la coincidencia de valor, así que cuenta AUNQUE el literal
// aparezca en un solo fichero (el resto del cruce exige ≥2).
function importaDeModulo(file, raw, moduloFile) {
  const src = blank(raw);
  const re = /import\s*(?:\{[^}]*\}|[A-Za-z_$][\w$]*|\*\s+as\s+[A-Za-z_$][\w$]*)\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const especificador = m[1];
    if (!especificador.startsWith('.')) continue;
    const r = resolverImport(file, especificador);
    if (r && mismoFichero(r, moduloFile)) return true;
  }
  return false;
}
function cruceNumeros(entradasPorFichero, dueños) {
  const rawDe = new Map(entradasPorFichero.map(e => [e.file, e.raw]));
  const porTexto = new Map(); // texto → { valor, ocurrencias:[{file,line}] }
  for (const entrada of entradasPorFichero) {
    if (MODULOS_DUEÑO.includes(entrada.file)) continue; // los cuatro módulos dueño no cuentan como "repetido sin dueño"
    for (const n of numerosDeFichero(entrada)) {
      if (!porTexto.has(n.texto)) porTexto.set(n.texto, { valor: n.valor, ocurrencias: [] });
      porTexto.get(n.texto).ocurrencias.push({ file: n.file, line: n.line });
    }
  }
  const salida = [];
  for (const [texto, { valor, ocurrencias }] of porTexto) {
    const ficheros = [...new Set(ocurrencias.map(o => o.file))].sort();
    const dueñoRaw = dueños.get(valor) || null;
    const { nombre, modulo } = partirDueño(dueñoRaw);
    if (ficheros.length >= 2) {
      const dueño = dueñoRaw && ocurrencias.some(o => cercaDelDueño(rawDe.get(o.file), o.line, nombre, modulo))
        ? dueñoRaw : null;
      salida.push({ texto, valor, ficheros, dueño });
      continue;
    }
    // Un solo fichero: solo entra si ya importa del módulo dueño (sub-cruce).
    if (dueñoRaw && modulo) {
      const file = ficheros[0];
      if (importaDeModulo(file, rawDe.get(file), modulo)) {
        salida.push({ texto, valor, ficheros, dueño: dueñoRaw });
      }
    }
  }
  return salida.sort((a, b) => b.ficheros.length - a.ficheros.length || b.valor - a.valor);
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — fuentes SINTÉTICAS en memoria, nunca ficheros reales.
//   (a) dos "ficheros" con la MISMA función renombrada (variables cambiadas
//       de nombre, misma estructura) → similitud ~1, deben salir del cruce.
//       Y un caso NEGATIVO: la misma función, pero una la importa de la
//       otra por nombre → NO debe salir (ya comparten, no es copia).
//       Y un tercer caso: una función cuyo cuerpo es UN wrapper de firma
//       (`return renderXEditor(root, a, onChange, {…})`), repetida en dos
//       ficheros → NO debe salir (no es lógica, es la forma de registrar).
//       Y un cuarto: dos plantillas con el MISMO HTML fijo pero
//       interpolaciones DISTINTAS (`${x.y}` vs `${z.w.q}`) → NO deben dar
//       1,00 (antes daban, porque la plantilla entera era un solo `$s`).
//   (b) la misma frase de ≥25 caracteres en dos ficheros → debe salir; una
//       lista de clases Bootstrap con espacio y ≥25 caracteres → NO debe
//       salir (markup, no prosa) salvo que lleve `:`/`;`/`#` (CSS en línea,
//       sí cuenta); y `err.message || 'frase'` con un `throw new
//       Error('frase')` DUEÑO en otro fichero → no cuenta (fallback
//       legítimo), pero si la frase es además el valor de un `export const`
//       en algún fichero, se marca «hay dueño y no se usa».
//   (c) el mismo número "con pinta de límite" en dos ficheros → debe salir,
//       y si coincide con una constante ya EXPORTADA por uno de los cuatro
//       módulos dueño Y el nombre/módulo aparece cerca del literal, debe
//       decir quién es la dueña (si el nombre NO aparece cerca, NO debe
//       atribuirlo, aunque el valor coincida). Un código HTTP (404) sin la
//       palabra «status» cerca no cuenta; con ella cerca, sí. Y un literal
//       que coincide con una constante exportada, en un fichero que YA
//       importa de ese módulo, cuenta aunque aparezca en un solo fichero.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;

  // (a) positiva: misma lógica, nombres de variable distintos.
  const cuerpoA = `
    function calcularTotal(lista) {
      let suma = 0;
      for (const item of lista) {
        if (item.activo) {
          suma += item.valor * item.factor;
        }
      }
      return suma;
    }
  `;
  const cuerpoB = `
    function sumarTodo(coleccion) {
      let acumulado = 0;
      for (const elemento of coleccion) {
        if (elemento.activo) {
          acumulado += elemento.valor * elemento.factor;
        }
      }
      return acumulado;
    }
  `;
  const sinteticasA = [
    { file: 'zz-syn/uno.js', raw: cuerpoA },
    { file: 'zz-syn/dos.js', raw: cuerpoB },
  ];
  const resA = cruceFunciones(sinteticasA);
  if (!resA.some(r => r.similitud >= UMBRAL_FUNCIONES)) {
    console.log('  ❌ CONTRA-PRUEBA rota: dos funciones con la MISMA lógica y variables renombradas no salen como parecidas'); rotos++;
  }

  // (a) negativa: la misma pareja, pero "dos.js" IMPORTA "sumarTodo" desde
  // "uno.js" con ese nombre — ya comparten, no debe listarse.
  // Ficheros con OTRO nombre que los del caso positivo — `importsDe()` cachea
  // por ruta, y reutilizar 'zz-syn/dos.js' aquí devolvería el mapa de
  // imports (vacío) ya cacheado por el caso positivo de arriba.
  const cuerpoBImporta = `import { calcularTotal as sumarTodo } from './uno-import.js';\n` + cuerpoB;
  const sinteticasAImport = [
    { file: 'zz-syn/uno-import.js', raw: cuerpoA },
    { file: 'zz-syn/dos-import.js', raw: cuerpoBImporta },
  ];
  const resAImport = cruceFunciones(sinteticasAImport);
  if (resAImport.some(r => r.similitud >= UMBRAL_FUNCIONES)) {
    console.log('  ❌ CONTRA-PRUEBA rota: un import por nombre debería excluir el par (ya comparten, no es copia)'); rotos++;
  }

  // (a) negativa: dos wrappers de firma (una sola sentencia, una llamada)
  // repitiendo la MISMA forma en dos ficheros — no es lógica duplicada.
  const cuerpoWrapperA = `
    function renderNombreEditor(root, activity, onChange) {
      return renderCampoEditor(
        root,
        activity,
        onChange,
        { tipo: 'nombre', etiqueta: 'Nombre', obligatorio: true, maxLength: 80 },
      );
    }
  `;
  const cuerpoWrapperB = `
    function renderTituloEditor(root, activity, onChange) {
      return renderCampoEditor(
        root,
        activity,
        onChange,
        { tipo: 'titulo', etiqueta: 'Título', obligatorio: true, maxLength: 80 },
      );
    }
  `;
  const resAWrapper = cruceFunciones([
    { file: 'zz-syn/wrapper-uno.js', raw: cuerpoWrapperA },
    { file: 'zz-syn/wrapper-dos.js', raw: cuerpoWrapperB },
  ]);
  if (resAWrapper.length) {
    console.log('  ❌ CONTRA-PRUEBA rota: un wrapper de firma (una sola llamada reenviada) no debería entrar al cruce'); rotos++;
  }

  // (a) positiva: dos plantillas con el MISMO HTML fijo pero interpolaciones
  // DISTINTAS no deben dar 1,00 — antes la plantilla entera colapsaba a un
  // solo token `$s` y las dos funciones parecían idénticas.
  const cuerpoTplA = `
    function panelUno(x) {
      let extra = 1;
      extra += 2;
      extra += 3;
      extra += 4;
      return \`<a class="panel">\${x.y}</a>\`;
    }
  `;
  const cuerpoTplB = `
    function panelDos(z) {
      let extra = 1;
      extra += 2;
      extra += 3;
      extra += 4;
      return \`<b class="panel">\${z.w.q}</b>\`;
    }
  `;
  const resATpl = cruceFunciones([
    { file: 'zz-syn/tpl-uno.js', raw: cuerpoTplA },
    { file: 'zz-syn/tpl-dos.js', raw: cuerpoTplB },
  ]);
  if (resATpl.some(r => r.similitud >= UMBRAL_FUNCIONES)) {
    console.log('  ❌ CONTRA-PRUEBA rota: dos plantillas con HTML igual pero interpolaciones distintas no deberían dar 1,00'); rotos++;
  }

  // (b) positiva: la misma frase larga en dos ficheros.
  const frase = 'Cuando el tiempo se agote la ronda se cierra sola';
  const sinteticasB = [
    { file: 'zz-syn/tres.js', raw: `const AVISO = '${frase}';` },
    { file: 'zz-syn/cuatro.js', raw: `showToast("${frase}");` },
  ];
  const resB = cruceFrases(sinteticasB);
  if (!resB.some(r => r.frase === frase && r.ficheros.length === 2)) {
    console.log('  ❌ CONTRA-PRUEBA rota: la misma frase de UI en dos ficheros no sale como repetida'); rotos++;
  }

  // (b) negativa: una lista de clases Bootstrap (≥25 car., con espacio, sin
  // tilde/mayúscula/puntuación humana) en dos ficheros NO debe salir.
  const clases = 'btn btn-outline-secondary btn-sm rounded-pill';
  const resBBootstrap = cruceFrases([
    { file: 'zz-syn/nueve.js', raw: `const CLS = '${clases}';` },
    { file: 'zz-syn/diez.js', raw: `el.className = '${clases}';` },
  ]);
  if (resBBootstrap.some(r => r.frase === clases)) {
    console.log('  ❌ CONTRA-PRUEBA rota: una lista de clases Bootstrap no debería contar como frase de UI'); rotos++;
  }

  // (b) positiva: la MISMA cadena, pero con CSS en línea (`:`) — sí cuenta,
  // aunque sea toda minúsculas y sin tilde.
  const cssInline = 'color:#333333;padding:8px 12px;border-radius:6px';
  const resBCss = cruceFrases([
    { file: 'zz-syn/once.js', raw: `el.style.cssText = '${cssInline}';` },
    { file: 'zz-syn/doce.js', raw: `el.style.cssText = '${cssInline}';` },
  ]);
  if (!resBCss.some(r => r.frase === cssInline)) {
    console.log('  ❌ CONTRA-PRUEBA rota: CSS en línea con ":" copiado en dos ficheros debería seguir contando'); rotos++;
  }

  // (b) positiva: `err.message || 'frase'` con un `throw new Error('frase')`
  // DUEÑO en OTRO fichero → fallback legítimo, no cuenta como duplicado.
  const fraseError = 'No se pudo guardar la actividad en este momento';
  const resBFallback = cruceFrases([
    { file: 'zz-syn/duenio-error.js', raw: `throw new Error('${fraseError}');` },
    { file: 'zz-syn/llamador-uno.js', raw: `catch (err) { avisar(err.message || '${fraseError}'); }` },
    { file: 'zz-syn/llamador-dos.js', raw: `catch (err) { avisar(err.message || '${fraseError}'); }` },
  ]);
  if (resBFallback.some(r => r.frase === fraseError)) {
    console.log('  ❌ CONTRA-PRUEBA rota: el fallback de un error con dueño en otro fichero no debería contar como copia'); rotos++;
  }

  // (b) negativa (contra-prueba de la contra-prueba): la MISMA frase sin
  // ningún `throw new Error(...)` en ningún fichero SÍ debe contar — no es
  // fallback de nadie si nadie la lanza.
  const resBFallbackSinDueño = cruceFrases([
    { file: 'zz-syn/llamador-tres.js', raw: `catch (err) { avisar(err.message || '${fraseError}'); }` },
    { file: 'zz-syn/llamador-cuatro.js', raw: `catch (err) { avisar(err.message || '${fraseError}'); }` },
  ]);
  if (!resBFallbackSinDueño.some(r => r.frase === fraseError)) {
    console.log('  ❌ CONTRA-PRUEBA rota: sin un throw new Error real en ningún fichero, la frase repetida sí debería contar'); rotos++;
  }

  // (b) «hay dueño y no se usa»: la frase es el VALOR de un `export const`
  // en algún fichero — debe marcarse en el hallazgo.
  const fraseConst = 'Esta plantilla no admite más de veinte preguntas';
  const resBConst = cruceFrases([
    { file: 'zz-syn/dueño-const.js', raw: `export const AVISO_TOPE = '${fraseConst}';` },
    { file: 'zz-syn/copia-uno.js', raw: `mostrar('${fraseConst}');` },
    { file: 'zz-syn/copia-dos.js', raw: `mostrar('${fraseConst}');` },
  ]);
  const hallazgoBConst = resBConst.find(r => r.frase === fraseConst);
  if (!hallazgoBConst || hallazgoBConst.dueño !== 'AVISO_TOPE (zz-syn/dueño-const.js)') {
    console.log('  ❌ CONTRA-PRUEBA rota: una frase que YA es un export const en otro fichero debería marcarse "hay dueño y no se usa"'); rotos++;
  }

  // (c) positiva: mismo número "con pinta de límite" en dos ficheros, y uno
  // de ellos coincide con una constante que SÍ exporta un módulo dueño
  // sintético (probado aparte de los cuatro reales, para no depender de que
  // sigan teniendo ese valor exacto mañana).
  const sinteticasC = [
    { file: 'zz-syn/cinco.js', raw: 'const tope = 733; // ZZ_TOPE' },
    { file: 'zz-syn/seis.js', raw: 'if (bytes > 733) return false;' },
  ];
  const resC = cruceNumeros(sinteticasC, new Map([[733, 'ZZ_TOPE (zz-syn/dueño.js)']]));
  const hallazgoC = resC.find(r => r.valor === 733);
  if (!hallazgoC) {
    console.log('  ❌ CONTRA-PRUEBA rota: el mismo número mágico en dos ficheros no sale como repetido'); rotos++;
  } else if (hallazgoC.dueño !== 'ZZ_TOPE (zz-syn/dueño.js)') {
    console.log('  ❌ CONTRA-PRUEBA rota: un número que coincide con una constante EXPORTADA, con su nombre cerca, debería señalar a su dueña'); rotos++;
  }

  // (c) negativa: el MISMO valor coincide con una constante exportada, pero
  // el nombre de la constante (ni el de su módulo) aparece cerca del
  // literal en NINGUNO de los ficheros → coincidir el valor no basta.
  const resCLejos = cruceNumeros([
    { file: 'zz-syn/quince.js', raw: 'const limite = 900;' },
    { file: 'zz-syn/dieciseis.js', raw: 'if (n > 900) return false;' },
  ], new Map([[900, 'ZZ_OTRO (zz-syn/dueño-otro.js)']]));
  const hallazgoCLejos = resCLejos.find(r => r.valor === 900);
  if (!hallazgoCLejos) {
    console.log('  ❌ CONTRA-PRUEBA rota: el número repetido debería seguir saliendo aunque no se atribuya dueño'); rotos++;
  } else if (hallazgoCLejos.dueño) {
    console.log('  ❌ CONTRA-PRUEBA rota: sin el nombre/módulo del dueño a ≤3 líneas, no debería atribuirse (coincidir el valor no basta)'); rotos++;
  }

  // (c) negativa: los excluidos (100, 1000, potencias de 2 ≤64) no deben
  // aparecer aunque se repitan.
  const sinteticasCNeg = [
    { file: 'zz-syn/siete.js', raw: 'const a = 100; const b = 32;' },
    { file: 'zz-syn/ocho.js', raw: 'const a = 100; const b = 32;' },
  ];
  const resCNeg = cruceNumeros(sinteticasCNeg, new Map());
  if (resCNeg.length) {
    console.log('  ❌ CONTRA-PRUEBA rota: 100 y 32 (potencia de 2 ≤64) deberían estar excluidos'); rotos++;
  }

  // (c) códigos HTTP: sin "status" cerca, ruido — no debe contar aunque se
  // repita en dos ficheros; con "status" cerca, sí es un hallazgo real.
  const resCHttpLejos = cruceNumeros([
    { file: 'zz-syn/http-uno.js', raw: 'const code = 404;' },
    { file: 'zz-syn/http-dos.js', raw: 'const code = 404;' },
  ], new Map());
  if (resCHttpLejos.some(r => r.valor === 404)) {
    console.log('  ❌ CONTRA-PRUEBA rota: un código HTTP (404) sin la palabra "status" cerca no debería contar'); rotos++;
  }
  const resCHttpCerca = cruceNumeros([
    { file: 'zz-syn/http-tres.js', raw: 'if (status === 404) return null;' },
    { file: 'zz-syn/http-cuatro.js', raw: 'if (status === 404) return null;' },
  ], new Map());
  if (!resCHttpCerca.some(r => r.valor === 404)) {
    console.log('  ❌ CONTRA-PRUEBA rota: un código HTTP (404) CON la palabra "status" cerca sí debería contar'); rotos++;
  }

  // (c) sub-cruce nuevo: un literal que coincide con una constante EXPORTADA
  // en un fichero que YA importa algo de ESE módulo — cuenta aunque el
  // literal aparezca en UN solo fichero (caso SPIN_DUR_MAX).
  const resCImporta = cruceNumeros([
    { file: 'zz-syn/usa-timings.js',
      raw: `import { OTRA_COSA } from './zz-syn-modulo-timings.js';\nconst dur = 850;` },
  ], new Map([[850, 'SPIN_DUR_MAX (zz-syn/zz-syn-modulo-timings.js)']]));
  const hallazgoImporta = resCImporta.find(r => r.valor === 850);
  if (!hallazgoImporta) {
    console.log('  ❌ CONTRA-PRUEBA rota: un literal que coincide con una constante exportada, en un fichero que ya importa de ese módulo, debería contar aunque esté en un solo fichero'); rotos++;
  } else if (hallazgoImporta.dueño !== 'SPIN_DUR_MAX (zz-syn/zz-syn-modulo-timings.js)') {
    console.log('  ❌ CONTRA-PRUEBA rota: el sub-cruce de import debería señalar al dueño'); rotos++;
  }
  // (c) negativa: el mismo literal en UN fichero que NO importa nada de ese
  // módulo no debería contar — es la evidencia del import lo que lo cuela.
  const resCSinImportar = cruceNumeros([
    { file: 'zz-syn/no-importa.js', raw: 'const dur = 850;' },
  ], new Map([[850, 'SPIN_DUR_MAX (zz-syn/zz-syn-modulo-timings.js)']]));
  if (resCSinImportar.length) {
    console.log('  ❌ CONTRA-PRUEBA rota: un literal en un solo fichero que NO importa del módulo dueño no debería contar'); rotos++;
  }

  return rotos;
}

// ════════════════════════════════════════════════════════════════════════
// SALIDA
// ════════════════════════════════════════════════════════════════════════
const rotosContraPrueba = contraPrueba();
if (rotosContraPrueba) {
  console.log(`\n❌ ${rotosContraPrueba} contra-prueba(s) rota(s) — no se confía en el resto de la salida.`);
  process.exit(2);
}

const entradasTodas = FICHEROS_TODAS.map(file => ({ file, raw: leer(file) }));
const entradasNumeros = FICHEROS_NUMEROS.map(file => ({ file, raw: leer(file) }));
const DUEÑOS = mapaDueños();

const hallazgosFunciones = cruceFunciones(entradasTodas);
const hallazgosFrases = cruceFrases(entradasTodas);
const hallazgosNumeros = cruceNumeros(entradasNumeros, DUEÑOS);

// BASELINE — números de la ÚLTIMA pasada tras las correcciones de los tres
// cruces (2026-09-02: desazucarar plantillas + excluir wrappers de firma en
// (a); excluir Bootstrap/CSS + reconocer el fallback del dueño + "hay dueño
// y no se usa" en (b); exigir "status" cerca para los códigos HTTP + exigir
// proximidad real para la atribución + el sub-cruce de import en (c)).
// RATCHET: solo puede BAJAR. Si un cruce supera su número, código 1: se
// escribió la misma regla otra vez y hay que decidir (misma regla / parecido
// de forma / misma frase) — nunca subir el número para callar al script.
// Los que quedan dentro del baseline, con motivo (veredicto humano
// pendiente, no arreglado aquí — este barrido solo LISTA):
//   a·5  — 3 parejas de EDITORES gemelos (match/memory, wheel/question-live)
//          con la MISMA forma de armar su panel (no wrappers de una sola
//          llamada: tienen lógica propia repetida) — candidatas a un
//          helper compartido, veredicto pendiente del dueño.
//   b·1  — "No se pudo leer la imagen." en core/upload.js y views/vsView.js:
//          mismo aviso de error, sin una constante compartida.
//   c·26 — mayoría son literales SIN dueño posible en los 4 módulos límite
//          (duraciones de animación/confeti, tamaños de miniatura, códigos
//          HTTP genuinamente cerca de `status`) — quien juzgue decide caso
//          a caso si alguno merece subir a core/timings.js.
const BASELINE = { funciones: 5, frases: 1, numeros: 26 };

const excedeFunciones = hallazgosFunciones.length > BASELINE.funciones;
const excedeFrases = hallazgosFrases.length > BASELINE.frases;
const excedeNumeros = hallazgosNumeros.length > BASELINE.numeros;

if (asJson) {
  console.log(JSON.stringify({
    funciones: hallazgosFunciones.map(h => ({
      similitud: Number(h.similitud.toFixed(2)),
      a: h.a, b: h.b,
    })),
    frases: hallazgosFrases,
    numeros: hallazgosNumeros,
    baseline: BASELINE,
  }, null, 2));
  process.exit((excedeFunciones || excedeFrases || excedeNumeros) ? 1 : 0);
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);
const coma = (n) => n.toFixed(2).replace('.', ',');

console.log('COSTURAS · B5 — la misma regla escrita dos veces (semántico, no textual)\n');

console.log('── a · funciones parecidas entre ficheros distintos (umbral ' + coma(UMBRAL_FUNCIONES) + ') ──');
if (hallazgosFunciones.length > BASELINE.funciones) mal(`${hallazgosFunciones.length} par(es) (baseline ${BASELINE.funciones}):`);
else ok(`${hallazgosFunciones.length} par(es) (baseline ${BASELINE.funciones})`);
for (const h of hallazgosFunciones) {
  console.log(`     ${h.a.file}:${h.a.line} ${h.a.nombre} ↔ ${h.b.file}:${h.b.line} ${h.b.nombre} · ${coma(h.similitud)}`);
}

console.log('\n── b · frases de UI repetidas (≥25 car., ≥2 ficheros) ──');
if (hallazgosFrases.length > BASELINE.frases) mal(`${hallazgosFrases.length} frase(s) (baseline ${BASELINE.frases}):`);
else ok(`${hallazgosFrases.length} frase(s) (baseline ${BASELINE.frases})`);
for (const h of hallazgosFrases) {
  const dueño = h.dueño ? ` · ¡hay dueño y no se usa!: ${h.dueño}` : '';
  console.log(`     "${h.frase}" · ${h.ficheros.join(', ')}${dueño}`);
}

console.log('\n── c · números mágicos con dueño ausente (core/views/templates) ──');
if (hallazgosNumeros.length > BASELINE.numeros) mal(`${hallazgosNumeros.length} número(s) (baseline ${BASELINE.numeros}):`);
else ok(`${hallazgosNumeros.length} número(s) (baseline ${BASELINE.numeros})`);
for (const h of hallazgosNumeros) {
  const dueño = h.dueño ? ` · ¡hay dueño y no se usa!: ${h.dueño}` : '';
  console.log(`     ${h.texto} · ${h.ficheros.join(', ')}${dueño}`);
}

const total = hallazgosFunciones.length + hallazgosFrases.length + hallazgosNumeros.length;
const baseTotal = BASELINE.funciones + BASELINE.frases + BASELINE.numeros;
console.log(`\nB5: ${total} hallazgo(s) (baseline ${baseTotal})`);

if (excedeFunciones || excedeFrases || excedeNumeros) {
  console.log('❌ algún cruce superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);

// ════════════════════════════════════════════════════════════════════════
// NOTA DE FALSOS POSITIVOS Y LÍMITES ACOTADOS (primera pasada, antes de
// fijar BASELINE) — siguiendo la disciplina de los otros tres barridos de
// costuras:
//
//  · (a) — los SHELLS/PLAYERS avisados en el encargo («estructura parecida
//    sin ser la misma regla») SÍ tienen forma común (montan `state`, piden
//    `ctx.item`, llaman `submit()`), pero con 6 líneas de cuerpo y k=8 el
//    umbral 0,7 exige que CASI todos los tokens del cuerpo coincidan en el
//    mismo orden — la forma común de un shell no llega a eso porque el
//    NOMBRE del método cambia entre sí (se compara cuerpo, no firma) pero
//    la LÓGICA de negocio interna (qué campo se lee, qué se compara) es
//    distinta de una plantilla a otra. Si al ejecutar salen decenas de
//    pares "shell contra shell" sin relación real, el umbral sube a 0,8 y
//    se documenta aquí con el número exacto de antes/después.
//  · (a) — un `function(...)` ANÓNIMO (IIFE, callback sin nombre) NO se
//    extrae: el heurístico solo captura funciones con NOMBRE (declaración,
//    variable asignada o método) porque un cuerpo sin nombre no da un
//    `fichero:línea nombre` legible en la lista de salida, y es la forma
//    minoritaria en este repo (vanilla ES modules, sin callbacks masivos).
//  · (a) — un arrow de CUERPO CONCISO (`x => algo`) sin llaves no se
//    extrae aunque tenga lógica: en la práctica ninguno del repo llega a
//    6 líneas sin usar bloque, así que el hueco es teórico, no real.
//  · (b) — las frases de ayuda del editor que el encargo avisaba que
//    «deberían venir de un helper» (bloque «Tiempo», notas de alcance por
//    plantilla) SON un hallazgo REAL si aparecen — no se han excluido a
//    propósito, al contrario del resto de falsos positivos de esta nota.
//  · (b) — un HTML armado por concatenación (`html\`<div>${x}</div>\``)
//    con interpolación se descarta ENTERO (guarda `${`): la mitad fija de
//    esas plantillas puede repetirse (dos vistas con el mismo `<div
//    class="…">` alrededor de contenido distinto) sin ser la misma REGLA,
//    solo el mismo trozo de maquetación — eso lo vigila el barrido de CSS/
//    cableado (B4), no este.
//  · (c) — `MULT_RE` también cuenta cada operando SUELTO como candidato si
//    por sí mismo pasa el filtro (p.ej. `200 * 1024`: 200 no llega a 100×2
//    real pero si apareciera repetido aparte también se lista) — es
//    intencional: un número mágico puede repetirse tanto DENTRO de una
//    multiplicación como fuera de ella, y son la misma "pinta de límite".
//  · (c) — no se persigue la guarda "número dentro de CSS-in-JS (px, %)"
//    con una regla aparte: en este repo el CSS vive siempre en ficheros
//    `.css` (contrato §3, `docs/estilos-de-actividad.md`), nunca como
//    texto de plantilla JS — así que blanquear el CONTENIDO de las cadenas
//    antes de buscar números (`blankStrings`) ya cierra ese hueco sin
//    necesitar una guarda extra que en la práctica nunca dispararía.
//  · (c) — FALSO POSITIVO CONOCIDO, no filtrado a propósito: 400/401/403/
//    404/204 salen como "número mágico repetido" porque son códigos de
//    estado HTTP (`if (status === 404)` en `core/pbHttp.js`,
//    `core/auth.js`…), no un límite del sistema — no tienen dueño posible
//    en `core/quotas.js`/`constants.js`/`timings.js`/`liveEnd.js` porque no
//    son ESE tipo de número. El barrido no distingue "código HTTP" de
//    "número mágico" (sería adivinar semántica por el nombre de la
//    variable de al lado, justo lo que este script evita en todo lo
//    demás) — se deja en la lista para que quien juzgue lo marque
//    `legítimo (código HTTP, no un límite)` de un vistazo, en vez de
//    enseñarle al script a reconocer "403" como especial y esconder un
//    403 que SÍ fuera un límite disfrazado.
// ════════════════════════════════════════════════════════════════════════
