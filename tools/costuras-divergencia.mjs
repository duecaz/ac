// COSTURAS · B8 — DIVERGENCIA: la misma superficie hecha de más de una manera
// sin motivo declarado (docs/handoff-costuras.md §1 B8).
//
// Los siete barridos §31 cazan basura MECÁNICA (citas rotas, exports muertos,
// declaración sin lector…). Ninguno cazaba «lo mismo hecho de tres formas,
// cada una coherente por dentro» — así se coló la CABECERA: nueve plantillas
// con los indicadores flotando, dos con banda propia (Tildes/Comas) y dos
// mezclando los dos tratamientos (dueño, con dos capturas, 2026-09-03: «solo
// estás parchando, piensa mejor»). Y así estaba ayer el FINAL DE PARTIDA: once
// con la pantalla estándar del shell (`core/resultScreen.js`), el Crucigrado
// con un cartel propio (`.cw-celebration`, `templates/crossword/player.js`)
// que al cerrarse dejaba al alumno en el tablero sin puntaje ni salida, y
// Abre Cajas saltándosela con un `skipResultScreen: true` suelto sin decir
// por qué.
//
// LA REGLA (§21b, un dueño): el final lo pinta el shell; una plantilla puede
// AÑADIR encima (celebración, `after`) pero no SUSTITUIRLO — y si de verdad
// necesita saltárselo, el motivo se ESCRIBE en `core/finPropio.js`
// (`FIN_PROPIO`), no se cuela como un booleano suelto en el player. Este
// barrido lee ESA misma lista (dueño único: el shell la obedece en tiempo de
// ejecución, este script la vigila en CI) para que las dos vidas del mapa —
// runtime y auditoría— nunca puedan decir dos cosas.
//
// Tres listas, sin arreglar nada (plantilla de veredicto: docs/handoff-costuras.md §3):
//   1. FIN PROPIO SIN MOTIVO — `skipResultScreen`/`resultScreen:` sin entrada
//      en FIN_PROPIO. Y su contraria (informativa): una entrada en FIN_PROPIO
//      cuya plantilla ya no se salta nada — «motivo huérfano».
//   2. CARTEL PROPIO — el player construye SU PROPIO markup de fin (clase
//      /celebr|final|resultado|victoria|ganaste|acab/i, o un `<h3>`/`.lead`
//      con texto de cierre) por fuera del shell. Si la plantilla está en
//      FIN_PROPIO, no cuenta: ya lo declaró.
//   3. SEGUNDA CABECERA — un `<header` o una clase /(-bar|-topbar|__bar)\b/
//      propia ADEMÁS de `cabeceraHtml`, o ninguna llamada a `cabeceraHtml` en
//      absoluto (mirando la plantilla ENTERA: player.js + play.js +, para
//      Tildes/Comas, el runner compartido — un wrapper delgado que delega no
//      cuenta como «sin cabecera» si quien pinta de verdad sí la llama).
//
// Estilo: como tools/costuras-plantilla-en-vista.mjs — ✅/❌ por lista,
// baseline-ratchet (solo puede BAJAR), contra-prueba con una entrada
// sintética plantada a propósito que debe salir detectada (si no, código 2).
//
//   node tools/costuras-divergencia.mjs           # salida legible
//   node tools/costuras-divergencia.mjs --json    # las 3 listas en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { sinComentarios } from '../core/sinComentarios.js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');
const blank = sinComentarios;   // dueño único: core/sinComentarios.js
const cache = new Map();
function leerSinComentarios(f) {
  if (!cache.has(f)) cache.set(f, blank(leer(f)));
  return cache.get(f);
}
function lineaDe(src, index) { return src.slice(0, index).split('\n').length; }
function textoLinea(src, n) { return (src.split('\n')[n - 1] || '').trim(); }
function fmt(h) { return `${h.fichero}:${h.linea}  ${h.codigo}`; }

// ════════════════════════════════════════════════════════════════════════
// FIN_PROPIO — el dueño único de la declaración (core/finPropio.js), el
// mismo que obedece el shell en runtime. Se importa, no se copia.
// ════════════════════════════════════════════════════════════════════════
const { FIN_PROPIO } = await import('../core/finPropio.js');

