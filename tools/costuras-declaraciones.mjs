// COSTURAS · B1 — DECLARACIÓN SIN LECTOR (docs/handoff-costuras.md §1 B1).
//
// Tres cruces escritor×lector sobre lo que las 13 plantillas DECLARAN y sobre
// el esquema global de presentación/revisión. Ninguno arregla nada: cada uno
// produce una LISTA para que otro agente (o el dueño) diga `basura` /
// `conectar` / `legítimo` por entrada (plantilla de veredicto en
// docs/handoff-costuras.md §3).
//
//   1. `meta.*` DE LAS 13    — cada clave que alguna plantilla declara en su
//      `static meta` (aplanada: `play.vs`, `play.reloj.unidad`,
//      `editor.primerPaso`…) — ¿quién la LEE fuera de `templates/`?
//   2. `defaultRules/Scoring/Live` — cada CAMPO que alguna plantilla devuelve
//      en esas tres factorías — ¿quién lee `rules.X`/`scoring.X`/`live.X`?
//   3. `presentation.*` / `review.*` — el esquema GLOBAL (declarado una vez
//      en `core/constants.js`, `DEFAULT_PRESENTATION`/`DEFAULT_REVIEW`) — el
//      resto del repo, ¿lo lee?
//
// Estilo: como tools/costuras-cableado.mjs — ✅/❌ por cruce, baseline-ratchet
// (solo puede BAJAR), contra-prueba con entrada sintética plantada a propósito
// que debe salir sin lector (si no se detecta, código 2 — no se confía en el
// resto de la salida).
//
//   node tools/costuras-declaraciones.mjs           # salida legible
//   node tools/costuras-declaraciones.mjs --json    # las 3 listas en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Comentarios fuera antes de buscar lectores (mismo truco que
// core/normsCheck.js / costuras-cableado.mjs): un comentario que MENCIONA
// `meta.play.vs` en prosa (como este propio fichero, o CLAUDE.md-en-código) no
// es un lector real. Sin esto, cada docstring que explica una clave se cuela
// como si la leyera.
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
const cache = new Map();
function leerSinComentarios(f) {
  if (!cache.has(f)) cache.set(f, blank(leer(f)));
  return cache.get(f);
}

