// COSTURAS · B3 — LA VISTA QUE CONOCE UNA PLANTILLA (docs/handoff-costuras.md §1 B3).
//
// §0: un modo/vista NO conoce plantillas concretas — si necesita saber algo de
// una, esa plantilla lo DECLARA en `meta` y la vista lee la declaración, nunca
// el nombre. Un `if (template === 'wheel')` en `core/`/`views/`/`kernel/`/
// `adapters/` es un método del contrato que falta (o una excepción legítima,
// como el preview del home, que DIBUJA por tipo — es su cometido).
//
// Tres listas, sin arreglar nada (plantilla de veredicto: docs/handoff-costuras.md §3):
//   1. POR NOMBRE — comparación con un literal que es uno de los 13 nombres de
//      plantilla reales (`listTemplates()`): `.template === 'x'`, `.name === 'x'`,
//      `switch (a.template) { case 'x': }`, `[...].includes(x)` con la lista de
//      literales igualada a nombres reales.
//   2. POR MODELO — comparación con un literal que es uno de los modelos de
//      contenido reales (`kernel/content/models.js`): `contentModel === 'x'`.
//      Menos grave que por nombre (un modelo es un contrato COMPARTIDO por
//      varias plantillas), pero sigue siendo una pregunta que podría vivir
//      declarada una vez en vez de repetida por vista.
//   3. IMPORTS DIRECTOS de `templates/<x>/…` desde core/views/kernel/adapters,
//      fuera del punto único de registro (`core/registerTemplates.js`).
//
// Estilo: como tools/costuras-declaraciones.mjs — ✅/❌ por lista, baseline-
// ratchet (solo puede BAJAR), contra-prueba con una entrada sintética
// plantada a propósito que debe salir detectada (si no, código 2 — no se
// confía en el resto de la salida).
//
//   node tools/costuras-plantilla-en-vista.mjs           # salida legible
//   node tools/costuras-plantilla-en-vista.mjs --json    # las 3 listas en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { sinComentarios } from '../core/sinComentarios.js';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');

// Comentarios fuera antes de buscar (mismo truco que costuras-declaraciones.mjs
// / costuras-cableado.mjs / core/normsCheck.js): un comentario que NOMBRA
// `a.template === 'wheel'` en prosa (como este propio fichero) no es un
// hallazgo real. Se sustituye por espacios para conservar los números de línea.
const blank = sinComentarios;   // dueño único: core/sinComentarios.js (la regex copiada se tragaba medio selftest.js)
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

const DIRS_PLATAFORMA = ['core', 'views', 'kernel', 'adapters'];
function ficherosPlataforma() {
  const acc = [];
  for (const d of DIRS_PLATAFORMA) walk(d, acc);
  return acc;
}

// EXCEPCIONES DECLARADAS — cada hallazgo en uno de estos ficheros se lista
// aparte como INFORMATIVO y no cuenta al baseline. Motivo obligatorio (§3: un
// `legítimo` sin motivo no vale).
const LEGITIMO = {
  'core/homePreview.js': 'dibuja un preview estático POR TIPO de plantilla; es su cometido (CLAUDE.md, "Chrome del panel del docente")',
  'core/registerTemplates.js': 'el punto único de registro — es donde las 13 SE DECLARAN, no donde alguien las conoce de más',
  'core/contentModels/textCorrection.js': '`esHojaDeTexto()` es el dueño único de "¿esta actividad es textCorrection?" (comentario propio del fichero): responde la pregunta UNA vez para que el resto llame en vez de repetir el literal — es la declaración, no una vista que se salta el contrato',
  'core/selftest.js': 'la autoprueba del panel #/admin usa "quiz" como FIXTURE conocida para probar el scorer de punta a punta (línea 219 `c.name === \'quiz\'` + import de `templates/quiz/scorer.js`) — no es una vista decidiendo por plantilla, es el propio self-test escogiendo con qué plantilla probarse',
};

// ════════════════════════════════════════════════════════════════════════
// CARGA DE LAS 13 PLANTILLAS + LOS MODELOS DE CONTENIDO REALES — como
// costuras-declaraciones.mjs: importar el registro de verdad, no adivinar
// nombres a mano.
// ════════════════════════════════════════════════════════════════════════
await import('../core/registerTemplates.js');
const { listTemplates } = await import('../core/registry.js');
const { MODELS } = await import('../kernel/content/models.js');

