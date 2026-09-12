// COSTURAS · B9 — CIFRAS QUE ENVEJECEN (docs/handoff-costuras.md §1 B9).
//
// Por qué existe: el 2026-09-10 el dueño pidió una auditoría estructural y lo
// primero que salió fue que MEDIO REPOSITORIO decía «las 13 plantillas» cuando
// ya eran 16 — en docs, en comentarios de código, en herramientas y hasta en
// OCHO tests cuyo umbral (`>= 12`, `>= 13`) había dejado de vigilar nada. Nadie
// mintió: la cifra era cierta el día que se escribió. Ese es justo el problema
// de una cifra a mano — no falla, envejece; y un comentario incorrecto es peor
// que no tener comentario.
//
// La regla que fija este barrido: **una cantidad que la máquina puede contar no
// se escribe a mano**. Hay dos arreglos legítimos, en este orden:
//   1. QUITAR la cifra («las 13 plantillas» → «las plantillas»): casi siempre no
//      aportaba nada, la lista real está debajo o a un `listTemplates()` de
//      distancia.
//   2. DERIVARLA: en un test, contar del registro (`listTemplates().length`) en
//      vez de congelar un número; en un doc, generarla con su herramienta.
// Subir el número a mano NO es un arreglo: vuelve a envejecer en la siguiente
// plantilla. Por eso este barrido no dice «pon 16», dice «esta cifra sobra».
//
// LA EXCEPCIÓN, declarada: una cifra en una frase de CRÓNICA («antes vsView
// forzaba carrera a las 13») es CIERTA — describe el pasado, y borrarla borra
// la historia que explica el arreglo. Va en `CRONICA` con su motivo escrito.
//
// Estilo de la casa: ✅/❌ por lista, BASELINE-ratchet (solo BAJA), --json y
// contra-prueba sintética con código 2 (si no detecta lo plantado a propósito,
// no se confía en el resto de la salida).
//
//   node tools/costuras-cifras.mjs           # salida legible
//   node tools/costuras-cifras.mjs --json    # las listas en JSON

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');

// ════════════════════════════════════════════════════════════════════════
// LA VERDAD SE CUENTA, no se declara: sale del registro real, igual que la
// que consumirá quien arregle un hallazgo.
// ════════════════════════════════════════════════════════════════════════
await import('../core/registerTemplates.js');
const { listTemplates } = await import('../core/registry.js');
const { listModelNames } = await import('../kernel/content/models.js');

const TODAS = listTemplates();
const REAL = {
  plantillas: TODAS.length,
  ejercicios: TODAS.filter(T => T.meta?.kind === 'ejercicio').length,
  juegos:     TODAS.filter(T => T.meta?.kind === 'juego').length,
  modelos:    listModelNames().length,
};
// Un editor por plantilla: la misma cantidad, otro nombre — se cuenta igual
// para que «los 13 editores» salga con la misma vara que «las 13 plantillas».
REAL.editores = REAL.plantillas;