function walk(dir, acc = []) {
  if (!existsSync(join(ROOT, dir))) return acc;
  for (const e of readdirSync(join(ROOT, dir))) {
    if (['node_modules', '.git', 'vendor', 'assets'].includes(e)) continue;
    const rel = `${dir}/${e}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, acc);
    else if (e.endsWith('.js') || e.endsWith('.mjs')) acc.push(rel);
  }
  return acc;
}

// Ficheros de "juego/plataforma" — donde debería estar el LECTOR de verdad.
const DIRS_PLATAFORMA = ['core', 'views', 'kernel', 'adapters'];
function ficherosPlataforma() {
  const acc = [];
  for (const d of DIRS_PLATAFORMA) walk(d, acc);
  return acc;
}
function ficherosTemplates() {
  return walk('templates', []);
}

// Un fichero de EDITOR (el formulario del profe, no el juego): mismo patrón
// que tests/ajusteConectado.test.mjs (`esEditor`) para no inventar un segundo
// criterio de qué es "editor" en este repo.
const esEditor = (p) => /editor\.js$|editorPanels\.js$|editorModes\.js$|editorShell\.js$|editorPrimitives\.js$/.test(p);

// SOLO_EDITOR — claves de meta.* que LEGÍTIMAMENTE solo lee un editor (capa
// contenido↔editor, §0: el player nunca las necesita). No es una excepción
// silenciosa: sigue apareciendo en la salida como informativo, pero no
// cuenta como "sospechosa" ni infla el baseline. Motivo por clave, porque
// "solo lo lee un editor" sin más invita a colar aquí lo que sí falta conectar.
const SOLO_EDITOR = {
  iaPalabrasComoTexto: 'formato de contenido para la IA de generación (capa contenido↔editor, §0); el player nunca lo necesita',
};

// EXCEPCIONES DECLARADAS EN tests/ajusteConectado.test.mjs (`PERMITIDOS`) — no
// se duplica esa lista aquí: se PARSEA de su fuente y se respeta. Si algo ya
// está justificado allí ("se guarda y se muestra en el editor; falta pintarlo
// en el player"), este barrido no lo vuelve a acusar.
function permitidosAjenos() {
  const src = leer('tests/ajusteConectado.test.mjs');
  const m = src.match(/const PERMITIDOS = \{([\s\S]*?)\n\};/);
  if (!m) return new Set();
  const claves = new Set();
  for (const mm of m[1].matchAll(/'([\w.]+)'\s*:/g)) claves.add(mm[1]);
  return claves;
}
const PERMITIDOS_AJENOS = permitidosAjenos();

// ════════════════════════════════════════════════════════════════════════
// CARGA DE LAS 13 PLANTILLAS DE VERDAD — como tests/reloj.test.mjs: importar
// core/registerTemplates.js (efecto secundario: cada índice se auto-registra)
// y leer core/registry.js, en vez de parsear el fichero a regex. Un objeto
// literal con comentarios, comas finales y funciones anidadas es exactamente
// lo que un regex NO debería intentar parsear — y aquí no hace falta: el
// propio motor de plantillas ya sabe construir el objeto.
await import('../core/registerTemplates.js');
const { listTemplates } = await import('../core/registry.js');
const TODAS = listTemplates().filter(T => existsSync(join(ROOT, 'templates', String(T.meta?.name || ''))));
if (TODAS.length < 10) {
  console.log(`❌ CONTRA-PRUEBA rota: listTemplates() solo ve ${TODAS.length} plantillas reales (se esperaban 13) — no se confía en el resto.`);
  process.exit(2);
}

// ════════════════════════════════════════════════════════════════════════
// APLANAR meta.* — recorre el objeto, un leaf por clave compuesta
// ("play.reloj.unidad"). Las CUATRO factorías (defaultRules/Scoring/Live/
// Content/Presentation) son funciones: no son "meta.*", son el cruce 2 (y su
// prima defaultPresentation cae dentro del cruce 3 vía DEFAULT_PRESENTATION,
// mismas claves) — se excluyen aquí para no contarlas dos veces.
const FUNCIONES_APARTE = new Set(['defaultRules', 'defaultScoring', 'defaultLive', 'defaultContent', 'defaultPresentation']);

function aplanar(obj, prefijo = '', out = []) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (prefijo === '' && FUNCIONES_APARTE.has(k)) continue;
    if (typeof v === 'function') continue; // opciones con get/set (play.options[].get) no son "una clave leída"
    const path = prefijo ? `${prefijo}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) aplanar(v, path, out);
    else out.push(path);
  }
  return out;
}

// clave (dot-path) → Set de nombres de plantilla que la declaran
function clavesMeta(plantillas) {
  const porClave = new Map();
  for (const T of plantillas) {
    for (const path of aplanar(T.meta)) {
      if (!porClave.has(path)) porClave.set(path, new Set());
      porClave.get(path).add(T.meta.name);
    }
  }
  return porClave;
}

// ¿Quién LEE una clave compuesta ("play.reloj.unidad" → busca "reloj?.unidad",
// las DOS últimas piezas, que es lo que aparece de verdad tras
// `T.meta.play.reloj.unidad` / `m.play.reloj.unidad` / `a.presentation?.skin`).
// Con solo el ÚLTIMO segmento el patrón sería demasiado laxo para claves de
// una palabra común (ver nota de falsos positivos al final); con las DOS
// últimas, "reloj.unidad" o "editor.elemento" no se confunden con nada más
// del repo — se comprobó grep a mano contra cada clave antes de fijarlo.
function regexClave(path) {
  const segs = path.split('.');
  const ultimo = escRe(segs[segs.length - 1]);
  if (segs.length === 1) return new RegExp(`\\.${ultimo}\\b|\\[['"\`]${ultimo}['"\`]\\]`);
  const previo = escRe(segs[segs.length - 2]);
  return new RegExp(`\\b${previo}\\??\\.${ultimo}\\b`);
}