const TODAS = listTemplates().filter(T => existsSync(join(ROOT, 'templates', String(T.meta?.name || ''))));
if (TODAS.length < 10) {
  console.log(`❌ CONTRA-PRUEBA rota: listTemplates() solo ve ${TODAS.length} plantillas reales (se esperaban 13) — no se confía en el resto.`);
  process.exit(2);
}
const NOMBRES_PLANTILLA = new Set(TODAS.map(T => T.meta.name));

const NOMBRES_MODELO = new Set(Object.keys(MODELS));
if (NOMBRES_MODELO.size < 4) {
  console.log(`❌ CONTRA-PRUEBA rota: kernel/content/models.js solo ve ${NOMBRES_MODELO.size} modelos — no se confía en el resto.`);
  process.exit(2);
}

const FICHEROS = ficherosPlataforma();

// ════════════════════════════════════════════════════════════════════════
// 1 · POR NOMBRE — comparaciones / switch / includes contra un literal que es
// uno de los 13 nombres de plantilla reales.
// ════════════════════════════════════════════════════════════════════════

// `algo.template === 'x'` / `algo.name === 'x'` / `!==` — con literal.
// Se exige que la propiedad sea .template o .name (no cualquier === 'quiz'
// suelto) para no cazar strings ajenas que coincidan por casualidad.
const RE_CMP = /([\w$]+(?:\??\.[\w$]+)*\.(?:template|name))\s*(===|!==)\s*(['"`])([\w-]+)\3/g;

// `switch (algo.template) { case 'x': ... }` — el switch entero, hasta la
// siguiente línea en blanco de nivel 0 o 200 líneas (tope defensivo).
const RE_SWITCH = /switch\s*\(\s*([\w$]+(?:\??\.[\w$]+)*\.(?:template|name))\s*\)\s*\{/g;
const RE_CASE = /case\s+(['"`])([\w-]+)\1\s*:/g;

// `[...].includes(x)` donde el array literal son SOLO strings y al menos una
// coincide con un nombre real — se exige que TODAS las del array sean
// nombres reales (evita cazar una lista ajena que por casualidad contiene
// "match" o "math", palabras corrientes en inglés).
const RE_ARRAY_INCLUDES = /\[\s*((?:['"`][\w-]+['"`]\s*,\s*)*['"`][\w-]+['"`])\s*\]\s*\.includes\(/g;

function lineaDe(src, index) {
  return src.slice(0, index).split('\n').length;
}
function textoLinea(src, n) {
  return (src.split('\n')[n - 1] || '').trim();
}

function porNombre() {
  const hallazgos = [];
  for (const f of FICHEROS) {
    const src = leerSinComentarios(f);
    const motivo = LEGITIMO[f];

    for (const m of src.matchAll(RE_CMP)) {
      const literal = m[4];
      if (!NOMBRES_PLANTILLA.has(literal)) continue;
      const n = lineaDe(src, m.index);
      hallazgos.push({ fichero: f, linea: n, codigo: textoLinea(src, n), forma: 'comparación', literal, legitimo: motivo });
    }

    for (const sw of src.matchAll(RE_SWITCH)) {
      // cuerpo del switch: desde la llave abierta hasta su cierre por conteo
      // de llaves (los 4 switch de la plataforma son cortos; tope 4000 chars
      // por seguridad ante un fichero raro).
      let i = sw.index + sw[0].length, depth = 1, j = i;
      while (j < src.length && depth > 0 && j - i < 4000) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      const cuerpo = src.slice(i, j);
      const base = i;
      for (const c of cuerpo.matchAll(RE_CASE)) {
        const literal = c[2];
        if (!NOMBRES_PLANTILLA.has(literal)) continue;
        const n = lineaDe(src, base + c.index);
        hallazgos.push({ fichero: f, linea: n, codigo: textoLinea(src, n), forma: 'switch/case', literal, legitimo: motivo });
      }
    }

    for (const inc of src.matchAll(RE_ARRAY_INCLUDES)) {
      const literales = [...inc[1].matchAll(/['"`]([\w-]+)['"`]/g)].map(x => x[1]);
      if (literales.length === 0) continue;
      if (!literales.every(l => NOMBRES_PLANTILLA.has(l))) continue;
      const n = lineaDe(src, inc.index);
      hallazgos.push({ fichero: f, linea: n, codigo: textoLinea(src, n), forma: 'array.includes', literal: literales.join(','), legitimo: motivo });
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// ════════════════════════════════════════════════════════════════════════
// 2 · POR MODELO — `contentModel === 'x'` / `!==` con un literal que es uno
// de los modelos de contenido reales.
// ════════════════════════════════════════════════════════════════════════
const RE_MODELO = /contentModel\s*(===|!==)\s*(['"`])([\w-]+)\2/g;

function porModelo() {
  const hallazgos = [];
  for (const f of FICHEROS) {
    const src = leerSinComentarios(f);
    const motivo = LEGITIMO[f];
    for (const m of src.matchAll(RE_MODELO)) {
      const literal = m[3];
      if (!NOMBRES_MODELO.has(literal)) continue;
      const n = lineaDe(src, m.index);
      hallazgos.push({ fichero: f, linea: n, codigo: textoLinea(src, n), literal, legitimo: motivo });
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// ════════════════════════════════════════════════════════════════════════
// 3 · IMPORTS DIRECTOS de templates/<x>/… desde core/views/kernel/adapters,
// fuera de core/registerTemplates.js.
// ════════════════════════════════════════════════════════════════════════
const RE_IMPORT = /from\s+(['"])((?:\.\.\/)+templates\/[\w-]+\/[^'"]+)\1/g;

// OJO: aquí se usa el fuente CRUDO (`leer`, no `leerSinComentarios`) — un
// `import … from '…/templates/x/y.js'` real nunca vive dentro de un
// comentario (se comprobó a mano: ningún fichero del repo cita ese patrón en
// prosa), y `leerSinComentarios` tiene el límite descrito en la nota final
// (un comentario tipo `// … tests/*.mjs …` puede disparar el regex de bloque
// de `blank()` y tragarse cientos de líneas reales de después, incluidos
// imports genuinos — pasó con `core/selftest.js`). Usar el crudo aquí evita
// ese falso negativo sin tocar `blank()` (que se copia igual que en los
// otros barridos, según el encargo).
function imports() {
  const hallazgos = [];
  for (const f of FICHEROS) {
    const src = leer(f);
    const motivo = LEGITIMO[f];
    for (const m of src.matchAll(RE_IMPORT)) {
      const n = lineaDe(src, m.index);
      hallazgos.push({ fichero: f, linea: n, codigo: textoLinea(src, n), ruta: m[2], legitimo: motivo });
    }
  }
  return hallazgos.sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea);
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — fuente SINTÉTICO en memoria (nunca tocando el repo) con un
// `if (a.template === 'quiz')` plantado a propósito: tiene que salir
// detectado en la lista 1. Si no, no se confía en el resto de la salida.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;
  const sintetico = blank(`
    // esto es un comentario con a.template === 'quiz' que NO debe contar
    function foo(a) {
      if (a.template === 'quiz') return 1;
      return 0;
    }
  `);
  const hallados = [...sintetico.matchAll(RE_CMP)].filter(m => NOMBRES_PLANTILLA.has(m[4]));
  if (hallados.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: "a.template === 'quiz'" plantado no se detectó (se detectaron ${hallados.length})`);
    rotos++;
  }
  // Y la contra-prueba del blanqueo: el comentario NO debe generar un
  // segundo hallazgo (si blank() no funcionara, saldrían 2).
  const sinBlank = `
    // esto es un comentario con a.template === 'quiz' que NO debe contar
    if (a.template === 'quiz') {}
  `;
  const sinBlankHallados = [...blank(sinBlank).matchAll(RE_CMP)].filter(m => NOMBRES_PLANTILLA.has(m[4]));
  if (sinBlankHallados.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: blank() no descarta el comentario (se detectaron ${sinBlankHallados.length}, se esperaba 1)`);
    rotos++;
  }
  // Contra-prueba de modelo:
  const modelo = blank(`if (T.meta.contentModel === 'textCorrection') return 1;`);
  const halladoModelo = [...modelo.matchAll(RE_MODELO)].filter(m => NOMBRES_MODELO.has(m[3]));
  if (halladoModelo.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: "contentModel === 'textCorrection'" plantado no se detectó`);
    rotos++;
  }
  // Contra-prueba de import directo:
  const imp = blank(`import { foo } from '../templates/quiz/scorer.js';`);
  const halladoImport = [...imp.matchAll(RE_IMPORT)];
  if (halladoImport.length !== 1) {
    console.log(`  ❌ CONTRA-PRUEBA rota: import directo de templates/quiz/… plantado no se detectó`);
    rotos++;
  }
  // Contra-prueba de "no debe confundir un literal que NO es plantilla real"
  // (p.ej. 'list', el caso que el propio encargo pide señalar aparte).
  const noPlantilla = blank(`if (a.template === 'list') return 1;`);
  const falsoPositivo = [...noPlantilla.matchAll(RE_CMP)].filter(m => NOMBRES_PLANTILLA.has(m[4]));
  if (falsoPositivo.length !== 0) {
    console.log(`  ❌ CONTRA-PRUEBA rota: "'list'" (no es una de las 13) se contó como plantilla real`);
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

// (Aquí vivió una entrada «conocida y no detectada» para core/selftest.js:219,
// que la regex de comentarios se tragaba. Con core/sinComentarios.js el barrido
// la ve solo; la contra-prueba de tests/sinComentarios.test.mjs fija el caso.)

const listaNombre = porNombre();
const listaModelo = porModelo();
const listaImports = imports();

const cuentanNombre = listaNombre.filter(h => !h.legitimo);
const infoNombre = listaNombre.filter(h => h.legitimo);
const cuentanModelo = listaModelo.filter(h => !h.legitimo);
const infoModelo = listaModelo.filter(h => h.legitimo);
const cuentanImports = listaImports.filter(h => !h.legitimo);
const infoImports = listaImports.filter(h => h.legitimo);

// Literales que aparecen en las comparaciones pero NO son una de las 13
// (p.ej. 'list' en views/home.js / views/editList.js) — informativo, el
// encargo pide señalarlo aparte si aparece. Se detecta buscando el mismo
// patrón SIN el filtro de nombre real, y restando lo que ya se contó.
function literalesAjenosANombre() {
  const vistos = [];
  for (const f of FICHEROS) {
    const src = leerSinComentarios(f);
    for (const m of src.matchAll(RE_CMP)) {
      if (NOMBRES_PLANTILLA.has(m[4])) continue; // ya está en la lista 1
      // solo interesa si el literal PARECE nombre de plantilla plausible
      // (evita listar cada `.name === 'AbortError'`/`'custom'` del repo):
      // se acota a comparaciones contra `.template` (no `.name`, demasiado
      // genérico) para que la señal sea la pedida por el encargo.
      if (!/\.template\s*(===|!==)/.test(m[0])) continue;
      const n = lineaDe(src, m.index);
      vistos.push({ fichero: f, linea: n, codigo: textoLinea(src, n), literal: m[4] });
    }
  }
  return vistos;
}
const ajenosPorNombre = literalesAjenosANombre();

// ════════════════════════════════════════════════════════════════════════
// BASELINE — números de la primera pasada (2026-09-02). Ratchet: solo baja.
// ════════════════════════════════════════════════════════════════════════
const BASELINE = { porNombre: 0, porModelo: 0, imports: 3 };

if (asJson) {
  console.log(JSON.stringify({
    porNombre: listaNombre, porModelo: listaModelo, imports: listaImports,
    informativo: { ajenosPorNombre },
    baseline: BASELINE,
  }, null, 2));
  process.exit(
    (cuentanNombre.length > BASELINE.porNombre ||
     cuentanModelo.length > BASELINE.porModelo ||
     cuentanImports.length > BASELINE.imports) ? 1 : 0
  );
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);
const fmt = (h) => `${h.fichero}:${h.linea}  ${h.codigo}`;

console.log('COSTURAS · B3 — la vista que conoce una plantilla\n');

console.log('── 1 · POR NOMBRE (literal = uno de los 13 de listTemplates()) ──');
if (cuentanNombre.length) mal(`${cuentanNombre.length} hallazgo(s) (baseline ${BASELINE.porNombre}):`);
else ok(`0 hallazgos (baseline ${BASELINE.porNombre})`);
for (const h of cuentanNombre) console.log(`     [${h.forma}] ${fmt(h)}`);
if (infoNombre.length) {
  console.log(`   (${infoNombre.length} en fichero(s) LEGÍTIMO — informativo, no cuenta)`);
  for (const h of infoNombre) console.log(`     ${fmt(h)}  — ${h.legitimo}`);
}
if (ajenosPorNombre.length) {
  console.log(`   (${ajenosPorNombre.length} comparación(es) con .template contra un literal que NO es una de las 13 — informativo, p.ej. 'list' no es plantilla)`);
  for (const h of ajenosPorNombre) console.log(`     ${fmt(h)}  (literal: '${h.literal}')`);
}

console.log('\n── 2 · POR MODELO (literal = uno de los modelos de kernel/content/models.js) ──');
if (cuentanModelo.length) mal(`${cuentanModelo.length} hallazgo(s) (baseline ${BASELINE.porModelo}):`);
else ok(`0 hallazgos (baseline ${BASELINE.porModelo})`);
for (const h of cuentanModelo) console.log(`     ${fmt(h)}`);
if (infoModelo.length) {
  console.log(`   (${infoModelo.length} en fichero(s) LEGÍTIMO — informativo, no cuenta)`);
  for (const h of infoModelo) console.log(`     ${fmt(h)}  — ${h.legitimo}`);
}

console.log('\n── 3 · IMPORTS DIRECTOS de templates/<x>/… fuera de core/registerTemplates.js ──');
if (cuentanImports.length) mal(`${cuentanImports.length} hallazgo(s) (baseline ${BASELINE.imports}):`);
else ok(`0 hallazgos (baseline ${BASELINE.imports})`);
for (const h of cuentanImports) console.log(`     ${fmt(h)}  → ${h.ruta}`);
if (infoImports.length) {
  console.log(`   (${infoImports.length} en fichero(s) LEGÍTIMO — informativo, no cuenta)`);
  for (const h of infoImports) console.log(`     ${fmt(h)}  — ${h.legitimo}`);
}

const total = cuentanNombre.length + cuentanModelo.length + cuentanImports.length;
const baseTotal = BASELINE.porNombre + BASELINE.porModelo + BASELINE.imports;
console.log(`\nB3: ${total} hallazgo(s) (baseline ${baseTotal})`);

const excede = cuentanNombre.length > BASELINE.porNombre || cuentanModelo.length > BASELINE.porModelo || cuentanImports.length > BASELINE.imports;
if (excede) {
  console.log('❌ alguna lista superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);

// ════════════════════════════════════════════════════════════════════════
// NOTA DE FALSOS POSITIVOS (primera pasada, antes de fijar BASELINE):
//
//  · Filtrar solo por `.template === '…'` sin exigir que el literal sea uno
//    de los 13 nombres reales daba ruido inmediato: `views/home.js` y
//    `views/editList.js` comparan `a.template !== 'list'`/`=== 'list'`, pero
//    "list" (la actividad "Lista de vocabulario") NO es una de las 13
//    plantillas registradas — es un valor legado de `activity.template` sin
//    plantilla propia. Se deja fuera de la lista 1 y se apunta aparte
//    (informativo `ajenosPorNombre`) tal como pide el encargo.
//  · `.name === '…'` es MUY genérico en este repo (nombres de excepción de
//    DOMException, de fondos del picker, de un skin…): sin exigir que el
//    LITERAL sea uno de los 13, cada `e.name === 'AbortError'` colaba. Con el
//    filtro de nombre real puesto, solo sobrevive `core/selftest.js:219`
//    (`caps.find(c => c.name === 'quiz')`) — es la autoprueba del panel
//    `#/admin` usando "quiz" como FIXTURE conocida para probar el scorer de
//    punta a punta, no una vista decidiendo por plantilla: está en
//    `LEGITIMO` con ese motivo y sale informativo, no cuenta al baseline.
//  · `core/liveLoops.js:9` tiene el string exacto `activity.template ===
//    'question-live'` pero dentro de un COMENTARIO (`//`) que documenta un
//    caso YA resuelto — `blank()` lo descarta, igual que en
//    costuras-declaraciones.mjs.
//  · `core/homePreview.js` es la excepción DECLARADA por el propio encargo:
//    dibuja un preview distinto por tipo de plantilla, es su cometido — sale
//    en la lista informativa, no en la que cuenta.
//  · `core/contentModels/textCorrection.js` define `esHojaDeTexto()`, el
//    dueño único de "¿es una hoja de texto?" — es la declaración, no una
//    vista que se la salta. Las CUATRO vistas que repetían el literal
//    (`views/live/hostInforme.js`, `views/reports.js`,
//    `views/assignments.js`, `views/itemStatsView.js`) ya llaman a
//    `esHojaDeTexto()` en vez de comparar `contentModel === 'textCorrection'`
//    a mano — la lista 2 quedó en 0 (barrido B3, 2026-09-02).
//  · `core/selftest.js` importa `scoreQuizSubmission` de
//    `../templates/quiz/scorer.js` directamente para el mismo self-test de
//    arriba (FIXTURE conocida, está en `LEGITIMO` y sale informativo);
//    `views/live/studentPalabra.js` importa TRES símbolos de
//    `../../templates/wheel/*` (render/lógica/animación de la ruleta) para
//    el bucle "pedir la palabra" — decisión de diseño pendiente del dueño,
//    NO está en `LEGITIMO` a propósito: sigue siendo un acoplamiento real a
//    una plantilla concreta desde plataforma, y es el BASELINE completo de
//    la lista 3 (3 líneas de import en 1 fichero).
// ════════════════════════════════════════════════════════════════════════