// ════════════════════════════════════════════════════════════════════════
// FICHEROS POR PLANTILLA — cada plantilla real (carpeta de templates/) con
// TODO lo que la pinta: `player.js` si existe, `play.js` si existe, y para
// Tildes/Comas el runner compartido que hace el trabajo de verdad
// (`core/textCorrectionRound.js`, dueño único de esa mecánica: es un
// wrapper de 8 líneas el que vive en su carpeta). Es la MISMA excepción que
// documenta el propio runner (línea 1: «shared … for Tildes and Comas»); no
// se adivina de nuevas aquí.
// ════════════════════════════════════════════════════════════════════════
const RUNNER_COMPARTIDO = { comas: 'core/textCorrectionRound.js', tildes: 'core/textCorrectionRound.js' };

function plantillasReales() {
  const dir = join(ROOT, 'templates');
  return readdirSync(dir).filter(e => statSync(join(dir, e)).isDirectory());
}

function ficherosDe(plantilla) {
  const acc = [];
  for (const nombre of ['player.js', 'play.js']) {
    const rel = `templates/${plantilla}/${nombre}`;
    if (existsSync(join(ROOT, rel))) acc.push(rel);
  }
  if (RUNNER_COMPARTIDO[plantilla]) acc.push(RUNNER_COMPARTIDO[plantilla]);
  return acc;
}

const PLANTILLAS = plantillasReales();
if (PLANTILLAS.length < 10) {
  console.log(`❌ CONTRA-PRUEBA rota: templates/ solo tiene ${PLANTILLAS.length} carpetas (se esperaban 13) — no se confía en el resto.`);
  process.exit(2);
}
// (fichero, plantilla) — un mismo fichero (el runner compartido) aparece dos
// veces, una por cada plantilla que lo usa: un hallazgo suyo se atribuye a
// LAS DOS.
const PARES = [];
for (const p of PLANTILLAS) for (const f of ficherosDe(p)) PARES.push({ plantilla: p, fichero: f });

// ════════════════════════════════════════════════════════════════════════
// 1 · FIN PROPIO SIN MOTIVO
// ════════════════════════════════════════════════════════════════════════
const RE_SKIP = /skipResultScreen\s*:\s*([^,}\n]+)/g;
// `resultScreen:` como CALLBACK que reemplaza el cierre — no la clave `after`
// (esa es aditiva, vive añadida DEBAJO de la pantalla estándar y no cuenta).
const RE_RESULTSCREEN_CB = /resultScreen\s*:\s*(\([^)]*\)\s*=>|function\b)/g;