// ════════════════════════════════════════════════════════════════════════
// DÓNDE SE MIRA. Los docs históricos NO (son crónica por definición: viven en
// docs/historico/ justo para poder envejecer en paz) y node_modules tampoco.
// ════════════════════════════════════════════════════════════════════════
const SALTAR = new Set(['node_modules', '.git', 'vendor', 'assets', 'historico', 'scratch']);
function ficheros(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SALTAR.has(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) ficheros(p, out);
    // El propio barrido CITA ejemplos («las 13 plantillas» como muestra de lo
    // que caza): auditarse a sí mismo sería contarse sus propias comillas.
    else if (/\.(md|js|mjs)$/.test(n) && !p.endsWith('costuras-cifras.mjs')) out.push(relative(ROOT, p));
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// EXCEPCIONES declaradas, una a una y con motivo (nunca por patrón: un patrón
// ancho vuelve a dejar entrar lo que este barrido busca).
// ════════════════════════════════════════════════════════════════════════
// (a) CRÓNICA — la cifra describe un ESTADO PASADO y es cierta. Clave:
//     `fichero:línea` no, que se mueve; el TEXTO exacto de la frase.
const CRONICA = [
  ['Antes `views/vsView.js` forzaba carrera a las 13', 'crónica: cuántas había el día del bug de QA'],
  ['Antes esta vista forzaba carrera para las 13', 'crónica: idem, en el comentario del propio arreglo'],
  ['vsView forzaba carrera a las 13, así', 'crónica: idem'],
  ['Antes vsView forzaba raceToFinish:true a las 13 plantillas', 'crónica: idem, en su test'],
  ['un `static previewHtml(act)` en las 13 plantillas cuyo único consumidor', 'crónica: cuántas lo declaraban cuando se borró'],
  ['las 13 los declaraban y ningún módulo', 'crónica: cuántas lo declaraban en el barrido B1'],
  ['11 de 13 editores tenían su «+ Añadir …»', 'crónica: el conteo del día en que nació la red'],
  ['11 de 13 editores tienen su botón', 'crónica: el inventario que motivó el plan del editor'],
  ['10 de 13 plantillas salen en rojo', 'crónica: la contra-prueba medida ese día'],
  ['once terminaban con la estándar', 'crónica: el reparto medido antes de unificar el fin'],
  ['once terminaban con la pantalla', 'crónica: idem'],
  ['solo 3 de 13', 'crónica: cuántas llevaban barra antes de unificar la cabecera'],
  ['le daba otra forma que a su profe en 11 de las 13 plantillas', 'crónica: el defecto medido en live-smoke'],
  ['1b** | ✅ **HECHO (v1.51.381)** — `meta.kind` en las 13', 'crónica: cuántas había al cerrar esa tarea del norte'],
];
// (b) OTRO DOMINIO — el número no cuenta plantillas aunque lo parezca.
const OTRO_DOMINIO = [
  ['13 colecciones', 'colecciones de PocketBase, no plantillas'],
  ['máximo 8 juegos', 'el TECHO declarado del norte §4c, no cuántos hay'],
  ['200 actividades', 'la cuota de §25 (core/quotas.js), no el catálogo'],
  ['12 recorridos', 'los recorridos del preflight'],
  ['13 documentos', 'documentos, no plantillas'],
];

const declarada = (linea) => {
  for (const [frase, motivo] of CRONICA) if (linea.includes(frase)) return `crónica — ${motivo}`;
  for (const [frase, motivo] of OTRO_DOMINIO) if (linea.includes(frase)) return `otro dominio — ${motivo}`;
  return null;
};

// ════════════════════════════════════════════════════════════════════════
// LOS PATRONES. Dos formas: la cifra CON su sustantivo («13 plantillas») y la
// cifra DESNUDA («las 13»), que es la que más envejece porque no se ve.
// ════════════════════════════════════════════════════════════════════════
// LA PRECISIÓN MANDA sobre la cobertura: un barrido que grita en falso enseña a
// ignorarlo (es la lección del bloque de deuda que anunciaba una urgencia falsa
// con 20 ✅ detrás). Por eso solo cuenta la cifra que AFIRMA UN TOTAL, y eso en
// castellano lo marca el ARTÍCULO DEFINIDO:
//   · «las 13 plantillas»  → dice que son TODAS  → se comprueba
//   · «3 plantillas emitían X» → un SUBCONJUNTO, y es cierto → no se toca
//   · «4 plantillas de 13»  → el total es el segundo número → se comprueba ESE
// Primera versión: sin esta distinción salían 156 hallazgos, la mayoría ciertos
// («los 5 modos», «las 36 conversiones», «las 7 piezas del tangram»).
// Y aun con artículo, un CALIFICADOR detrás vuelve a acotar el conjunto: «las 4
// plantillas CON equipos por turnos» o «los 6 modelos QUE la IA sabe escribir»
// son ciertas. Solo se comprueba la afirmación desnuda: «las N plantillas» y
// punto (o seguida de algo que no acota: «registradas», «del catálogo»).
const CALIFICA = /^\s*(?:con|que|cuy|sin|para|donde|en\s+las\s+que|a\s+las\s+que|cuyo|cuyas?)\b/i;
const TOTAL_CON_SUSTANTIVO = {
  plantillas: /\b(?:las|Las|LAS)\s+(\d{1,3})\s+plantillas\b/g,
  editores:   /\b(?:los|Los|LOS)\s+(\d{1,3})\s+editores\b/g,
  ejercicios: /\b(?:los|Los|LOS)\s+(\d{1,3})\s+ejercicios\b/g,
  modelos:    /\b(?:los|Los|LOS)\s+(\d{1,3})\s+modelos\s+(?:de\s+)?contenido\b/g,
};
// «N plantillas de M» / «N de M plantillas»: el TOTAL es M.
const SOBRE_TOTAL = [
  /\b\d{1,3}\s+plantillas?\s+de\s+(\d{1,3})\b/g,
  /\b\d{1,3}\s+de\s+(?:las\s+)?(\d{1,3})\s+plantillas\b/g,
  /\b\d{1,3}\s+de\s+(?:los\s+)?(\d{1,3})\s+editores\b/g,
];
// La cifra DESNUDA («montando las 13», «así las 13 dicen»): solo cuenta si la
// línea nombra la palabra PLANTILLA o EDITOR como palabra suelta — no dentro de
// un nombre de fichero, que es lo que colaba `modos-de-juego.md` como si
// hablara de juegos.
const DESNUDA = /\b(?:las|Las|los|Los)\s+(\d{1,3})\b(?!\s*[a-záéíóúñ])/g;
const DOMINIO = /(?:^|[^\w/.-])(plantillas?|editores|players)(?:[^\w/.-]|$)/i;

function analizar(rel) {
  const lineas = readFileSync(join(ROOT, rel), 'utf8').split('\n');
  const out = [];
  lineas.forEach((linea, i) => {
    const motivo = declarada(linea);
    const empuja = (n, dominio, forma) => {
      if (n === REAL[dominio]) return;          // coincide con la verdad: aún no envejeció
      out.push({ fichero: rel, linea: i + 1, n, dominio, forma, real: REAL[dominio],
                 texto: linea.trim().slice(0, 110), declarada: motivo });
    };
    for (const [dominio, re] of Object.entries(TOTAL_CON_SUSTANTIVO)) {
      re.lastIndex = 0;
      for (const m of linea.matchAll(re)) {
        if (CALIFICA.test(linea.slice(m.index + m[0].length))) continue;   // subconjunto: cierto
        empuja(+m[1], dominio, 'total con sustantivo');
      }
    }
    for (const re of SOBRE_TOTAL) {
      re.lastIndex = 0;
      for (const m of linea.matchAll(re)) empuja(+m[1], 'plantillas', 'el total de un «N de M»');
    }
    if (DOMINIO.test(linea)) {
      DESNUDA.lastIndex = 0;
      for (const m of linea.matchAll(DESNUDA)) {
        const n = +m[1];
        if (n < 5 || n > 40 || n === REAL.plantillas) continue;
        out.push({ fichero: rel, linea: i + 1, n, dominio: 'plantillas', forma: 'desnuda',
                   real: REAL.plantillas, texto: linea.trim().slice(0, 110), declarada: motivo });
      }
    }
  });
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// UMBRALES CONGELADOS EN TESTS — la otra cara de la misma moneda: un
// `assert(x.length >= 13)` que se escribió cuando había 13 deja de vigilar en
// cuanto entra la 14ª. Debe contar del registro, no de un número.
// ════════════════════════════════════════════════════════════════════════
const RE_UMBRAL = /\.length\s*>=?\s*(\d{1,3})|\.size\s*>=?\s*(\d{1,3})/g;
function umbrales() {
  const out = [];
  for (const rel of ficheros(join(ROOT, 'tests')).concat(['core/selftest.js'])) {
    if (!/\.(mjs|js)$/.test(rel)) continue;
    const texto = readFileSync(join(ROOT, rel), 'utf8');
    texto.split('\n').forEach((linea, i) => {
      if (!DOMINIO.test(linea)) return;
      RE_UMBRAL.lastIndex = 0;
      for (const m of linea.matchAll(RE_UMBRAL)) {
        const n = +(m[1] ?? m[2]);
        if (n < 5 || n > 40) continue;
        out.push({ fichero: rel, linea: i + 1, n, texto: linea.trim().slice(0, 110) });
      }
    });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — se planta en MEMORIA lo que el barrido debe cazar. Si no lo
// caza, código 2: una red que no grita con el defecto delante no vale como
// verde en el resto.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  const rotos = [];
  const falso = REAL.plantillas + 3;

  // (a) positiva: un TOTAL con artículo que no cuadra debe salir.
  const l1 = `// Lo vigila el shell para las ${falso} plantillas del catálogo.`;
  TOTAL_CON_SUSTANTIVO.plantillas.lastIndex = 0;
  if (![...l1.matchAll(TOTAL_CON_SUSTANTIVO.plantillas)].some(m => +m[1] !== REAL.plantillas)) {
    rotos.push('no detecta un TOTAL con artículo que no cuadra');
  }

  // (b) positiva: el total de un «N de M».
  const l2 = `//  —el temporizador lo ofrecían 4 plantillas de ${falso}, y el cronómetro`;
  SOBRE_TOTAL[0].lastIndex = 0;
  if (![...l2.matchAll(SOBRE_TOTAL[0])].some(m => +m[1] !== REAL.plantillas)) {
    rotos.push('no detecta el total de un «N de M»');
  }

  // (c) NEGATIVA — un SUBCONJUNTO es cierto y no se toca. Sin esto el barrido
  //     obligaría a borrar frases verdaderas («3 plantillas lo emitían»).
  const l3 = '// lo emitían 3 plantillas (globos, quiz, wordsearch) con { count }';
  TOTAL_CON_SUSTANTIVO.plantillas.lastIndex = 0;
  if ([...l3.matchAll(TOTAL_CON_SUSTANTIVO.plantillas)].length) {
    rotos.push('marca un SUBCONJUNTO («3 plantillas …») como si afirmara el total');
  }

  // (d) NEGATIVA — otro dominio con artículo («los 5 modos», «las 7 piezas»)
  //     no es una cifra de plantillas aunque la línea nombre un juego.
  const l4 = '| [`modos-de-juego.md`](modos-de-juego.md) | contrato de los 5 modos y los 4 bucles |';
  DESNUDA.lastIndex = 0;
  if (DOMINIO.test(l4)) rotos.push('confunde un nombre de fichero con la palabra del dominio');

  // (d2) NEGATIVA — artículo + CALIFICADOR sigue siendo un subconjunto cierto.
  const l4b = "// 'meta.play.teams === turns' — las 4 plantillas con equipos por turnos";
  TOTAL_CON_SUSTANTIVO.plantillas.lastIndex = 0;
  for (const m of l4b.matchAll(TOTAL_CON_SUSTANTIVO.plantillas)) {
    if (!CALIFICA.test(l4b.slice(m.index + m[0].length))) {
      rotos.push('marca un subconjunto CALIFICADO («las 4 plantillas con …») como total');
    }
  }

  // (e) NEGATIVA — la cifra CORRECTA no debe salir.
  const l5 = `// las ${REAL.plantillas} plantillas registradas`;
  TOTAL_CON_SUSTANTIVO.plantillas.lastIndex = 0;
  if ([...l5.matchAll(TOTAL_CON_SUSTANTIVO.plantillas)].some(m => +m[1] !== REAL.plantillas)) {
    rotos.push('marca como vieja una cifra que SÍ coincide con la realidad');
  }

  // (f) la crónica declarada no cuenta.
  if (!declarada('// Antes `views/vsView.js` forzaba carrera a las 13, así que')) {
    rotos.push('no reconoce una frase de crónica declarada');
  }
  return rotos;
}

const rotos = contraPrueba();
if (rotos.length) {
  console.error('❌ CONTRA-PRUEBA ROTA — el barrido no caza lo que dice cazar:');
  for (const r of rotos) console.error(`   · ${r}`);
  process.exit(2);
}

// ════════════════════════════════════════════════════════════════════════
const todos = ficheros(ROOT).flatMap(analizar);
const cuentan = todos.filter(h => !h.declarada);
const informativos = todos.filter(h => h.declarada);
const congelados = umbrales();

// BASELINE — números ESCRITOS A MANO (nunca «lo que haya hoy»: un baseline
// igual al conteo no puede gritar; se aprendió en `costuras-divergencia`).
// Ratchet: solo baja.
const BASELINE = { cifras: 0, umbrales: 0 };

if (asJson) {
  console.log(JSON.stringify({ real: REAL, cifras: cuentan, informativos, umbrales: congelados, baseline: BASELINE }, null, 2));
  process.exit(cuentan.length > BASELINE.cifras || congelados.length > BASELINE.umbrales ? 1 : 0);
}

const ok = (m) => console.log(`  ✅ ${m}`);
const mal = (m) => console.log(`  ❌ ${m}`);
const fmt = (h) => `${h.fichero}:${h.linea}  ${h.texto}`;

console.log('COSTURAS · B9 — cifras escritas a mano que ya envejecieron\n');
console.log(`   la verdad, contada del registro: ${REAL.plantillas} plantillas `
  + `(${REAL.ejercicios} ejercicios · ${REAL.juegos} juegos) · ${REAL.modelos} modelos de contenido\n`);

console.log('── 1 · CIFRAS QUE NO CUADRAN (docs, comentarios, herramientas) ──');
if (cuentan.length) {
  mal(`${cuentan.length} cifra(s) (baseline ${BASELINE.cifras}):`);
  for (const h of cuentan) console.log(`     [dice ${h.n}, hay ${h.real}] ${fmt(h)}`);
  console.log('     → QUITA la cifra («las 13 plantillas» → «las plantillas») o derívala del registro.');
  console.log('       Subirla a mano NO es un arreglo: vuelve a envejecer en la siguiente plantilla.');
} else ok(`0 cifras viejas (baseline ${BASELINE.cifras})`);
if (informativos.length) {
  console.log(`   (${informativos.length} declarada(s) — informativo, no cuenta)`);
  const porMotivo = new Map();
  for (const h of informativos) porMotivo.set(h.declarada, (porMotivo.get(h.declarada) || 0) + 1);
  for (const [motivo, n] of porMotivo) console.log(`     ${n}× ${motivo}`);
}

console.log('\n── 2 · UMBRALES CONGELADOS EN TESTS (dejan de vigilar solos) ──');
if (congelados.length) {
  mal(`${congelados.length} umbral(es) (baseline ${BASELINE.umbrales}):`);
  for (const h of congelados) console.log(`     ${fmt(h)}`);
  console.log('     → cuenta del REGISTRO (listTemplates().length), no de un número congelado.');
} else ok(`0 umbrales congelados (baseline ${BASELINE.umbrales})`);

const total = cuentan.length + congelados.length;
console.log(`\nB9: ${total} hallazgo(s) (baseline ${BASELINE.cifras + BASELINE.umbrales})`);
const excede = cuentan.length > BASELINE.cifras || congelados.length > BASELINE.umbrales;
if (excede) console.log('❌ alguna lista superó su baseline — el ratchet solo puede bajar.');
process.exit(excede ? 1 : 0);