function lectoresDeClaveMeta(path, ficheros) {
  const re = regexClave(path);
  return ficheros.filter(f => re.test(leerSinComentarios(f)));
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 1 · meta.* de las 13
// ════════════════════════════════════════════════════════════════════════
function cruce1() {
  const porClave = clavesMeta(TODAS);
  const ficheros = ficherosPlataforma(); // fuera de templates/, según el encargo
  const registros = [];
  for (const [clave, quien] of [...porClave].sort((a, b) => a[0].localeCompare(b[0]))) {
    const lectores = lectoresDeClaveMeta(clave, ficheros);
    if (PERMITIDOS_AJENOS.has(clave)) continue;
    const soloEditor = lectores.length > 0 && lectores.every(esEditor);
    const exentoSoloEditor = soloEditor && Object.prototype.hasOwnProperty.call(SOLO_EDITOR, clave.split('.').pop());
    registros.push({
      clave, declaran: quien.size, plantillas: [...quien].sort(),
      lectores, soloEditor, exentoSoloEditor,
      sospechoso: (lectores.length === 0 || soloEditor) && !exentoSoloEditor,
    });
  }
  return registros;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 2 · defaultRules() / defaultScoring() / defaultLive()
// ════════════════════════════════════════════════════════════════════════
// campo agregado por (grupo.campo) a través de las 13 — el mismo `timer` de
// Quiz y el de Comas son "el mismo mando", así que se juzgan juntos.
const GRUPOS_DEFAULT = { defaultRules: 'rules', defaultScoring: 'scoring', defaultLive: 'live' };

function clavesDefault(plantillas) {
  const porClave = new Map(); // "rules.timer" → Set<template>
  for (const T of plantillas) {
    for (const [fn, grupo] of Object.entries(GRUPOS_DEFAULT)) {
      const factoria = T.meta?.[fn];
      if (typeof factoria !== 'function') continue;
      let obj;
      try { obj = factoria(); } catch { obj = {}; }
      for (const campo of Object.keys(obj || {})) {
        const k = `${grupo}.${campo}`;
        if (!porClave.has(k)) porClave.set(k, new Set());
        porClave.get(k).add(T.meta.name);
      }
    }
  }
  return porClave;
}

// Mismo patrón que `lectoresDe` de tests/ajusteConectado.test.mjs (probado y
// en producción): `grupo.campo` / `grupo?.campo` / el campo entre comillas
// (cubre `const { timer } = a.rules` seguido de un uso suelto de `timer`).
// La cola "entre comillas" es más laxa que la del cruce 1 A PROPÓSITO: aquí
// el grupo (rules/scoring/live) ya viene DADO por el objeto que la factoría
// devuelve, así que el riesgo de confundir "timer" con un timer ajeno es
// menor que el de un `.instructions` suelto — pero por eso mismo, cada
// hallazgo con 0 lectores de este cruce se comprobó a mano (ver nota final).
function regexCampo(grupo, campo) {
  const g = escRe(grupo), c = escRe(campo);
  return new RegExp(`\\.${g}\\??\\.${c}\\b|\\b${g}\\??\\.${c}\\b|['"\`]${c}['"\`]`);
}

function cruce2() {
  const porClave = clavesDefault(TODAS);
  // lectores: core/views/kernel Y la propia carpeta de cada plantilla — es
  // decir, cualquier fichero de plataforma o de templates/, EXCLUYENDO
  // editores (esos son "solo editor", categoría aparte).
  const ficherosNoEditor = [...ficherosPlataforma(), ...ficherosTemplates()].filter(f => !esEditor(f));
  const ficherosEditor = [...ficherosPlataforma(), ...ficherosTemplates()].filter(esEditor);
  const registros = [];
  for (const [clave, quien] of [...porClave].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (PERMITIDOS_AJENOS.has(clave)) continue;
    const [grupo, campo] = clave.split('.');
    const re = regexCampo(grupo, campo);
    const lectores = ficherosNoEditor.filter(f => re.test(leerSinComentarios(f)));
    const soloEditor = lectores.length === 0 && ficherosEditor.some(f => re.test(leerSinComentarios(f)));
    registros.push({
      clave, declaran: quien.size, plantillas: [...quien].sort(),
      lectores, soloEditor,
      sospechoso: lectores.length === 0,
    });
  }
  return registros;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 3 · presentation.* / review.* (esquema global, core/constants.js)
// ════════════════════════════════════════════════════════════════════════
// No las declara cada plantilla — las declara UNA VEZ el esquema de la
// actividad (`DEFAULT_PRESENTATION`/`DEFAULT_REVIEW`), igual que rules/scoring
// tienen su DEFAULT_* de respaldo. "Declaran" aquí = nº de ficheros que
// ESCRIBEN esa clave (editor/editorModes/editorShell, más los alias que usan
// —`pres()`/`const p = a.presentation`— porque `a.presentation.X =` literal
// no es la única forma real de escribirlo, ver nota final).
function clavesDefaultGlobal(grupo) {
  const src = leer('core/constants.js');
  const nombre = grupo === 'presentation' ? 'DEFAULT_PRESENTATION' : 'DEFAULT_REVIEW';
  const m = src.match(new RegExp(`export const ${nombre} = \\{([\\s\\S]*?)\\n\\};`));
  if (!m) return [];
  const claves = [];
  for (const mm of m[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm)) claves.push(mm[1]);
  return claves;
}

// Escritores directos (`a.presentation.X =`) + vía alias local de una línea
// (`const pres = () => (a.presentation = a.presentation || {})`, visto en
// core/editorModes.js: sin esto "teamsCount"/"vsAnimation"/… parecían no
// escribirse nunca, un falso positivo real de la primera pasada).
function escritoresGlobal(grupo) {
  const ESCRIBE_DIRECTO = new RegExp(`\\ba(?:ctivity)?\\.${grupo}\\.([A-Za-z_$][\\w$]*)\\s*=(?!=)`, 'g');
  const RE_ALIAS = new RegExp(`\\b(\\w+)\\s*=\\s*\\(\\)\\s*=>\\s*\\(?\\s*a\\.${grupo}\\s*=`);
  const porCampo = new Map(); // campo → Set<fichero>
  const add = (campo, f) => { if (!porCampo.has(campo)) porCampo.set(campo, new Set()); porCampo.get(campo).add(f); };
  for (const f of [...ficherosPlataforma(), ...ficherosTemplates()]) {
    const src = leerSinComentarios(f);
    for (const m of src.matchAll(ESCRIBE_DIRECTO)) add(m[1], f);
    const alias = src.match(RE_ALIAS);
    if (alias) {
      const RE_VIA_ALIAS = new RegExp(`\\b${escRe(alias[1])}\\(\\)\\.([A-Za-z_$][\\w$]*)\\s*=(?!=)`, 'g');
      for (const m of src.matchAll(RE_VIA_ALIAS)) add(m[1], f);
    }
  }
  return porCampo;
}

function cruce3() {
  const registros = [];
  const ficherosLector = [...ficherosPlataforma(), ...ficherosTemplates()];
  for (const grupo of ['presentation', 'review']) {
    const declaradas = clavesDefaultGlobal(grupo);
    const escritas = escritoresGlobal(grupo);
    // El universo de claves es el ESQUEMA (DEFAULT_*) — es la declaración
    // real, exista o no un editor que hoy la escriba (una clave del esquema
    // sin escritor es "letra muerta del esquema", informativo aparte).
    const claves = new Set([...declaradas, ...escritas.keys()]);
    for (const campo of [...claves].sort()) {
      const clave = `${grupo}.${campo}`;
      if (PERMITIDOS_AJENOS.has(clave)) continue;
      const re = regexCampo(grupo, campo);
      const lectores = ficherosLector.filter(f => !esEditor(f) && re.test(leerSinComentarios(f)));
      const escritores = [...(escritas.get(campo) || [])];
      const soloEditor = lectores.length === 0 && ficherosLector.some(f => esEditor(f) && re.test(leerSinComentarios(f)));
      registros.push({
        clave, declaran: escritores.length, escritores,
        lectores, soloEditor,
        sospechoso: lectores.length === 0,
        sinEscritor: escritores.length === 0, // informativo: en el esquema pero nadie la pone hoy
      });
    }
  }
  return registros;
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — una plantilla SINTÉTICA en memoria (nunca tocando el
// registro real) con `meta.play.zzNadieMeLee: 1`: tiene que salir SIN
// lector. Si el detector no la ve, no se confía en el resto de la salida.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;
  const falsa = {
    name: 'zz-sintetica-costuras',
    play: { zzNadieMeLee: 1 },
    defaultRules: () => ({ zzCampoFantasma: true }),
  };
  {
    const claves = aplanar(falsa).filter(k => k !== 'name');
    const path = claves.find(k => k.endsWith('zzNadieMeLee'));
    if (!path) { console.log('  ❌ CONTRA-PRUEBA rota: aplanar() no ve la clave sintética'); rotos++; }
    else {
      const lectores = lectoresDeClaveMeta(path, ficherosPlataforma());
      if (lectores.length !== 0) { console.log('  ❌ CONTRA-PRUEBA rota: la clave sintética "aparece leída" (imposible)'); rotos++; }
    }
  }
  {
    const re = regexCampo('rules', 'zzCampoFantasma');
    const ficherosNoEditor = [...ficherosPlataforma(), ...ficherosTemplates()].filter(f => !esEditor(f));
    const lectores = ficherosNoEditor.filter(f => re.test(leerSinComentarios(f)));
    if (lectores.length !== 0) { console.log('  ❌ CONTRA-PRUEBA rota: el campo fantasma de rules "aparece leído" (imposible)'); rotos++; }
  }
  // Y la contra-prueba POSITIVA: un caso real conocido (meta.instructions,
  // leído por core/templateContract.js) tiene que salir CON lector — si esto
  // fallara, el detector sería tan estricto que no vale para nada.
  {
    const re = regexClave('instructions');
    if (!re.test(leerSinComentarios('core/templateContract.js'))) {
      console.log('  ❌ CONTRA-PRUEBA rota: "instructions" no ve un lector real conocido (templateContract.js)'); rotos++;
    }
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

const r1 = cruce1();
const r2 = cruce2();
const r3 = cruce3();

// BASELINE — números de la PRIMERA pasada (2026-09-02), tras depurar los
// falsos positivos descritos abajo. Es un RATCHET: solo puede bajar. Si un
// cruce supera su número, el script sale con código 1 — se añadió una
// declaración nueva sin lector y hay que decidir (basura o conectar), no
// subir el número para callar al script.
const BASELINE = { meta: 0, defaults: 0, global: 0 };

const malos1 = r1.filter(r => r.sospechoso);
const malos2 = r2.filter(r => r.sospechoso);
const malos3 = r3.filter(r => r.sospechoso);
const soloUnaPlantilla = r1.filter(r => r.declaran === 1 && !r.sospechoso);

if (asJson) {
  console.log(JSON.stringify({
    meta: r1, defaultsRulesScoringLive: r2, presentacionRevision: r3,
    informativo: { soloUnaPlantilla },
  }, null, 2));
  process.exit(0);
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);

console.log('COSTURAS · B1 — declaración sin lector\n');

console.log('── 1 · meta.* DE LAS 13 (lectores fuera de templates/) ──');
if (malos1.length) mal(`${malos1.length} clave(s) sospechosa(s) (baseline ${BASELINE.meta}):`);
else ok(`0 claves sospechosas (baseline ${BASELINE.meta})`);
for (const r of malos1) {
  const motivo = r.lectores.length === 0 ? 'sin lector' : `SOLO editor (${r.lectores.join(', ')})`;
  console.log(`     ${r.clave} · declaran ${r.declaran} (${r.plantillas.join(', ')}) · ${motivo}`);
}
if (soloUnaPlantilla.length) {
  console.log(`   (${soloUnaPlantilla.length} clave(s) declarada(s) por UNA sola plantilla — informativo, no cuenta al baseline)`);
  for (const r of soloUnaPlantilla) console.log(`     ${r.clave} · solo ${r.plantillas[0]} · lectores: ${r.lectores.join(', ')}`);
}

console.log('\n── 2 · defaultRules()/defaultScoring()/defaultLive() (lectores en core/views/kernel/templates, sin editores) ──');
if (malos2.length) mal(`${malos2.length} campo(s) sin lector (de ${r2.length}, baseline ${BASELINE.defaults}):`);
else ok(`0 campos sin lector (de ${r2.length}, baseline ${BASELINE.defaults})`);
for (const r of malos2) {
  const motivo = r.soloEditor ? 'SOLO lo lee un editor' : 'sin lector en ningún sitio';
  console.log(`     ${r.clave} · declaran ${r.declaran} (${r.plantillas.join(', ')}) · ${motivo}`);
}

console.log('\n── 3 · presentation.* / review.* (esquema global, core/constants.js) ──');
if (malos3.length) mal(`${malos3.length} clave(s) sin lector (de ${r3.length}, baseline ${BASELINE.global}):`);
else ok(`0 claves sin lector (de ${r3.length}, baseline ${BASELINE.global})`);
for (const r of malos3) {
  const motivo = r.soloEditor ? 'SOLO lo lee un editor' : 'sin lector en ningún sitio';
  console.log(`     ${r.clave} · escritores ${r.declaran}${r.escritores.length ? ` (${r.escritores.join(', ')})` : ' (ninguno — está en el esquema pero nadie la pone hoy)'} · ${motivo}`);
}
const sinEscritor = r3.filter(r => r.sinEscritor && !r.sospechoso);
if (sinEscritor.length) {
  console.log(`   (${sinEscritor.length} clave(s) del esquema sin escritor hoy pero SÍ con lector — informativo, no cuenta)`);
  for (const r of sinEscritor) console.log(`     ${r.clave} · lectores: ${r.lectores.join(', ')}`);
}

const total = malos1.length + malos2.length + malos3.length;
const baseTotal = BASELINE.meta + BASELINE.defaults + BASELINE.global;
console.log(`\nB1: ${total} hallazgo(s) (baseline ${baseTotal})`);

const excede = malos1.length > BASELINE.meta || malos2.length > BASELINE.defaults || malos3.length > BASELINE.global;
if (excede) {
  console.log('❌ algún cruce superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);

// ════════════════════════════════════════════════════════════════════════
// NOTA DE FALSOS POSITIVOS (primera pasada, antes de fijar BASELINE) —lo que
// dio ruido y cómo se acotó, siguiendo la misma disciplina de
// tools/costuras-cableado.mjs:
//
//  · Cruce 1 con solo el ÚLTIMO segmento de la clave ("¿aparece '.unidad' en
//    algún sitio?") daba lector para CASI todo: "unidad", "generado",
//    "options", "live" son palabras de una sola pieza que el repo usa para
//    mil cosas ajenas a meta.*. Se pasó a las DOS ÚLTIMAS piezas
//    ("reloj?.unidad", "play?.live") — cada combinación se comprobó a mano
//    contra un grep real antes de fijar el patrón (sección previa al aplanar).
//  · Cruce 1 comparando contra el propio código FUENTE (con comentarios) daba
//    lector falso: este mismo fichero, tests/reloj.test.mjs y CLAUDE.md-en-
//    comentarios NOMBRAN "meta.play.reloj" en prosa. Se reutilizó `blank()`
//    (de costuras-cableado.mjs) para vaciar comentarios antes de buscar.
//  · Cruce 2 con el patrón COMPLETO `grupo.campo` daba "sin lector" en varios
//    campos que SÍ se leen, pero DESESTRUCTURADOS (`const { timer } =
//    a.rules; …luego solo "timer"`) — el mando "Puntos por acierto" es así en
//    dos plantillas. Se añadió la cola de comillas (`['"\`]campo['"\`]`),
//    igual que ya hace tests/ajusteConectado.test.mjs para el mismo problema.
//  · Cruce 3 con SOLO el patrón directo `a.presentation.X =` daba "nunca se
//    escribe" para teamsCount/teamsScoring/vsAnimation/vsAnimationSrc/
//    taskMaxAttempts/soloAnimation — los seis se escriben vía un alias de una
//    línea (`const pres = () => (a.presentation = a.presentation || {})` +
//    `pres().teamsCount = …`) que vive en core/editorModes.js. Se añadió el
//    seguimiento de ese alias (una sola pasada, no un parser general).
//  · `presentation.backgroundImageCredit` es la excepción YA declarada en
//    tests/ajusteConectado.test.mjs (`PERMITIDOS`): se parsea esa lista en vez
//    de mantener una copia aquí (§21b: una regla escrita dos veces acaba
//    diciendo dos cosas).
//  · `modes.practice`, `needsImageUpload`, `needsAudioUpload` (cruce 1),
//    `live.enabled`/`rules.allowOverflow`/`rules.livesPerMistake`/
//    `rules.showHints`/`scoring.penaltyRatio` (cruce 2) y
//    `presentation.layout`/`showScore`/`showTimer`/`review.showCorrectAnswer`/
//    `autoAdvanceToSummary`/`skipReview` (cruce 3) salían SIN lector de
//    verdad (no eran falsos positivos): es la clase de hallazgo que este
//    barrido existe para encontrar. Se retiraron del esquema (barrido B1,
//    2026-09-02; §24: retirar del esquema no toca actividades guardadas,
//    `migrate.js` es aditivo) y el BASELINE bajó a 0 en los tres cruces.
