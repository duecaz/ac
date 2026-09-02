// COSTURAS · B6 — AJUSTE EN LA CAPA EQUIVOCADA (docs/handoff-costuras.md §1 B6,
// docs/leyes.md §0: contenido · plantilla · modo · plataforma).
//
// Para cada campo configurable, ¿QUIÉN lo decide y QUIÉN lo lee, y están en la
// capa que corresponde? Dos cruces, ninguno arregla nada — cada uno produce
// una LISTA para que el dueño responda (plantilla de veredicto en
// docs/handoff-costuras.md §3):
//
//   1. CAMPOS de defaultRules()/defaultScoring()/defaultLive() de las 13,
//      clasificando cada LECTOR por capa (plantilla · contenido · plataforma ·
//      editor-propio · editor-genérico). Tres sospechas:
//        (a) solo lo lee la plataforma, ninguna plantilla — ¿es un ajuste de
//            modo, no una regla de la mecánica?
//        (b) campo privado (UNA plantilla) leído por un editor GENÉRICO
//            (core/editor*.js) — el control debería vivir en su propio editor.
//        (c) booleano "¿existe la mecánica?" que decide la PROPIA plantilla
//            pero que el profe puede tocar desde el editor — la costura de
//            `rules.crono`. Lista aparte para revisión campo a campo.
//   2. GATES POR CAPACIDAD — `typeof T.<método> === 'function'` / `T.<método> ?`
//      usados para DECIDIR si un modo/camino existe (no para llamar con
//      guardia), cuando ya hay una declaración `meta.play.*`/`meta.modes.*`
//      que dice lo mismo. El caso conocido: kernel/session/vsMachine.js
//      `isVsCompatible` decide VS por `typeof T.renderRound` en vez de por
//      `meta.play.vs`.
//
// Estilo: como tools/costuras-declaraciones.mjs — ✅/❌, BASELINE-ratchet (solo
// baja), --json, contra-prueba con código 2 si no detecta lo plantado a
// propósito (no se confía en el resto de la salida).
//
//   node tools/costuras-capa.mjs           # salida legible + tabla CAPA_DE
//   node tools/costuras-capa.mjs --json    # los dos cruces + la tabla en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { sinComentarios } from '../core/sinComentarios.js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new Map();
function leerSinComentarios(f) {
  if (!cache.has(f)) cache.set(f, sinComentarios(leer(f)));
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

// Las cuatro capas del encargo, por CARPETA (§0 + el encargo de esta tarea):
//   templates/<propia>/          → PLANTILLA
//   core/contentModels, kernel/content → CONTENIDO
//   core/, views/, kernel/session, adapters (resto) → MODO/PLATAFORMA
//   core/editor*.js (y el editor.js de cada plantilla) → EDITOR (quien ESCRIBE)
const DIRS_PLATAFORMA = ['core', 'views', 'kernel', 'adapters'];
function ficherosPlataforma() {
  const acc = [];
  for (const d of DIRS_PLATAFORMA) walk(d, acc);
  return acc;
}
function ficherosTemplates() {
  return walk('templates', []);
}
const esEditor = (p) => /editor\.js$|editorPanels\.js$|editorModes\.js$|editorShell\.js$|editorPrimitives\.js$/.test(p);
const esContenido = (p) => p.startsWith('core/contentModels/') || p.startsWith('kernel/content/');
const esEditorGenerico = (p) => esEditor(p) && !p.startsWith('templates/');

// EXCEPCIONES DECLARADAS EN tests/ajusteConectado.test.mjs (`PERMITIDOS`) — no
// se duplica la lista: se parsea de su fuente (mismo truco que costuras-declaraciones.mjs).
function permitidosAjenos() {
  const src = leer('tests/ajusteConectado.test.mjs');
  const m = src.match(/const PERMITIDOS = \{([\s\S]*?)\n\};/);
  if (!m) return new Set();
  const claves = new Set();
  for (const mm of m[1].matchAll(/'([\w.]+)'\s*:/g)) claves.add(mm[1]);
  return claves;
}
const PERMITIDOS_AJENOS = permitidosAjenos();

// MÉRITO COMPARTIDO — `core/scoring/*`, `core/results.js` (applyPoints) y
// `core/textCorrectionRound.js` NO son "la plataforma decidiendo una regla":
// son el helper PARAMETRIZADO que la propia plantilla invoca desde su
// `scorer.js` (`awardPoints({ …, activity, mode })`), documentado tal cual en
// CLAUDE.md §"Puntos" ("Los PARÁMETROS los lee el SCORER … la LÓGICA vive en
// la plantilla"). El regex de esta pasada no ve esa lectura porque es
// INDIRECTA (el scorer pasa `activity` entero, no escribe el literal
// `scoring.pointsPerCorrect`) — así que sin esta excepción, cada campo de
// mérito compartido saldría en (1a) por un artefacto del escaneo por texto,
// no por estar en la capa equivocada. Ver nota de falsos positivos al final.
const FICHEROS_MERITO_COMPARTIDO = new Set([
  'core/scoring/award.js', 'core/scoring/marks.js', 'core/scoring/index.js',
  'core/results.js', 'core/textCorrectionRound.js',
]);

await import('../core/registerTemplates.js');
const { listTemplates } = await import('../core/registry.js');
const TODAS = listTemplates().filter(T => existsSync(join(ROOT, 'templates', String(T.meta?.name || ''))));
if (TODAS.length < 10) {
  console.log(`❌ CONTRA-PRUEBA rota: listTemplates() solo ve ${TODAS.length} plantillas reales (se esperaban 13) — no se confía en el resto.`);
  process.exit(2);
}

const GRUPOS_DEFAULT = { defaultRules: 'rules', defaultScoring: 'scoring', defaultLive: 'live' };

// campo (grupo.campo) → { declarantes: Set<template> }
function camposDefault(plantillas) {
  const porCampo = new Map();
  for (const T of plantillas) {
    for (const [fn, grupo] of Object.entries(GRUPOS_DEFAULT)) {
      const factoria = T.meta?.[fn];
      if (typeof factoria !== 'function') continue;
      let obj;
      try { obj = factoria(); } catch { obj = {}; }
      for (const campo of Object.keys(obj || {})) {
        const k = `${grupo}.${campo}`;
        if (!porCampo.has(k)) porCampo.set(k, new Set());
        porCampo.get(k).add(T.meta.name);
      }
    }
  }
  return porCampo;
}

// Mismo patrón probado que tests/ajusteConectado.test.mjs / costuras-declaraciones.mjs:
// `grupo.campo` / `grupo?.campo` / desestructurado (`{ campo } = a.grupo`, luego
// el campo suelto entre comillas).
function regexCampo(grupo, campo) {
  const g = escRe(grupo), c = escRe(campo);
  return new RegExp(`\\.${g}\\??\\.${c}\\b|\\b${g}\\??\\.${c}\\b|['"\`]${c}['"\`]`);
}

// ¿Booleano "¿existe la mecánica?" — la forma de rules.crono? Nombre que
// pregunta por sí/no de una funcionalidad, no un valor de ajuste.
const RE_BOOL_MECANICA = /^(show|allow|enable|habilita|permite|muestra|allowoverflow|usa|has|is|con|admite)/i;

// ════════════════════════════════════════════════════════════════════════
// CLASIFICADOR — un lector (fichero) → su capa, DADO el conjunto de
// plantillas que declaran el campo (para saber qué es "su propia carpeta").
// Función pura, reutilizable también por la contra-prueba con rutas
// sintéticas (nunca toca disco para el caso sintético).
// ════════════════════════════════════════════════════════════════════════
function capaDeLector(f, declarantes) {
  const propia = [...declarantes].some(t => f.startsWith(`templates/${t}/`));
  if (esEditor(f)) return propia ? 'editor-propio' : 'editor-generico';
  if (propia) return 'plantilla';
  if (f.startsWith('templates/')) return 'plantilla-ajena';
  if (esContenido(f)) return 'contenido';
  return 'plataforma';
}

function clasificarLectores(ficheros, declarantes) {
  const bucket = { plantilla: [], 'plantilla-ajena': [], contenido: [], plataforma: [], 'editor-propio': [], 'editor-generico': [] };
  for (const f of ficheros) bucket[capaDeLector(f, declarantes)].push(f);
  return bucket;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 1 · campos de defaultRules/Scoring/Live — capa de cada lector
// ════════════════════════════════════════════════════════════════════════
function cruce1() {
  const porCampo = camposDefault(TODAS);
  const todosFicheros = [...ficherosPlataforma(), ...ficherosTemplates()];
  const filas = [];
  for (const [clave, declarantes] of [...porCampo].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (PERMITIDOS_AJENOS.has(clave)) continue;
    const [grupo, campo] = clave.split('.');
    const re = regexCampo(grupo, campo);
    const lectores = todosFicheros.filter(f => re.test(leerSinComentarios(f)));
    const capas = clasificarLectores(lectores, declarantes);

    const plataformaNoMerito = capas.plataforma.filter(f => !FICHEROS_MERITO_COMPARTIDO.has(f));
    const soloA = plataformaNoMerito.length > 0
      && capas.plantilla.length === 0 && capas['plantilla-ajena'].length === 0;
    const soloMerito = capas.plataforma.length > 0 && plataformaNoMerito.length === 0;
    const soloB = declarantes.size === 1 && capas['editor-generico'].length > 0;
    const esBooleanoMecanica = RE_BOOL_MECANICA.test(campo)
      && capas.plantilla.length > 0
      && (capas['editor-propio'].length > 0 || capas['editor-generico'].length > 0);

    filas.push({
      clave, declaran: declarantes.size, plantillas: [...declarantes].sort(),
      capas, soloPlataforma: soloA, privadoConEditorGenerico: soloB, booleanoMecanicaEditable: esBooleanoMecanica,
      soloMeritoCompartido: soloMerito,
    });
  }
  return filas;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE 2 · gates por CAPACIDAD (typeof T.x === 'function' / T.x ?) usados
// para decidir si un camino existe, en vez de por meta.play/meta.modes.
// ════════════════════════════════════════════════════════════════════════
// Nombres de variable habituales para "la clase de la plantilla" en este
// repo (comprobado por grep antes de fijar la lista: T · tpl · target ·
// rt.tpl). Restringir a estos evita falsos positivos de OTRAS capacidades
// (p.ej. core/storage.js comprobando el backend remoto, nada que ver con
// plantillas).
const VARS_PLANTILLA = ['T', 'tpl', 'target', 'rt.tpl', 'Tpl'];
function reGateTypeof() {
  const alt = VARS_PLANTILLA.map(escRe).join('|');
  return new RegExp(`typeof\\s+(${alt})\\.([A-Za-z_][\\w$]*)\\s*===\\s*['"\`]function['"\`]`, 'g');
}
function reGateTernario() {
  const alt = VARS_PLANTILLA.map(escRe).join('|');
  return new RegExp(`\\b(${alt})\\??\\.([A-Za-z_][\\w$]*)\\s*\\?[^.:]`, 'g');
}

// EXCEPCIONES DECLARADAS — cada una con su motivo, igual que SOLO_EDITOR en
// costuras-declaraciones.mjs. Son "llamar con guardia" (progresiva mejora
// con fallback) o EL PROPIO validador de contrato (su trabajo es comparar
// declaración con capacidad — es el guardián de B2, no la costura de B6).
// Clave `fichero:método` (no solo fichero — kernel/session/vsMachine.js tiene
// a la vez la costura conocida en `scoreSubmission`/`renderRound` líneas 33-34
// Y una guardia legítima en `getRoundPayload` línea 142; una excepción por
// fichero entero se habría comido las dos).
const GATES_LEGITIMOS = {
  'core/templateContract.js:renderRound': 'es el validador del contrato (B2): su función ES comparar lo declarado (modes/play) contra la capacidad real — no decide un camino, lo AUDITA',
  'core/templateContract.js:scoreSubmission': 'es el validador del contrato (B2): compara declaración contra capacidad, no decide un camino',
  'core/templateContract.js:migrateContent': 'es el validador del contrato (B2): compara declaración (`templateVersion>1`) contra capacidad, no decide un camino',
  'core/registry.js:renderPlayer': 'valida al registrar (throw si falta) — mismo motivo que templateContract.js, no decide un camino en tiempo de juego',
  'core/registry.js:renderEditor': 'valida al registrar (throw si falta) — mismo motivo que templateContract.js',
  'core/registry.js:getRoundPayload': 'valida al registrar (throw si falta) — mismo motivo que templateContract.js',
  'core/registry.js:scoreSubmission': 'valida al registrar (throw si falta) — mismo motivo que templateContract.js',
  'kernel/content/switch.js:adoptContent': 'hook OPCIONAL de afinado con fallback (`?? content`) — llama con guardia, no decide si la conversión existe (ya decidida por `canConvert`)',
  'core/editorShell.js:adoptContent': 'mismo gancho y mismo motivo que kernel/content/switch.js: afina el contenido que trae la IA, con fallback (`: fusionado`) si la plantilla no lo implementa',
  'kernel/session/score.js:getRoundPayload': 'con fallback (`T?.getRoundPayload ? … : fallback`) — progresiva mejora, siempre devuelve algo jugable',
  'kernel/session/vsMachine.js:getRoundPayload': 'con fallback (`: null`), DENTRO de un VS ya confirmado compatible por `isVsCompatible` más arriba — no decide si VS existe, decide si hay tablero propio o nada',
  'views/vsView.js:scoreSubmission': 'el `typeof T.scoreSubmission === "function"` va DETRÁS de `T.meta?.play?.retry` — la decisión real ya la tomó la declaración; el typeof es guardia defensiva antes de llamar',
};

// Declaración conocida que YA dice lo mismo que el gate por capacidad —
// informativo para el juicio (J), no cambia el veredicto mecánico.
const DECLARACION_CONOCIDA = {
  'kernel/session/vsMachine.js:renderRound': 'meta.play.vs (!== \'none\') — el caso conocido de CLAUDE.md/docs/handoff-costuras.md',
  'kernel/session/vsMachine.js:scoreSubmission': 'meta.play.vs (!== \'none\')',
  'views/teamsView.js:renderRound': "meta.play.teams === 'turns' — las 4 plantillas con equipos por turnos (math/tildes/comas/quiz) declaran 'turns' y son justo las que traen renderRound",
  'views/live/hostTablero.js:renderRaceCell': "meta.play.teams === 'board' (o meta.play.live incluye 'board') — ballsort/wordsearch son las únicas 'board' y las únicas con renderRaceCell",
};

function cruce2() {
  const ficheros = ficherosPlataforma(); // core/views/kernel/adapters, como pide el encargo
  const hallazgos = [];
  for (const f of ficheros) {
    const src = leerSinComentarios(f);
    const lineas = leer(f).split('\n'); // números de línea sobre el fuente CON comentarios (para citar bien)
    const srcLineas = src.split('\n');
    for (const re of [reGateTypeof(), reGateTernario()]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const metodo = m[2];
        const hasta = src.slice(0, m.index).split('\n').length; // línea 1-based
        const legitimoMotivo = GATES_LEGITIMOS[`${f}:${metodo}`];
        hallazgos.push({
          fichero: f, linea: hasta, metodo,
          texto: (lineas[hasta - 1] || srcLineas[hasta - 1] || '').trim(),
          legitimo: !!legitimoMotivo, motivo: legitimoMotivo || null,
          declaracionConocida: DECLARACION_CONOCIDA[`${f}:${metodo}`] || null,
        });
      }
    }
  }
  // dedupe (el mismo método en la misma línea puede matchear los dos regex)
  const vistos = new Set();
  const unicos = hallazgos.filter(h => {
    const k = `${h.fichero}:${h.linea}:${h.metodo}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  return unicos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — dos casos plantados a propósito, en memoria (nunca tocan
// disco ni el registro real):
//   1a. rules.zzMecanica declarada por UNA plantilla sintética, "leída" por
//       un fuente sintético de views/ → debe salir en (1a) [soloPlataforma].
//   2.  un fuente sintético con `T.zz === 'function' ? modos.push(...)` →
//       debe salir detectado por cruce2.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;

  // 1a — sintético: el campo lo declara SOLO 'zz-sintetica', y el único
  // "lector" simulado es un fichero de views/ (plataforma), ninguno de
  // templates/zz-sintetica/.
  {
    const declarantes = new Set(['zz-sintetica-costuras']);
    const capa = capaDeLector('views/zzVistaSintetica.js', declarantes);
    if (capa !== 'plataforma') {
      console.log(`  ❌ CONTRA-PRUEBA rota: capaDeLector() no clasifica un lector de views/ como 'plataforma' (dio '${capa}')`);
      rotos++;
    }
    const capaPropia = capaDeLector('templates/zz-sintetica-costuras/player.js', declarantes);
    if (capaPropia !== 'plantilla') {
      console.log(`  ❌ CONTRA-PRUEBA rota: capaDeLector() no reconoce la carpeta propia de la plantilla (dio '${capaPropia}')`);
      rotos++;
    }
    // con SOLO el lector de plataforma, sin ningún lector en templates/ →
    // debe marcar soloPlataforma (la lógica exacta de cruce1, aplicada a mano)
    const capas = clasificarLectores(['views/zzVistaSintetica.js'], declarantes);
    const soloA = capas.plataforma.length > 0 && capas.plantilla.length === 0 && capas['plantilla-ajena'].length === 0;
    if (!soloA) { console.log('  ❌ CONTRA-PRUEBA rota: el caso sintético de rules.zzMecanica no sale como (1a) soloPlataforma'); rotos++; }
  }

  // 2 — sintético: un cuerpo de fuente con el patrón "capacidad decide un
  // camino" (typeof … === 'function' seguido de un push condicionado).
  {
    const fuenteSintetico = `
      function zzModosDisponibles(T, modos) {
        if (typeof T.zz === 'function') { modos.push('zz'); }
        return modos;
      }
    `;
    const re = reGateTypeof();
    re.lastIndex = 0;
    const m = re.exec(fuenteSintetico);
    if (!m || m[2] !== 'zz') {
      console.log('  ❌ CONTRA-PRUEBA rota: reGateTypeof() no detecta `typeof T.zz === "function"` plantado a propósito');
      rotos++;
    }
  }

  return rotos;
}

// ════════════════════════════════════════════════════════════════════════
// TABLA CAPA_DE — el listado informativo completo (punto 3 del encargo):
// campo · dónde nace · quién escribe (editor) · lectores por capa.
// ════════════════════════════════════════════════════════════════════════
function tablaCapaDe(filas1) {
  return filas1.map(r => ({
    campo: r.clave,
    naceEn: r.declaran === 1 ? `propio de ${r.plantillas[0]}` : `global (${r.declaran} plantillas: ${r.plantillas.join(', ')})`,
    escritoEnEditor: r.capas['editor-propio'].length > 0 ? 'editor propio' : (r.capas['editor-generico'].length > 0 ? 'editor genérico' : '(sin editor detectado)'),
    lectoresPlantilla: r.capas.plantilla.length,
    lectoresContenido: r.capas.contenido.length,
    lectoresPlataforma: r.capas.plataforma.length,
    sospecha: r.soloPlataforma ? 'A: solo lee la plataforma'
      : r.privadoConEditorGenerico ? 'B: privado con editor genérico'
      : r.booleanoMecanicaEditable ? 'C: mecánica de plantilla, editable por el profe'
      : r.soloMeritoCompartido ? '(exento: mérito compartido, core/scoring)'
      : '',
  }));
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
const tabla = tablaCapaDe(r1);

// BASELINE — ejecutados los hallazgos B6 (2026-09-02): los 9 `live.*` de Quiz
// y el `live.advanceMode` de ballsort volvieron a `defaultLive: () => ({})`
// (eran idénticos a DEFAULT_LIVE o, en ballsort, un valor muerto: su bucle
// 'board' nunca lo lee — `hasAdvanceChoice` solo se enciende en 'rounds'); los
// 4 gates por capacidad (vsMachine.isVsCompatible, teamsView.roundBody,
// hostTablero.paintLiveBoardHost) pasaron a leer la DECLARACIÓN
// (meta.play.vs/teams/live), con el `typeof` como aviso defensivo (R6), y
// core/templateContract.js EXIGE ahora renderRound/renderRaceCell a quien
// declara play.vs!=='none'/'board'. Ratchet: solo puede bajar.
const BASELINE = { soloPlataforma: 0, privadoConEditorGenerico: 0, booleanoMecanicaEditable: 0, gatesPorCapacidad: 0 };

const listaA = r1.filter(r => r.soloPlataforma);
const listaB = r1.filter(r => r.privadoConEditorGenerico);
const listaC = r1.filter(r => r.booleanoMecanicaEditable);
const gatesSospechosos = r2.filter(h => !h.legitimo);
const gatesLegitimos = r2.filter(h => h.legitimo);

if (asJson) {
  console.log(JSON.stringify({
    defaults: { soloPlataforma: listaA, privadoConEditorGenerico: listaB, booleanoMecanicaEditable: listaC, todas: r1 },
    gatesPorCapacidad: { sospechosos: gatesSospechosos, legitimos: gatesLegitimos },
    capaDe: tabla,
  }, null, 2));
  process.exit(0);
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);

console.log('COSTURAS · B6 — ajuste en la capa equivocada\n');

console.log(`── 1a · SOLO lee la plataforma, ninguna plantilla (${r1.length} campos de rules/scoring/live) ──`);
if (listaA.length) mal(`${listaA.length} campo(s) (baseline ${BASELINE.soloPlataforma}):`);
else ok(`0 campos (baseline ${BASELINE.soloPlataforma})`);
for (const r of listaA) {
  console.log(`     ${r.clave} · declara ${r.plantillas.join(', ')} · lectores plataforma: ${r.capas.plataforma.join(', ')}`);
}

console.log(`\n── 1b · privado (1 plantilla) leído por un editor GENÉRICO ──`);
if (listaB.length) mal(`${listaB.length} campo(s) (baseline ${BASELINE.privadoConEditorGenerico}):`);
else ok(`0 campos (baseline ${BASELINE.privadoConEditorGenerico})`);
for (const r of listaB) {
  console.log(`     ${r.clave} · propio de ${r.plantillas[0]} · editor genérico: ${r.capas['editor-generico'].join(', ')}`);
}

console.log(`\n── 1c · booleano "¿existe la mecánica?" leído por la plantilla PERO editable en el editor (revisión campo a campo) ──`);
if (listaC.length) mal(`${listaC.length} campo(s) (baseline ${BASELINE.booleanoMecanicaEditable}):`);
else ok(`0 campos (baseline ${BASELINE.booleanoMecanicaEditable})`);
for (const r of listaC) {
  const editor = r.capas['editor-propio'].length ? r.capas['editor-propio'] : r.capas['editor-generico'];
  console.log(`     ${r.clave} · lo lee ${r.capas.plantilla.join(', ')} · lo edita ${editor.join(', ')}`);
}

console.log(`\n── 2 · GATES POR CAPACIDAD (typeof T.x === 'function' / T.x ? en core/views/kernel/adapters) ──`);
if (gatesSospechosos.length) mal(`${gatesSospechosos.length} gate(s) sospechoso(s) (baseline ${BASELINE.gatesPorCapacidad}):`);
else ok(`0 gates sospechosos (baseline ${BASELINE.gatesPorCapacidad})`);
for (const h of gatesSospechosos) {
  console.log(`     ${h.fichero}:${h.linea} · ${h.metodo} · declaración conocida: ${h.declaracionConocida || '(ninguna encontrada — puede ser genuina)'}`);
  console.log(`        ${h.texto}`);
}
if (gatesLegitimos.length) {
  console.log(`   (${gatesLegitimos.length} gate(s) legítimo(s) — llaman con guardia o SON el validador de contrato, no cuentan al baseline)`);
  for (const h of gatesLegitimos) console.log(`     ${h.fichero}:${h.linea} · ${h.metodo} · ${h.motivo}`);
}

console.log(`\n── 3 · TABLA CAPA_DE — listado completo (${tabla.length} campos) ──`);
const anchoCampo = Math.max(...tabla.map(t => t.campo.length), 5);
console.log(`     ${'campo'.padEnd(anchoCampo)}  nace en                              escrito en          lect.plantilla  lect.contenido  lect.plataforma  sospecha`);
for (const t of tabla) {
  console.log(`     ${t.campo.padEnd(anchoCampo)}  ${t.naceEn.slice(0, 36).padEnd(36)}  ${t.escritoEnEditor.slice(0, 18).padEnd(18)}  ${String(t.lectoresPlantilla).padEnd(14)}  ${String(t.lectoresContenido).padEnd(14)}  ${String(t.lectoresPlataforma).padEnd(15)}  ${t.sospecha}`);
}

const total = listaA.length + listaB.length + listaC.length + gatesSospechosos.length;
const baseTotal = BASELINE.soloPlataforma + BASELINE.privadoConEditorGenerico + BASELINE.booleanoMecanicaEditable + BASELINE.gatesPorCapacidad;
console.log(`\nB6: ${total} hallazgo(s) (baseline ${baseTotal})`);

const excede = listaA.length > BASELINE.soloPlataforma
  || listaB.length > BASELINE.privadoConEditorGenerico
  || listaC.length > BASELINE.booleanoMecanicaEditable
  || gatesSospechosos.length > BASELINE.gatesPorCapacidad;
if (excede) {
  console.log('❌ algún cruce superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);

// ════════════════════════════════════════════════════════════════════════
// NOTA DE FALSOS POSITIVOS (primera pasada, antes de fijar BASELINE):
//
//  · Cruce 2 sin restringir el nombre de variable daba positivo en
//    core/storage.js (`typeof rs.countActivitiesByOwner === 'function'`,
//    `typeof rs.probeActivitiesPayload === 'function'`): `rs` es el
//    backend/repositorio remoto, no una plantilla — no es una costura de §0
//    (contenido·plantilla·modo·plataforma) sino un capability-check normal
//    de driver. Se restringió a los nombres de variable que el repo usa de
//    verdad para "la clase de plantilla" (`T`/`tpl`/`target`/`rt.tpl`,
//    comprobado por grep antes de fijar la lista) — el mismo criterio que
//    costuras-declaraciones.mjs usó para `regexClave` (demasiado laxo = ruido).
//    UN BUG real en esa restricción: `rt.tpl` escapado dos veces (una a mano
//    en la lista, otra por `escRe`) rompía el patrón y `views/live/
//    hostTablero.js` desaparecía en silencio de la lista — la contra-prueba
//    sintética NO lo cazó porque probaba `T.zz`, no `rt.tpl.zz`; se detectó
//    a mano comparando contra el grep manual previo. Corregido pasando el
//    nombre SIN escapar a `VARS_PLANTILLA` (uno solo, en `escRe`).
//  · `core/templateContract.js` y `core/registry.js` SON el validador del
//    contrato de B2 (docs/handoff-costuras.md §1 B2): su trabajo entero es
//    comparar lo DECLARADO (`meta.modes.*`/`meta.play.*`) contra la
//    capacidad real y avisar si difieren — no es la costura, es la red que
//    la vigilaría. Contarlos como sospechosos habría hecho ruido eterno (se
//    tocan en cada plantilla nueva) sin señalar nada nuevo.
//  · `kernel/content/switch.js:adoptContent` y `core/editorShell.js:
//    adoptContent` (mismo gancho, dos llamantes: la conversión entre
//    plantillas y el afinado tras generar con IA) y `kernel/session/
//    score.js:getRoundPayload` / `kernel/session/vsMachine.js:
//    getRoundPayload` son PROGRESIVA MEJORA con valor de respaldo: llaman
//    con guardia a un hook OPCIONAL cuya ausencia no cierra ningún camino
//    (siempre queda jugable). No deciden "¿existe el modo?", deciden
//    "¿tengo una versión más fina o me quedo con la genérica?" — la
//    distinción que pide el encargo ("no para llamar con guardia"). Nota:
//    `vsMachine.js` tiene a la VEZ uno de estos guardias legítimos
//    (`getRoundPayload`, línea 142) Y la costura conocida
//    (`isVsCompatible`, líneas 33-34) — por eso `GATES_LEGITIMOS` está
//    indexado por `fichero:método`, no por fichero entero (una excepción
//    de fichero completo se habría comido las dos a la vez).
//  · `views/vsView.js:scoreSubmission` (`T.meta?.play?.retry && typeof
//    T.scoreSubmission === 'function'`): la decisión real (¿hay reintento?)
//    ya la tomó `meta.play.retry`; el `typeof` que sigue es una guardia
//    defensiva antes de invocar, no la que decide si el camino existe.
//  · Quedan CUATRO gates que sí deciden un camino por capacidad pura, sin
//    que el propio código consulte la declaración que ya existe para lo
//    mismo (columna `DECLARACION_CONOCIDA`): `kernel/session/vsMachine.js`
//    líneas 33-34 (`isVsCompatible`, el caso ya conocido de CLAUDE.md/docs/
//    handoff-costuras.md — `meta.play.vs`), `views/teamsView.js:183`
//    (`meta.play.teams === 'turns'`) y `views/live/hostTablero.js:63`
//    (`meta.play.teams === 'board'`). Fijan el BASELINE en 4 — es la lista
//    que el dueño revisa; el motivo de cada una NO es "borrar el typeof"
//    (queda como guardia técnica razonable), es "¿merece la pena sustituir
//    la pregunta de capacidad por la lectura de la declaración, ahora que
//    sabemos que dicen lo mismo?".
//  · Cruce 1: `scoring.pointsPerCorrect`/`pointsPerWrong`/`maxScore` daban
//    "SOLO plataforma" (1a) por un artefacto del escaneo por TEXTO: el
//    scorer de cada plantilla (`templates/*/scorer.js`) NO escribe el
//    literal `scoring.pointsPerCorrect` — pasa `activity` entero a
//    `awardPoints({ …, activity })`, y es `core/scoring/award.js` quien lee
//    el campo, UN NIVEL más adentro. CLAUDE.md documenta esto como diseño
//    intencional ("Los PARÁMETROS los lee el SCORER … la LÓGICA vive en la
//    plantilla"): es mérito COMPARTIDO parametrizado, no la plataforma
//    decidiendo una regla. Se excluyó explícitamente
//    (`FICHEROS_MERITO_COMPARTIDO`) para no acusar el patrón que el propio
//    proyecto eligió a propósito — y quedó marcado en la tabla CAPA_DE como
//    "(exento: mérito compartido, core/scoring)" en vez de desaparecer sin
//    dejar rastro.
//  · Tras esa excepción, SÍ quedan reales en 1a/1b: los NUEVE ajustes de
//    `live.*` (advanceMode/allowLateJoin/lockAnswersOn/maxPlayers/
//    nicknameFilter/pointsModel/questionTimer/showAnswerAfterEach/
//    showLeaderboardBetween) están declarados SOLO en `defaultLive()` de
//    Quiz (`templates/quiz/template.js`) — las otras 12 plantillas
//    devuelven `{}` — y los únicos lectores son `core/editorPanels.js`
//    (control GENÉRICO de "Live", que se pinta para CUALQUIER plantilla con
//    `modes.live`, no solo Quiz) y módulos de sesión
//    (`kernel/session/liveMachine.js`, `adapters/pocketbase/
//    realtimeRooms.js`, `views/live/hostRondas.js`…). Ninguna plantilla los
//    lee — ni siquiera Quiz, que solo los DECLARA. Encaja letra por letra
//    con la pregunta de (a): son ajustes de la SALA (modo `live`), no de la
//    mecánica de Quiz, y viven mal colocados dentro de UNA plantilla en vez
//    de en un esquema de sesión compartido. No se arregla aquí (el encargo
//    lo prohíbe): queda como la entrada que el dueño decide en (J)/(D).
//  · No apareció ningún caso de 1c (booleano "¿existe la mecánica?" leído
//    por la plantilla pero editable desde el editor): la costura de
//    `rules.crono` que dio origen a este barrido ya se retiró en v1.51.644
//    (ver CLAUDE.md "Deuda técnica registrada"/changelog); B6 confirma que
//    no quedó un caso hermano, no que el patrón no exista — la contra-prueba
//    de (1a) demuestra que el detector SÍ vería uno si apareciera.