function finPropioSinMotivo() {
  const vistos = new Set();   // dedupe: el runner compartido no se lista dos veces por el mismo skip
  const hallazgos = [];
  for (const { plantilla, fichero } of PARES) {
    const src = leerSinComentarios(fichero);
    const declarado = Boolean(FIN_PROPIO[plantilla]);
    for (const re of [RE_SKIP, RE_RESULTSCREEN_CB]) {
      re.lastIndex = 0;
      for (const m of src.matchAll(re)) {
        const n = lineaDe(src, m.index);
        const clave = `${fichero}:${n}:${plantilla}`;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        hallazgos.push({
          fichero, linea: n, codigo: textoLinea(src, n), plantilla,
          forma: re === RE_SKIP ? 'skipResultScreen' : 'resultScreen callback',
          motivo: declarado ? FIN_PROPIO[plantilla] : null,
        });
      }
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// Contraria (ratchet de limpieza, informativa): una entrada en FIN_PROPIO
// cuya plantilla YA NO se salta nada — el motivo quedó huérfano.
function motivosHuerfanos(hallazgosFinPropio) {
  const conSkip = new Set(hallazgosFinPropio.map(h => h.plantilla));
  return Object.keys(FIN_PROPIO).filter(p => !conSkip.has(p));
}

// ════════════════════════════════════════════════════════════════════════
// 2 · CARTEL PROPIO — la plantilla construye SU markup de fin por su cuenta.
// ════════════════════════════════════════════════════════════════════════
const RE_PALABRAS_FIN = /celebr|final|resultado|victoria|ganaste|acab/i;
const RE_CLASE = /class(?:Name)?\s*=\s*(['"`])([^'"`]*)\1/g;
const RE_TEXTO_H3 = /<h3[^>]*>([^<]*)/gi;
const RE_TEXTO_LEAD = /class\s*=\s*"[^"]*\blead\b[^"]*"[^>]*>([^<]*)/gi;
const RE_PALABRAS_CIERRE = /complet[oa]|se acab[oó]|¡todas|ha terminado|has terminado|fin del juego|ganaste/i;

function cartelPropio() {
  const hallazgos = [];
  for (const { plantilla, fichero } of PARES) {
    const src = leerSinComentarios(fichero);
    RE_CLASE.lastIndex = 0;
    for (const m of src.matchAll(RE_CLASE)) {
      const valor = m[2];
      if (!RE_PALABRAS_FIN.test(valor)) continue;
      const n = lineaDe(src, m.index);
      hallazgos.push({ fichero, linea: n, codigo: textoLinea(src, n), plantilla, forma: 'clase', valor });
    }
    for (const re of [RE_TEXTO_H3, RE_TEXTO_LEAD]) {
      re.lastIndex = 0;
      for (const m of src.matchAll(re)) {
        if (!RE_PALABRAS_CIERRE.test(m[1])) continue;
        const n = lineaDe(src, m.index);
        hallazgos.push({ fichero, linea: n, codigo: textoLinea(src, n), plantilla, forma: 'texto', valor: m[1].trim() });
      }
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// EXCEPCIONES DECLARADAS de la lista 2 — cada una con motivo, como en
// tools/costuras-plantilla-en-vista.mjs. La única hoy: la «corrección al
// final» de Tildes/Comas (`tc-final*`) NO es el cartel de fin de partida —
// es una pantalla INTERMEDIA (repaso palabra por palabra) que se muestra
// ANTES de llamar a `finish()`; quien cierra la partida de verdad sigue
// siendo `ctx.finish()` → `resultScreenHtml()` del shell, como las 13.
const LEGITIMO_CARTEL = {
  'core/textCorrectionRound.js':
    'las clases `tc-final*` son la pantalla de CORRECCIÓN (repaso palabra por '
    + 'palabra) que se pinta antes de `finish()`, no un cartel que sustituya al '
    + 'shell — el botón «Finalizar» de esa pantalla llama a `finish()` → '
    + '`ctx.finish()` → `resultScreenHtml()`, la misma pantalla que las demás 12.',
};

// ════════════════════════════════════════════════════════════════════════
// 3 · SEGUNDA CABECERA
// ════════════════════════════════════════════════════════════════════════
const RE_HEADER_TAG = /<header\b/gi;
// `-bar`/`-topbar`/`__bar` PERO no la franja de envío (`edu-send`, ley del
// repo: cabecera·juego·edu-send son los TRES roles del player, y una barra
// de botones marcada `edu-send` es el tercero, no una segunda cabecera —
// `templates/diagram/player.js` y `templates/match/player.js` la usan junto
// a `cabeceraHtml` a propósito).
const RE_BARRA_CLASE = /class(?:Name)?\s*=\s*(['"`])([^'"`]*)\1/g;
const RE_BARRA_PALABRA = /(-bar|-topbar|__bar)\b/;

function segundaCabecera() {
  const hallazgos = [];
  for (const { plantilla, fichero } of PARES) {
    const src = leerSinComentarios(fichero);
    const tieneCabeceraHtml = /\bcabeceraHtml\s*\(/.test(src);

    RE_HEADER_TAG.lastIndex = 0;
    for (const m of src.matchAll(RE_HEADER_TAG)) {
      const n = lineaDe(src, m.index);
      hallazgos.push({ fichero, linea: n, codigo: textoLinea(src, n), plantilla, forma: '<header> propio' });
    }
    RE_BARRA_CLASE.lastIndex = 0;
    for (const m of src.matchAll(RE_BARRA_CLASE)) {
      const valor = m[2];
      if (!RE_BARRA_PALABRA.test(valor)) continue;
      if (/\bedu-send\b/.test(valor)) continue;   // el tercer rol, no una segunda cabecera
      if (!tieneCabeceraHtml) continue;   // «no llama nunca» se cuenta aparte (más abajo)
      const n = lineaDe(src, m.index);
      hallazgos.push({ fichero, linea: n, codigo: textoLinea(src, n), plantilla, forma: `clase ${valor.match(RE_BARRA_PALABRA)[0]}` });
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// «no llama a cabeceraHtml ninguna vez» se mira por PLANTILLA (agregando sus
// ficheros): un wrapper delgado que delega en otro fichero de la misma
// plantilla no cuenta como huérfano si el que pinta de verdad sí la llama.
function sinCabecera() {
  const faltan = [];
  for (const p of PLANTILLAS) {
    const ficheros = ficherosDe(p);
    if (!ficheros.length) continue;
    const llama = ficheros.some(f => /\bcabeceraHtml\s*\(/.test(leerSinComentarios(f)));
    if (!llama) faltan.push({ plantilla: p, ficheros });
  }
  return faltan;
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — dos players SINTÉTICOS en memoria (nunca tocando el repo):
// uno con `skipResultScreen: true` sin motivo (debe salir en la lista 1),
// otro con `<header class="mi-bar">` (debe salir en la lista 3). Si alguno
// no sale, código 2 — no se confía en el resto de la salida.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;

  const sinteticoSkip = blank(`
    // esto es un comentario con skipResultScreen: true que NO debe contar
    export function renderXPlayer(rootSel, activity, opts) {
      const ctx = runFreeformPlayer(rootSel, activity, opts);
      ctx.finish({ score: 1, maxScore: 1, skipResultScreen: true });
    }
  `);
  const halladoSkip = [...sinteticoSkip.matchAll(RE_SKIP)];
  if (halladoSkip.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: "skipResultScreen: true" plantado no se detectó (lista 1) — se detectaron ${halladoSkip.length}`);
    rotos++;
  }

  const sinteticoHeader = blank(`
    export function renderXPlayer(rootSel) {
      mount(rootSel, \`<header class="mi-bar">Puntaje: 3</header>\`);
    }
  `);
  const halladoHeaderTag = [...sinteticoHeader.matchAll(RE_HEADER_TAG)];
  RE_BARRA_CLASE.lastIndex = 0;
  const halladoBarra = [...sinteticoHeader.matchAll(RE_BARRA_CLASE)].filter(m => RE_BARRA_PALABRA.test(m[2]));
  if (halladoHeaderTag.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: "<header class=\\"mi-bar\\">" plantado no se detectó por <header> (lista 3) — se detectaron ${halladoHeaderTag.length}`);
    rotos++;
  }
  if (halladoBarra.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: "class=\\"mi-bar\\"" plantado no se detectó por /(-bar|-topbar|__bar)\\b/ (lista 3) — se detectaron ${halladoBarra.length}`);
    rotos++;
  }

  // Contra-prueba del blanqueo: el comentario del sintético de arriba no debe
  // generar un segundo hallazgo de skip (si blank() no funcionara, saldrían 2).
  const sinBlank = `
    // esto es un comentario con skipResultScreen: true que NO debe contar
    ctx.finish({ skipResultScreen: true });
  `;
  const sinBlankHallado = [...blank(sinBlank).matchAll(RE_SKIP)];
  if (sinBlankHallado.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: blank() no descarta el comentario (se detectaron ${sinBlankHallado.length}, se esperaba 1)`);
    rotos++;
  }

  // Contra-prueba de "no debe confundir edu-send con una segunda cabecera":
  const sinteticoEduSend = blank(`
    mount(rootSel, \`<div class="ww-bar ww-bar-actions edu-send"><button data-ww-submit>Listo</button></div>\`);
  `);
  RE_BARRA_CLASE.lastIndex = 0;
  const falsoPositivoEduSend = [...sinteticoEduSend.matchAll(RE_BARRA_CLASE)]
    .filter(m => RE_BARRA_PALABRA.test(m[2]) && !/\bedu-send\b/.test(m[2]));
  if (falsoPositivoEduSend.length !== 0) {
    console.log(`  ❌ CONTRA-PRUEBA rota: una barra "edu-send" (el tercer rol del player) se contó como segunda cabecera`);
    rotos++;
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

const listaFinPropio = finPropioSinMotivo();
const cuentanFinPropio = listaFinPropio.filter(h => !h.motivo);
const infoFinPropio = listaFinPropio.filter(h => h.motivo);
const huerfanos = motivosHuerfanos(listaFinPropio);

const listaCartel = cartelPropio();
const cuentanCartel = listaCartel.filter(h => !FIN_PROPIO[h.plantilla] && !LEGITIMO_CARTEL[h.fichero]);
const infoCartelFinPropio = listaCartel.filter(h => FIN_PROPIO[h.plantilla]);
const infoCartelLegitimo = listaCartel.filter(h => !FIN_PROPIO[h.plantilla] && LEGITIMO_CARTEL[h.fichero]);

const listaCabecera = segundaCabecera();
const faltaCabecera = sinCabecera();

// ════════════════════════════════════════════════════════════════════════
// BASELINE — 0/0/0 desde la primera pasada (2026-09-04): el Crucigrama y Abre
// Cajas se arreglaron/declararon el mismo día en que nació el barrido.
// Ratchet: solo baja. Y NÚMEROS ESCRITOS, nunca «lo que haya hoy»: la primera
// versión de este fichero ponía `BASELINE = { finPropio: cuentanFinPropio.length,
// … }` — el baseline igual al conteo — y con un defecto plantado en disco
// decía «1 hallazgo (baseline 1)» y salía 0. Una red que se mide a sí misma
// no puede gritar; §31 existe por esto.
const BASELINE = { finPropio: 0, cartel: 0, cabecera: 0 };

if (asJson) {
  console.log(JSON.stringify({
    finPropio: listaFinPropio, cartel: listaCartel, cabecera: listaCabecera,
    informativo: { huerfanos, faltaCabecera },
    baseline: BASELINE,
  }, null, 2));
  process.exit(
    (cuentanFinPropio.length > BASELINE.finPropio ||
     cuentanCartel.length > BASELINE.cartel ||
     (listaCabecera.length + faltaCabecera.length) > BASELINE.cabecera) ? 1 : 0
  );
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);

console.log('COSTURAS · B8 — divergencia (la misma superficie, hecha de más de una manera)\n');

console.log('── 1 · FIN PROPIO SIN MOTIVO (skipResultScreen / resultScreen: sin entrada en FIN_PROPIO) ──');
if (cuentanFinPropio.length) mal(`${cuentanFinPropio.length} hallazgo(s) (baseline ${BASELINE.finPropio}):`);
else ok(`0 hallazgos (baseline ${BASELINE.finPropio})`);
for (const h of cuentanFinPropio) console.log(`     [${h.forma}] ${fmt(h)}  (plantilla: ${h.plantilla})`);
if (infoFinPropio.length) {
  console.log(`   (${infoFinPropio.length} YA declarados en FIN_PROPIO — informativo, no cuenta)`);
  for (const h of infoFinPropio) console.log(`     ${fmt(h)}  (${h.plantilla}) — ${h.motivo}`);
}
if (huerfanos.length) {
  console.log(`   (${huerfanos.length} motivo(s) HUÉRFANO(S) — la plantilla ya no se salta nada, ratchet de limpieza informativo)`);
  for (const p of huerfanos) console.log(`     FIN_PROPIO['${p}'] — nada que la use ya`);
}

console.log('\n── 2 · CARTEL PROPIO (markup de fin fuera del shell) ──');
if (cuentanCartel.length) mal(`${cuentanCartel.length} hallazgo(s) (baseline ${BASELINE.cartel}):`);
else ok(`0 hallazgos (baseline ${BASELINE.cartel})`);
for (const h of cuentanCartel) console.log(`     [${h.forma}] ${fmt(h)}  (plantilla: ${h.plantilla}, "${h.valor}")`);
if (infoCartelFinPropio.length) {
  console.log(`   (${infoCartelFinPropio.length} en plantilla(s) YA en FIN_PROPIO — informativo, no cuenta)`);
  for (const h of infoCartelFinPropio) console.log(`     ${fmt(h)}  (${h.plantilla})`);
}
if (infoCartelLegitimo.length) {
  console.log(`   (${infoCartelLegitimo.length} en fichero(s) LEGÍTIMO — informativo, no cuenta)`);
  // El motivo se lee UNA vez por fichero, no pegado a cada línea.
  for (const [fichero, motivo] of Object.entries(LEGITIMO_CARTEL)) {
    const suyas = infoCartelLegitimo.filter(h => h.fichero === fichero);
    if (suyas.length) console.log(`     ${fichero} (${suyas.length} líneas: ${[...new Set(suyas.map(h => h.linea))].join(', ')}) — ${motivo}`);
  }
}

console.log('\n── 3 · SEGUNDA CABECERA (<header>/-bar propia además de cabeceraHtml, o ninguna llamada) ──');
const totalCabecera = listaCabecera.length + faltaCabecera.length;
if (totalCabecera) mal(`${totalCabecera} hallazgo(s) (baseline ${BASELINE.cabecera}):`);
else ok(`0 hallazgos (baseline ${BASELINE.cabecera})`);
for (const h of listaCabecera) console.log(`     [${h.forma}] ${fmt(h)}  (plantilla: ${h.plantilla})`);
for (const f of faltaCabecera) console.log(`     [sin cabeceraHtml] ${f.plantilla}  (${f.ficheros.join(', ')})`);

const total = cuentanFinPropio.length + cuentanCartel.length + totalCabecera;
const baseTotal = BASELINE.finPropio + BASELINE.cartel + BASELINE.cabecera;
console.log(`\nB8: ${total} hallazgo(s) (baseline ${baseTotal})`);

const excede = cuentanFinPropio.length > BASELINE.finPropio || cuentanCartel.length > BASELINE.cartel || totalCabecera > BASELINE.cabecera;
if (excede) {
  console.log('❌ alguna lista superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);

// ════════════════════════════════════════════════════════════════════════
// NOTA DE FALSOS POSITIVOS (primera pasada, 2026-09-04):
//
//  · `templates/diagram/player.js:258` y `templates/match/player.js:284`
//    tienen `class="ww-bar ww-bar-actions edu-send"` — coincide con
//    /(-bar|-topbar|__bar)\b/ pero es el TERCER rol del player (`edu-send`,
//    la franja de envío, CLAUDE.md «LA DIAGRAMACIÓN DEL PLAYER: TRES
//    roles»), no una segunda cabecera: ambas plantillas llaman a
//    `cabeceraHtml` una línea antes. Excluido por la propia clase
//    `edu-send`, no por fichero — cualquier barra futura marcada así queda
//    fuera sin tocar este script.
//  · `core/textCorrectionRound.js` tiene clases `tc-final*` (líneas
//    662-671): es la pantalla de CORRECCIÓN («repaso palabra por palabra»,
//    ver comentario de `corregirTodo()` en el propio fichero), pintada
//    ANTES de `finish()`. El cierre real sigue siendo `ctx.finish()` →
//    `resultScreenHtml()`, igual que las otras 12 — está en
//    `LEGITIMO_CARTEL` con el motivo.
//  · `templates/wheel/player.js:56` («Se acabaron las opciones») coincide
//    por texto con /acab/i pero vive en un `<div class="text-muted">`
//    DURANTE la partida (se puede seguir girando o pulsar «Terminar»), no
//    en un `<h3>`/`.lead` de cierre — el patrón de texto solo mira esas dos
//    formas a propósito, así que no aparece.
//  · `templates/question-live/player.js:121` («¡Todas las preguntas
//    respondidas!», clase `lead`) SÍ coincide, pero Abre Cajas está
//    declarada en FIN_PROPIO — sale en la lista 2 como informativo, no
//    cuenta al baseline (ya dijo por qué).
//  · `templates/ballsort/player.js`, `templates/comas/player.js` y
//    `templates/tildes/player.js` no llaman a `cabeceraHtml` ELLOS
//    mismos — son wrappers delgados. La pintan de verdad `play.js`
//    (Ball Sort) y `core/textCorrectionRound.js` (Tildes/Comas), así que
//    agregando por PLANTILLA (no por fichero suelto) las 13 la llaman: la
//    lista de «sin cabeceraHtml» sale en 0 hoy.
// ════════════════════════════════════════════════════════════════════════
