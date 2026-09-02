// COSTURAS · B4 — CABLEADO SIN EXTREMO (docs/handoff-costuras.md §1 B4).
//
// Cuatro cruces escritor×lector sobre lo que conecta JS con HTML/eventos/
// localStorage. Ninguno arregla nada: cada uno produce una LISTA para que
// otro agente (o el dueño) diga `basura` / `conectar` / `legítimo` por
// entrada (plantilla de veredicto en docs/handoff-costuras.md §3).
//
//   1. HANDLER SIN HTML   — `on(root,'ev','.sel',fn)` / querySelector(All) /
//      getElementById con selector LITERAL cuyo token (clase/id/atributo)
//      no aparece pintado en ningún literal del repo.
//   2. PINTADO QUE NADIE TOCA — `id="x"` / `data-ww-*` en HTML generado, sin
//      `getElementById`/`#x`/`[data-ww-*]`/`dataset.wwX` en ningún .js.
//   3. EVENTOS DE JUEGO — cada `GameEvents.X`: ¿alguien emite? ¿alguien
//      escucha? (mira core/gameEvents.js + core/effects.js + core/sounds.js
//      para los patrones reales de oyente antes de fijarlos aquí).
//   4. CLAVES `ww.*`     — cada literal `'ww.xxx'`: ¿hay lsSet Y lsGet?
//
// Estilo: como tools/auditoria.mjs — ✅/❌ por cruce, baseline-ratchet (solo
// puede BAJAR), contra-prueba con entrada sintética plantada a propósito.
//
//   node tools/costuras-cableado.mjs           # salida legible
//   node tools/costuras-cableado.mjs --json    # las 4 listas en JSON (para que otro agente juzgue)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');

// Comentarios FUERA antes de extraer claves/eventos (mismo truco que
// core/normsCheck.js): `docs/handoff-costuras.md` habla DE 'ww.skin' y
// `GameEvents.X` en prosa dentro de comentarios de código real — sin esto,
// cada mención en un comentario ("ww.skin se leía sin que nadie la
// escribiera") se cuela como si fuera una clave/evento de verdad. Conserva
// saltos de línea para no descuadrar los números de línea.
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
const cacheSinComentarios = new Map();
function leerSinComentarios(f) {
  if (!cacheSinComentarios.has(f)) cacheSinComentarios.set(f, blank(leer(f)));
  return cacheSinComentarios.get(f);
}

// BASELINE — números de la PRIMERA pasada (2026-09-02). Es un RATCHET: solo
// puede bajar. Si un cruce supera su número, el script sale con código 1 —
// alguien añadió cableado nuevo sin extremo y hay que decidir (basura o
// conectar), no subir el número para callar al script.
const BASELINE = { handlers: 3, pintados: 24, eventos: 3, claves: 20 };

/** Camina un directorio y devuelve rutas relativas que pasen el filtro. */
function walk(dir, filtro, acc = []) {
  if (!existsSync(join(ROOT, dir))) return acc;
  for (const e of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${e}`;
    if (['node_modules', '.git', 'vendor', 'assets'].includes(e)) continue;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, filtro, acc);
    else if (filtro(rel)) acc.push(rel);
  }
  return acc;
}

// El barrido (dónde se busca HANDLERS/selectores): las 4 capas de código +
// los 4 HTML de raíz que sirve la web (test.html es un arnés, no producto).
const DIRS_JS = ['core', 'views', 'templates', 'kernel'];
const HTML_RAIZ = ['index.html', 'teacher.html', 'student.html', 'embed.html'].filter(f => existsSync(join(ROOT, f)));

function ficherosJs() {
  const acc = [];
  for (const d of DIRS_JS) walk(d, (p) => p.endsWith('.js'), acc);
  return acc;
}

// El corpus de "qué está PINTADO": donde se busca si un token aparece en
// algún literal. Se amplía a `adapters/` porque algún HTML se arma ahí
// también (tarjetas, previews) — más ficheros barridos, menos falsos
// positivos de "huérfano" por mirar en el sitio equivocado.
function ficherosPintado() {
  const acc = [...ficherosJs()];
  walk('adapters', (p) => p.endsWith('.js'), acc);
  return [...new Set(acc)];
}

// Antes de meter un fichero en el corpus de "¿está pintado?", se le BORRAN
// las propias llamadas que DEFINEN un selector (on/querySelector/
// getElementById) — si no, ".zz-selector" cuenta como "pintado" porque va
// precedido de un punto DENTRO DE SU PROPIA DEFINICIÓN, y el cruce 1 nunca
// encontraría nada (el bug que rompió la contra-prueba en la primera pasada
// de este script). Blanquear con espacios conserva longitudes/líneas.
function limpiarDefinicionesDeSelector(src) {
  let out = src;
  for (const re of [RE_ON, RE_QS, RE_GBI]) out = out.replace(re, (m) => ' '.repeat(m.length));
  return out;
}

/** Construye el corpus de texto donde se busca si un token está "pintado".
 *  Un espacio inicial hace que la posición 0 tenga un carácter delimitador
 *  delante (evita tener que meter `^` dentro del lookbehind). */
function construirCorpus(ficheros, { limpiar = false } = {}) {
  let out = ' ';
  for (const f of ficheros) {
    const src = leer(f);
    out += (limpiar ? limpiarDefinicionesDeSelector(src) : src) + '\n';
  }
  for (const f of HTML_RAIZ) out += leer(f) + '\n'; // los HTML de raíz no definen selectores JS
  return out;
}

/** ¿Aparece `token` en `corpus` dentro de "algo que parece un literal"?
 *  Regla deliberadamente LAXA (mejor un falso negativo que 200 falsos
 *  positivos, pedido en la tarea): basta con que vaya precedido de espacio,
 *  comilla, `.`, `#` o `${` y seguido de un delimitador razonable. Cubre
 *  `class="…x…"`, `id="x"`, `data-x=`, `classList.add('x')`,
 *  `className = '…x…'` Y cualquier HTML armado por concatenación, sin tener
 *  que reconocer cada forma una por una. */
function pintado(token, corpus) {
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // `=` en la cola: los atributos van `data-x="…"` / `data-x=…`. Y `${` en la
  // cola: `class="btn loop-pick${l === loop ? …}"` — el nombre de clase pega
  // directo con el trozo dinámico, sin espacio, MUY habitual en este repo
  // (checked al final del `class=`). Sin estas dos colas, `data-src="${…}"`
  // y `loop-pick${…}` no contaban como "pintado" — huérfanos falsos reales
  // de la primera pasada de este script. Y `>` en la cola: atributos
  // BOOLEANOS sin valor (`data-calib>`, `<button … data-calib><i…`).
  const re = new RegExp(`(?<=[\\s'"\`.#]|\\$\\{)${esc}(?=[\\s'"\`.,=>)\\]};:]|\\$\\{|$)`);
  return re.test(corpus);
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);

// ════════════════════════════════════════════════════════════════════════
// CRUCE 1 · HANDLER SIN HTML
// ════════════════════════════════════════════════════════════════════════
// Extrae selectores de tres formas de enganche real vistas en el repo:
//   on(root, 'evento', '.sel', handler)          — core/events.js
//   algo.querySelector(All)('sel')
//   document.getElementById('id')
// Solo con selector LITERAL (comilla simple/doble, sin `${`) — un selector
// construido en runtime no se puede auditar estáticamente y forzarlo
// produciría basura, no señal.
const RE_ON = /\bon\(\s*[^,()]+,\s*'([a-zA-Z:]+)'\s*,\s*'([^'$]*)'/g;
const RE_QS = /\.querySelectorAll?\(\s*['"]([^'"$]+)['"]\s*\)/g;
const RE_GBI = /getElementById\(\s*['"`]([^'"`$]+)['"`]\s*\)/g;

// De un selector CSS (posiblemente compuesto: "#tm-count button") saca los
// tokens auditables: clases, ids, atributos data-*. Ignora nombres de
// etiqueta (button, div…) — no hay HTML "sin etiquetas" que auditar ahí.
function tokensDeSelector(sel) {
  const out = [];
  for (const m of sel.matchAll(/\.([\w-]+)/g)) out.push({ tipo: 'clase', token: m[1] });
  for (const m of sel.matchAll(/#([\w-]+)/g)) out.push({ tipo: 'id', token: m[1] });
  for (const m of sel.matchAll(/\[\s*(data-[\w-]+)/g)) out.push({ tipo: 'atributo', token: m[1] });
  return out;
}

function cruce1_handlerSinHtml() {
  const ficherosAudit = ficherosJs();
  const corpus = construirCorpus(ficherosPintado(), { limpiar: true });
  const hallazgos = [];
  for (const f of ficherosAudit) {
    const src = leer(f);
    const lineaDe = (idx) => src.slice(0, idx).split('\n').length;
    for (const re of [RE_ON]) {
      re.lastIndex = 0;
      for (const m of src.matchAll(re)) {
        for (const { tipo, token } of tokensDeSelector(m[2])) {
          if (!pintado(token, corpus)) {
            hallazgos.push({ tipo, token, evento: m[1], selector: m[2], file: f, line: lineaDe(m.index) });
          }
        }
      }
    }
    for (const re of [RE_QS]) {
      re.lastIndex = 0;
      for (const m of src.matchAll(re)) {
        for (const { tipo, token } of tokensDeSelector(m[1])) {
          if (!pintado(token, corpus)) {
            hallazgos.push({ tipo, token, evento: '(query)', selector: m[1], file: f, line: lineaDe(m.index) });
          }
        }
      }
    }
    RE_GBI.lastIndex = 0;
    for (const m of src.matchAll(RE_GBI)) {
      if (!/^[\w-]+$/.test(m[1])) continue; // ids con espacios no son ids reales
      if (!pintado(m[1], corpus)) {
        hallazgos.push({ tipo: 'id', token: m[1], evento: '(getElementById)', selector: `#${m[1]}`, file: f, line: lineaDe(m.index) });
      }
    }
  }
  return hallazgos;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 2 · PINTADO QUE NADIE TOCA
// ════════════════════════════════════════════════════════════════════════
// Cada `id="x"` / `data-ww-*` pintado en HTML (generado por JS o en los
// ficheros de raíz) → ¿algún .js lo toca?
const RE_ID_ATTR = /\bid=["']([\w-]+)["']/g;
const RE_FOR_ATTR = /\bfor=["']([\w-]+)["']/g;
const RE_DATA_WW = /\bdata-ww-([\w-]+)/g;
const PREFIJOS_EXCLUIDOS = ['tab-', 'collapse', 'aria-'];

function camelDeAtributo(sufijo) {
  // "ww-mode" → "wwMode" (así se lee en `el.dataset.wwMode`)
  return `ww-${sufijo}`.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function cruce2_pintadoSinTocar() {
  const ficherosPintan = ficherosPintado();
  const corpusPintado = construirCorpus(ficherosPintan); // dónde se declara id="x"/data-ww-*
  const corpusUso = construirCorpus(ficherosJs());        // dónde se BUSCA #x / [data-ww-*] / dataset.wwX
  const paraLabel = new Set();
  for (const m of corpusPintado.matchAll(RE_FOR_ATTR)) paraLabel.add(m[1]);

  const hallazgos = [];
  const vistos = new Set();
  const ficherosParaBarrer = [...ficherosPintan, ...HTML_RAIZ];
  for (const f of ficherosParaBarrer) {
    // Sin comentarios: un comentario que MENCIONA `id="x"` como ejemplo no es
    // HTML real pintado (mismo motivo que en el cruce 4).
    const src = f.endsWith('.html') ? leer(f) : leerSinComentarios(f);
    const lineaDe = (idx) => src.slice(0, idx).split('\n').length;
    RE_ID_ATTR.lastIndex = 0;
    for (const m of src.matchAll(RE_ID_ATTR)) {
      const id = m[1];
      if (PREFIJOS_EXCLUIDOS.some(p => id.startsWith(p))) continue;
      if (paraLabel.has(id)) continue; // lo consume un <label for="…">, legítimo
      const clave = `id:${id}`;
      if (vistos.has(clave)) continue;
      // ¿lo toca algún .js? getElementById('id') o '#id' en un selector.
      const tocado = new RegExp(`getElementById\\(\\s*['"\`]${id}\\b`).test(corpusUso)
        || pintado(id, ` #${id} `); // reusa el detector laxo sobre un mini-corpus con el propio "#id"
      const tocadoReal = new RegExp(`getElementById\\(\\s*['"\`]${id}['"\`]`).test(corpusUso)
        || corpusUso.includes(`#${id}`);
      if (!tocadoReal) { vistos.add(clave); hallazgos.push({ tipo: 'id', token: id, file: f, line: lineaDe(m.index) }); }
      else vistos.add(clave);
    }
    RE_DATA_WW.lastIndex = 0;
    for (const m of src.matchAll(RE_DATA_WW)) {
      const attr = `ww-${m[1]}`;
      const clave = `data:${attr}`;
      if (vistos.has(clave)) continue;
      const camel = camelDeAtributo(m[1]);
      const tocado = corpusUso.includes(`[data-${attr}`) || corpusUso.includes(`dataset.${camel}`)
        || corpusUso.includes(`dataset['${camel}']`) || corpusUso.includes(`dataset["${camel}"]`)
        || corpusUso.includes(`data-${attr}=`);
      if (!tocado) { vistos.add(clave); hallazgos.push({ tipo: 'data-ww', token: `data-${attr}`, file: f, line: lineaDe(m.index) }); }
      else vistos.add(clave);
    }
  }
  return hallazgos;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 3 · EVENTOS DE JUEGO (GameEvents)
// ════════════════════════════════════════════════════════════════════════
function claveGameEvents() {
  const src = leerSinComentarios('core/gameEvents.js');
  const m = src.match(/GameEvents\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);?/);
  const body = m ? m[1] : '';
  const claves = [];
  for (const mm of body.matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*:/gm)) claves.push(mm[1]);
  return claves;
}

function cruce3_eventosJuego() {
  const ficherosAudit = [...ficherosJs(), ...(existsSync(join(ROOT, 'adapters')) ? walk('adapters', (p) => p.endsWith('.js')) : [])];
  const claves = claveGameEvents();
  const registros = [];
  for (const clave of claves) {
    let emisores = [], oyentes = [];
    for (const f of ficherosAudit) {
      const src = leerSinComentarios(f);
      const lineaDe = (idx) => src.slice(0, idx).split('\n').length;
      // EMITEN: emitGame(GameEvents.X  ·  emit(GameEvents.X
      for (const m of src.matchAll(new RegExp(`\\bemit(?:Game)?\\(\\s*GameEvents\\.${clave}\\b`, 'g'))) {
        emisores.push(`${f}:${lineaDe(m.index)}`);
      }
      // ESCUCHAN: onGame(GameEvents.X · on(GameEvents.X · [GameEvents.X]: · case GameEvents.X
      const RE_OYE = new RegExp(`\\bon(?:Game)?\\(\\s*GameEvents\\.${clave}\\b|\\[\\s*GameEvents\\.${clave}\\s*\\]\\s*:|\\bcase\\s+GameEvents\\.${clave}\\b`, 'g');
      for (const m of src.matchAll(RE_OYE)) {
        oyentes.push(`${f}:${lineaDe(m.index)}`);
      }
    }
    registros.push({ evento: clave, emisores, oyentes });
  }
  return registros;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 4 · CLAVES `ww.*`
// ════════════════════════════════════════════════════════════════════════
const RE_WW_LITERAL = /['"`](ww\.[A-Za-z0-9_.]*)/g;

// El literal casi nunca va PEGADO a lsSet/lsGet: el patrón real del repo es
// `const CLAIM_FLAG = 'ww.activities.claimed'` en un sitio y `lsSet(CLAIM_FLAG, …)`
// en otro (ver core/storage.js) — comprobar "¿el literal es el argumento
// literal de lsSet?" da falso-huérfano en case casi todos (probado: con esa
// regla, 32 de 35 claves salían "nunca se escribe", que es obviamente falso:
// core/storage.js SÍ escribe). Por eso el cruce se hace a nivel de MÓDULO,
// igual que el modelo de dueño único de LS_OWNERS: la clave está "conectada"
// si el/los ficheros donde aparece el literal contienen TAMBIÉN una llamada
// lsSet/lsGet en cualquier parte (aunque sea vía variable) — menos preciso
// que "la misma línea", pero evita los ~30 falsos positivos de indirección.
function cruce4_clavesWw() {
  const ficherosAudit = [...ficherosJs(), ...(existsSync(join(ROOT, 'adapters')) ? walk('adapters', (p) => p.endsWith('.js')) : [])];
  const porClave = new Map(); // clave → Set<fichero> donde aparece el literal
  for (const f of ficherosAudit) {
    for (const m of leerSinComentarios(f).matchAll(RE_WW_LITERAL)) {
      if (!porClave.has(m[1])) porClave.set(m[1], new Set());
      porClave.get(m[1]).add(f);
    }
  }
  const registros = [];
  for (const clave of [...porClave.keys()].sort()) {
    let set = false, get = false, del = false;
    for (const f of porClave.get(clave)) {
      const src = leerSinComentarios(f);
      if (/\blsSet\s*\(/.test(src)) set = true;
      if (/\blsGet(?:JsonArray)?\s*\(/.test(src)) get = true;
      if (/\blsDel\s*\(/.test(src)) del = true;
    }
    registros.push({ clave, set, get, del, ficheros: [...porClave.get(clave)] });
  }
  return registros;
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — un fuente sintético con un handler y un evento que NADIE
// pinta/escucha; si el barrido no los ve, el detector está roto y no vale
// confiar en su verde (mismo principio que tools/auditoria.mjs).
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;
  // Cruce 1: un handler cuyo selector no aparece pintado en ningún sitio.
  {
    const fuenteFalso = "on(APP, 'click', '.zz-nadie-me-pinta', () => {});\n";
    const corpusFalso = ' ' + limpiarDefinicionesDeSelector(fuenteFalso); // ningún HTML lo pinta
    const m = [...fuenteFalso.matchAll(RE_ON)][0];
    if (!m) { console.log('  ❌ CONTRA-PRUEBA rota: RE_ON no ve el handler sintético'); rotos++; }
    else {
      const toks = tokensDeSelector(m[2]);
      const detectado = toks.some(({ token }) => !pintado(token, corpusFalso));
      if (!detectado) { console.log('  ❌ CONTRA-PRUEBA rota: cruce 1 no detecta el selector huérfano plantado'); rotos++; }
    }
  }
  // Cruce 3: un GameEvents.ZZ_INVENTADO que ni se emite ni se escucha en el
  // corpus real — comprobamos que el patrón, aplicado al corpus REAL, da 0/0.
  {
    const ficherosAudit = ficherosJs();
    let vistos = 0;
    for (const f of ficherosAudit) {
      const src = leer(f);
      if (/GameEvents\.ZZ_EVENTO_INVENTADO\b/.test(src)) vistos++;
    }
    if (vistos !== 0) { console.log('  ❌ CONTRA-PRUEBA rota: el evento inventado aparece en el repo real (imposible)'); rotos++; }
    // y la contra-prueba positiva: el patrón SÍ debe encontrar un caso real conocido (QUESTION_SHOWN, emitido y escuchado)
    const src = leer('core/soloPlayer.js') + leer('core/sounds.js');
    const emiteReal = /\bemit(?:Game)?\(\s*GameEvents\.QUESTION_SHOWN\b/.test(leer('core/soloPlayer.js'));
    const oyeReal = /\bon(?:Game)?\(\s*GameEvents\.QUESTION_SHOWN\b/.test(leer('core/sounds.js'));
    if (!emiteReal || !oyeReal) { console.log('  ❌ CONTRA-PRUEBA rota: cruce 3 no ve un emisor/oyente real conocido (QUESTION_SHOWN)'); rotos++; }
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

const h1 = cruce1_handlerSinHtml();
const h2 = cruce2_pintadoSinTocar();
const h3 = cruce3_eventosJuego();
const h4 = cruce4_clavesWw();

const h3malos = h3.filter(r => r.emisores.length === 0 || r.oyentes.length === 0);
const h4malos = h4.filter(r => !(r.set && r.get));

if (asJson) {
  console.log(JSON.stringify({ handlers: h1, pintados: h2, eventos: h3, claves: h4 }, null, 2));
  process.exit(0);
}

console.log('COSTURAS · B4 — cableado sin extremo\n');

console.log('── 1 · HANDLER SIN HTML (el selector no aparece pintado en ningún literal) ──');
if (h1.length) mal(`${h1.length} handler(es)/consulta(s) con selector huérfano (baseline ${BASELINE.handlers}):`);
else ok(`0 handlers huérfanos (baseline ${BASELINE.handlers})`);
for (const x of h1) console.log(`     ${x.tipo}:${x.token} · evento=${x.evento} · ${x.file}:${x.line}`);

console.log('\n── 2 · PINTADO QUE NADIE TOCA (id="x"/data-ww-* sin getElementById/#x/[data-ww-*]/dataset) ──');
if (h2.length) mal(`${h2.length} token(s) pintados sin lector (baseline ${BASELINE.pintados}):`);
else ok(`0 tokens sin lector (baseline ${BASELINE.pintados})`);
for (const x of h2) console.log(`     ${x.tipo}:${x.token} · ${x.file}:${x.line}`);

console.log('\n── 3 · EVENTOS DE JUEGO (GameEvents.X: emisores × oyentes) ──');
if (h3malos.length) mal(`${h3malos.length} evento(s) con 0 en algún lado (de ${h3.length} declarados, baseline ${BASELINE.eventos}):`);
else ok(`0 eventos con un lado en 0 (de ${h3.length} declarados, baseline ${BASELINE.eventos})`);
for (const r of h3) {
  const marca = (r.emisores.length === 0 || r.oyentes.length === 0) ? '❌' : '  ';
  console.log(`   ${marca} ${r.evento} · emisores=${r.emisores.length} · oyentes=${r.oyentes.length}`);
  if (r.emisores.length === 0 || r.oyentes.length === 0) {
    for (const e of r.emisores) console.log(`        emite:  ${e}`);
    for (const o of r.oyentes) console.log(`        oye:    ${o}`);
  }
}

console.log('\n── 4 · CLAVES `ww.*` (lsSet y lsGet, no solo una) ──');
if (h4malos.length) mal(`${h4malos.length} clave(s) solo-escritura o solo-lectura (de ${h4.length} claves, baseline ${BASELINE.claves}):`);
else ok(`0 claves desequilibradas (de ${h4.length} claves, baseline ${BASELINE.claves})`);
for (const r of h4malos) {
  const falta = !r.set ? 'nunca se escribe (lsSet)' : !r.get ? 'nunca se lee (lsGet)' : '';
  console.log(`     ${r.clave} · ${falta}${r.del ? ' · sí se borra (lsDel)' : ''} · ${r.ficheros.join(', ')}`);
}

const total = h1.length + h2.length + h3malos.length + h4malos.length;
const baseTotal = BASELINE.handlers + BASELINE.pintados + BASELINE.eventos + BASELINE.claves;
console.log(`\nB4: ${total} hallazgo(s) (baseline ${baseTotal})`);

const excede = h1.length > BASELINE.handlers || h2.length > BASELINE.pintados
  || h3malos.length > BASELINE.eventos || h4malos.length > BASELINE.claves;
if (excede) {
  console.log('❌ algún cruce superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);
