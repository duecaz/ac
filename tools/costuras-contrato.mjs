// COSTURAS · B2 — CONTRATO A MEDIAS (docs/handoff-costuras.md §1 B2).
//
// `core/templateContract.js` valida que los estáticos de las 13 EXISTAN (con
// `typeof === 'function'`); no mira si son IGUALES entre plantillas, VACÍOS
// (stubs sin lógica) o INALCANZABLES (nadie los invoca, o alguien los invoca
// sin que la plantilla los tenga). Ese es el hueco que llena este barrido.
// Ninguno de los cuatro cruces arregla nada: cada uno produce una LISTA para
// que otro agente (o el dueño) diga `basura`/`conectar`/`legítimo`/`replantear`
// por entrada (plantilla de veredicto en docs/handoff-costuras.md §3).
//
//   a. STUB donde el modo está encendido — meta.play declara un camino
//      (VS/Equipos/un bucle en vivo) y el método que ese camino necesita
//      es un stub (cuerpo trivial, ver `esStub()`).
//   b. COPIADO en ≥2 plantillas — mismo cuerpo normalizado, pero funciones
//      DISTINTAS (no la misma referencia compartida vía import: eso ya está
//      bien hecho — ver la nota sobre `distinctRefs` más abajo).
//   c. DEFINIDO SIN INVOCADOR — un estático que ninguna plantilla necesita
//      porque ni la plataforma ni otra plantilla lo llaman (solo un test/tool
//      no cuenta como huérfano: se lista aparte, informativo).
//   d. INVOCADO QUE ALGUNA NO DEFINE NI HEREDA — la plataforma llama a
//      `T.metodo(` y alguna de las 13 no lo tiene: o el sitio se guarda
//      (`?.`/`typeof…==='function'`, en cuyo caso se dice) o es un crash
//      latente.
//
// Además, INFORMATIVO (no cuenta al baseline): la matriz completa
// 13 plantillas × cada estático que ALGUNA define (P=propio · H=heredado de
// base.js · S=stub · C=copiado · -=no lo tiene).
//
// Estilo: como tools/costuras-declaraciones.mjs / tools/costuras-cableado.mjs
// — ✅/❌ por cruce, baseline-ratchet (solo puede BAJAR), contra-prueba con una
// clase SINTÉTICA (nunca tocando el registro real) que debe salir con un
// método sin invocador Y un stub sobre un modo encendido — si no, código 2.
//
//   node tools/costuras-contrato.mjs           # salida legible + matriz
//   node tools/costuras-contrato.mjs --json    # las 4 listas + la matriz en JSON

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const leer = (p) => readFileSync(join(ROOT, p), 'utf8');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Comentarios fuera antes de buscar invocadores/guardas (mismo truco que
// core/normsCheck.js / los otros dos barridos de costuras): un comentario que
// MENCIONA `T.renderRound(` en prosa (como este propio fichero) no es un
// invocador real.
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
const cache = new Map();
function leerSinComentarios(f) {
  if (!cache.has(f)) cache.set(f, blank(leer(f)));
  return cache.get(f);
}

function walk(dir, filtro, acc = []) {
  if (!existsSync(join(ROOT, dir))) return acc;
  for (const e of readdirSync(join(ROOT, dir))) {
    if (['node_modules', '.git', 'vendor', 'assets'].includes(e)) continue;
    const rel = `${dir}/${e}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, filtro, acc);
    else if (filtro(rel)) acc.push(rel);
  }
  return acc;
}
const esJs = (f) => f.endsWith('.js') || f.endsWith('.mjs');

// Ficheros de "juego/plataforma" — donde debería estar el INVOCADOR de
// verdad (lo que ve un jugador o un profe). Igual que costuras-declaraciones.
const DIRS_PLATAFORMA = ['core', 'views', 'kernel', 'adapters'];
const ficherosPlataforma = () => DIRS_PLATAFORMA.reduce((acc, d) => walk(d, esJs, acc), []);
const ficherosTemplates = () => walk('templates', esJs, []);
const ficherosTests = () => walk('tests', esJs, []);
const ficherosTools = () => walk('tools', esJs, []);

// ════════════════════════════════════════════════════════════════════════
// CARGA DE LAS 13 PLANTILLAS DE VERDAD — igual que tests/reloj.test.mjs y
// tools/costuras-declaraciones.mjs: importar core/registerTemplates.js
// (efecto secundario: cada índice se auto-registra) y leer core/registry.js,
// no parsear el fichero a regex.
// ════════════════════════════════════════════════════════════════════════
await import('../core/registerTemplates.js');
const { listTemplates } = await import('../core/registry.js');
const TODAS = listTemplates().filter(T => existsSync(join(ROOT, 'templates', String(T.meta?.name || ''))));
if (TODAS.length < 10) {
  console.log(`❌ CONTRA-PRUEBA rota: listTemplates() solo ve ${TODAS.length} plantillas reales (se esperaban 13) — no se confía en el resto.`);
  process.exit(2);
}
const BaseTemplate = Object.getPrototypeOf(TODAS[0]);

// ════════════════════════════════════════════════════════════════════════
// UNIVERSO DE MÉTODOS — cada `static` función que ALGUNA de las 13 define
// (propia) o que trae la base (heredada). `meta` se EXCLUYE (es propiedad, la
// mira B1 — docs/handoff-costuras.md §1 B1); `length`/`name`/`prototype` son
// propiedades de función que `getOwnPropertyNames` siempre trae y no son del
// contrato.
// ════════════════════════════════════════════════════════════════════════
const PROPS_RUIDO = new Set(['length', 'name', 'prototype', 'meta']);
function metodosPropios(T) {
  return Object.getOwnPropertyNames(T).filter(k => !PROPS_RUIDO.has(k) && typeof T[k] === 'function');
}
function metodosHeredados(T) {
  const proto = Object.getPrototypeOf(T);
  return Object.getOwnPropertyNames(proto).filter(k => !PROPS_RUIDO.has(k) && typeof proto[k] === 'function');
}
const UNIVERSO = [...new Set(TODAS.flatMap(T => [...metodosPropios(T), ...metodosHeredados(T)]))].sort();

// Los 9 métodos "del contrato de plataforma" documentados en
// docs/handoff-costuras.md §1 B2 (confirmados con
// `grep -rhoE "\b(T|tpl|Tpl|template|Template)\.[a-zA-Z]+\(" core views kernel adapters`,
// ver la nota de falsos positivos al final). El resto del UNIVERSO
// (`itemParts`/`valueParts`/`itemLabel`) es el contrato OPCIONAL de analítica
// por ítem (M1, `core/itemStats.js`): siempre se invoca con `?.`, así que
// queda fuera de los cruces (a) y (d) — sí entra en la matriz informativa y
// en (b)/(c).
const METODOS_CORE = ['renderPlayer', 'renderEditor', 'scoreSubmission', 'getRoundPayload', 'renderRound', 'renderRoundHost', 'renderRaceCell', 'migrateContent', 'adoptContent'];

// ════════════════════════════════════════════════════════════════════════
// ¿ES UN STUB? — cuerpo normalizado de ≤ 2 sentencias que no usa nada de lo
// que recibe: devuelve un literal trivial (null/undefined/{}/[]área/false/''/
// un objeto compuesto SOLO de literales, como el `{correct:null,points:0,…}`
// de wheel/question-live) o el propio argumento sin tocarlo (el
// `migrateContent(content){ return content; }` de match/memory/comas/
// diagram), o solo lanza. Function.prototype.toString + un parser mínimo
// (balanceo de paréntesis/llaves, sin regex sobre el cuerpo entero) porque
// los estáticos reales anidan `{ }` de sobra para que una regex los confunda.
// ════════════════════════════════════════════════════════════════════════
function splitTopLevel(s, sep) {
  const out = []; let depth = 0, cur = '', inStr = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { cur += c; if (c === inStr && s[i - 1] !== '\\') inStr = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { inStr = c; cur += c; continue; }
    if ('{[('.includes(c)) depth++;
    if ('}])'.includes(c)) depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}
function parseFn(fn) {
  const src = fn.toString();
  const pi = src.indexOf('(');
  let depth = 0, pj = -1;
  for (let i = pi; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') { depth--; if (depth === 0) { pj = i; break; } }
  }
  const params = splitTopLevel(src.slice(pi + 1, pj), ',').map(s => s.trim().split('=')[0].trim()).filter(Boolean);
  const bi = src.indexOf('{', pj);
  const body = bi >= 0 ? src.slice(bi + 1, src.lastIndexOf('}')) : '';
  return { params, body };
}
const LITERAL = /^(null|true|false|undefined|-?\d+(\.\d+)?|'[^']*'|"[^"]*"|`[^`]*`)$/;
function esLiteralTrivial(v) {
  v = v.trim();
  if (v === '' || v === '{}' || v === '[]') return v !== '';
  if (LITERAL.test(v)) return true;
  if (/^\{[\s\S]*\}$/.test(v)) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return true;
    return splitTopLevel(inner, ',').every(p => {
      const m = p.match(/^\s*[\w$'"]+\s*:\s*([\s\S]+)$/);
      return !!m && LITERAL.test(m[1].trim());
    });
  }
  return false;
}
function esStub(fn) {
  const { params, body: rawBody } = parseFn(fn);
  const body = blank(rawBody).trim();
  if (!body) return true; // cuerpo vacío
  const stmts = splitTopLevel(body, ';').map(s => s.trim()).filter(Boolean);
  if (stmts.length > 2) return false;
  return stmts.every(st => {
    if (/^throw\b/.test(st)) return true;
    const m = st.match(/^return\s*([\s\S]*)$/);
    if (!m) return false; // una sentencia que no es return/throw ⇒ no es trivial
    const v = m[1].trim().replace(/^\(([\s\S]*)\)$/, '$1').trim();
    if (v === '') return true; // `return;` (undefined)
    if (params.includes(v)) return true; // passthrough del argumento tal cual
    return esLiteralTrivial(v);
  });
}
function normalizarCuerpo(fn) {
  const { body } = parseFn(fn);
  return blank(body).replace(/\s+/g, ' ').trim();
}

// ════════════════════════════════════════════════════════════════════════
// GRUPOS "COPIADO" (cruce b) — por método, agrupa las implementaciones
// PROPIAS (no heredadas) por cuerpo normalizado. Un grupo de ≥2 plantillas
// con la MISMA referencia de función (p.ej. `static scoreSubmission =
// scoreQuizSubmission` importado por Quiz Y Globos) es reutilización YA
// resuelta — no cuenta. Solo cuenta cuando son funciones DISTINTAS que
// alguien escribió dos veces con el mismo cuerpo (comprobado con
// `Function !== Function`, no con el texto: dos funciones idénticas por
// texto pero MISMA referencia no son una copia, son un import compartido).
// ════════════════════════════════════════════════════════════════════════
function gruposCopiados() {
  const porMetodo = new Map(); // metodo → cuerpo normalizado → [{plantilla, fn}]
  for (const T of TODAS) {
    for (const m of metodosPropios(T)) {
      if (!porMetodo.has(m)) porMetodo.set(m, new Map());
      const cuerpo = normalizarCuerpo(T[m]);
      const porCuerpo = porMetodo.get(m);
      if (!porCuerpo.has(cuerpo)) porCuerpo.set(cuerpo, []);
      porCuerpo.get(cuerpo).push({ plantilla: T.meta.name, fn: T[m] });
    }
  }
  const grupos = [];
  for (const [metodo, porCuerpo] of porMetodo) {
    for (const [, entradas] of porCuerpo) {
      if (entradas.length < 2) continue;
      const refsDistintas = new Set(entradas.map(e => e.fn)).size;
      if (refsDistintas < 2) continue; // misma referencia compartida vía import: legítimo
      grupos.push({ metodo, plantillas: entradas.map(e => e.plantilla).sort() });
    }
  }
  return grupos.sort((a, b) => a.metodo.localeCompare(b.metodo) || a.plantillas.join().localeCompare(b.plantillas.join()));
}
const GRUPOS_COPIADOS = gruposCopiados();
const COPIADO_KEY = (plantilla, metodo) => `${plantilla}::${metodo}`;
const SET_COPIADOS = new Set(GRUPOS_COPIADOS.flatMap(g => g.plantillas.map(p => COPIADO_KEY(p, g.metodo))));

// ════════════════════════════════════════════════════════════════════════
// CLASIFICACIÓN DE CELDA — heredado > stub > copiado > propio > '-'.
// "heredado" gana porque significa "no la define ella, la trae base.js": ni
// stub ni copiado se le puede reprochar a quien no escribió nada.
// ════════════════════════════════════════════════════════════════════════
function claseCelda(T, metodo) {
  if (typeof T[metodo] !== 'function') return '-';
  if (!metodosPropios(T).includes(metodo)) return 'heredado';
  if (esStub(T[metodo])) return 'stub';
  if (SET_COPIADOS.has(COPIADO_KEY(T.meta.name, metodo))) return 'copiado';
  return 'propio';
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE a · STUB DONDE EL MODO ESTÁ ENCENDIDO
//
// MAPA modo → métodos que NO pueden ser stub (comprobado contra el código
// real, no adivinado):
//   · play.vs !== 'none'         → renderRound, scoreSubmission
//     (kernel/session/vsMachine.js `isVsCompatible`: exige AMBOS antes de
//     ofrecer VS; core/templateCapability.js `canAutoScoreRound` igual.)
//   · play.teams en {turns,board} → renderRound
//     (core/templateContract.js línea ~111: "la ronda genérica exige
//     renderRound"; scoreSubmission NO se exige aquí porque Equipos admite
//     `scoring:'judge'` — el docente marca ✓/✗ a mano, sin scorer —
//     kernel/session/teamsMachine.js.)
//   · play.live incluye 'rounds'/'race'/'board' → getRoundPayload,
//     scoreSubmission, renderRound
//     (views/live/hostRondas.js, studentRondas.js, studentCarrera.js,
//     studentTablero.js llaman los tres vía `tpl.*` — el ÚNICO bucle que NO
//     los usa es 'claim': views/live/hostPalabra.js y studentPalabra.js no
//     tocan ningún método de la plantilla — pedir la palabra puntúa el
//     docente a mano, por diseño (§26). Por eso wheel/question-live —
//     'claim' puro— declaran `scoreSubmission(){ return {correct:null,…} }`
//     a propósito (el comentario en su fuente lo dice: "puntúa el profe…
//     sin mérito automático") y NO entran en este cruce.)
//   · modes.live === true (cualquier bucle) → getRoundPayload
//     (core/registry.js `validateTemplate`: lo exige SIEMPRE que modes.live,
//     incluido 'claim' — por eso getRoundPayload SÍ se pide incluso ahí.)
// ════════════════════════════════════════════════════════════════════════
const LOOPS_CON_RONDA = ['rounds', 'race', 'board'];
function playLiveDe(T) {
  const raw = T.meta?.play?.live;
  return Array.isArray(raw) ? raw : (raw ? [raw] : []);
}
const REQUISITOS = [
  {
    aplica: (T) => T.meta?.play?.vs && T.meta.play.vs !== 'none',
    etiqueta: (T) => `play.vs=${T.meta.play.vs}`,
    metodos: ['renderRound', 'scoreSubmission'],
  },
  {
    aplica: (T) => ['turns', 'board'].includes(T.meta?.play?.teams),
    etiqueta: (T) => `play.teams=${T.meta.play.teams}`,
    metodos: ['renderRound'],
  },
  {
    aplica: (T) => playLiveDe(T).some(l => LOOPS_CON_RONDA.includes(l)),
    etiqueta: (T) => `play.live=[${playLiveDe(T).join(',')}]`,
    metodos: ['getRoundPayload', 'scoreSubmission', 'renderRound'],
  },
  {
    aplica: (T) => T.meta?.modes?.live === true,
    etiqueta: () => 'modes.live=true',
    metodos: ['getRoundPayload'],
  },
];
function cruceA() {
  const hallazgos = [];
  for (const T of TODAS) {
    const vistos = new Set(); // no repetir el mismo (metodo) dos veces si dos requisitos lo piden
    for (const req of REQUISITOS) {
      if (!req.aplica(T)) continue;
      for (const metodo of req.metodos) {
        const key = `${metodo}`;
        if (vistos.has(key)) continue;
        const clase = claseCelda(T, metodo);
        if (clase === 'stub') {
          vistos.add(key);
          hallazgos.push({ plantilla: T.meta.name, metodo, porque: req.etiqueta(T) });
        }
      }
    }
  }
  return hallazgos;
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE c · DEFINIDO SIN INVOCADOR
//
// Para cada método del universo: ¿aparece `.metodo(` en algún fichero de
// plataforma (core/views/kernel/adapters) o en OTRA plantilla (una plantilla
// puede reutilizar el estático de otra, como Globos con
// `renderQuizEditor`)? Si no, ¿aparece al menos en tests/ o tools/? Ese caso
// se lista APARTE, informativo (lo usa un instrumento, no el juego). Si no
// aparece en NINGÚN sitio (ni siquiera definición propia aparte): huérfano.
// ════════════════════════════════════════════════════════════════════════
// `\??\.?` cubre tanto `.metodo(` como el encadenado opcional DOBLE
// `?.metodo?.(` (core/itemStats.js llama `template?.itemParts?.({…})`: sin
// el `\.?` extra antes del paréntesis, esa invocación real se colaba como
// "sin invocador" — falso positivo de la primera pasada, ver nota final).
function invocadoresDe(metodo, ficheros) {
  const re = new RegExp(`\\.${escRe(metodo)}\\??\\.?\\s*\\(`);
  return ficheros.filter(f => re.test(leerSinComentarios(f)));
}
function cruceC() {
  const plataforma = ficherosPlataforma();
  const plantillas = ficherosTemplates();
  const tests = ficherosTests();
  const tools = ficherosTools();
  const hallazgos = [];
  const soloInstrumento = [];
  for (const metodo of UNIVERSO) {
    const enPlataforma = invocadoresDe(metodo, plataforma);
    const enPlantillas = invocadoresDe(metodo, plantillas);
    if (enPlataforma.length || enPlantillas.length) continue; // tiene invocador real
    const enTests = invocadoresDe(metodo, tests);
    const enTools = invocadoresDe(metodo, tools);
    if (enTests.length || enTools.length) {
      soloInstrumento.push({ metodo, tests: enTests, tools: enTools });
    } else {
      hallazgos.push({ metodo });
    }
  }
  return { huerfanos: hallazgos, soloInstrumento };
}

// ════════════════════════════════════════════════════════════════════════
// CRUCE d · INVOCADO QUE ALGUNA NO DEFINE NI HEREDA
//
// Solo tiene sentido para METODOS_CORE (los otros —M1— siempre se llaman con
// `?.`). Por método: ¿qué plantillas NO lo tienen (ni propio ni heredado)?
// Si ninguna, no hay nada que mirar. Si alguna, cada SITIO de invocación de
// plataforma se marca "guardado" si en el MISMO fichero aparece `?.` pegado
// al método, o un `typeof …===\`function\`` o una comprobación ternaria
// (`X.metodo ? … : …`) sobre él — heurística TEXTUAL a nivel de fichero (no
// sigue el flujo entre funciones), documentada en la nota de falsos
// positivos: por eso el veredicto final es de quien lea la lista, no de este
// script.
// ════════════════════════════════════════════════════════════════════════
function faltantesDe(metodo) {
  return TODAS.filter(T => typeof T[metodo] !== 'function').map(T => T.meta.name);
}
function sitiosDe(metodo, ficheros) {
  const re = new RegExp(`([\\w.$]+)\\??\\.${escRe(metodo)}\\s*\\(`, 'g');
  const sitios = [];
  for (const f of ficheros) {
    const srcConComentarios = leer(f);
    const srcSinComentarios = leerSinComentarios(f);
    const lineas = srcConComentarios.split('\n');
    let m;
    const reLinea = new RegExp(`([\\w.$]+)\\??\\.${escRe(metodo)}\\s*\\(`);
    for (let i = 0; i < lineas.length; i++) {
      if (!reLinea.test(blank(lineas[i]))) continue;
      const guardEnLinea = /\?\./.test(lineas[i].split(`.${metodo}`)[0].slice(-1));
      const guardEnFichero =
        new RegExp(`\\w+\\??\\.${escRe(metodo)}\\s*(\\?|===\\s*['"\`]function|&&)`).test(srcSinComentarios) ||
        new RegExp(`typeof[^\\n;]*\\.${escRe(metodo)}[^\\n;]*function`).test(srcSinComentarios) ||
        // `if (T?.migrateContent) { … T.migrateContent(…) }` — la comprobación
        // de existencia usa `?.` como VALOR (sin `(` detrás: no es la llamada,
        // es el chequeo), en una línea distinta a la llamada bare de abajo.
        // Sin esto core/migrate.js salía "sin guardia" pese a comprobar
        // `T?.migrateContent` justo antes (falso positivo, ver nota final).
        new RegExp(`\\w+\\?\\.${escRe(metodo)}\\b(?!\\s*\\()`).test(srcSinComentarios);
      sitios.push({ file: f, line: i + 1, guardado: guardEnLinea || guardEnFichero });
    }
  }
  return sitios;
}
function cruceD() {
  const plataforma = ficherosPlataforma();
  const hallazgos = [];
  for (const metodo of METODOS_CORE) {
    const faltan = faltantesDe(metodo);
    if (!faltan.length) continue;
    const sitios = sitiosDe(metodo, plataforma);
    if (!sitios.length) continue; // nadie lo invoca de verdad (lo verá el cruce c)
    const sinGuardia = sitios.filter(s => !s.guardado);
    hallazgos.push({ metodo, faltan, sitios, sinGuardia });
  }
  return hallazgos;
}

// ════════════════════════════════════════════════════════════════════════
// CONTRA-PRUEBA — una clase SINTÉTICA en memoria (nunca toca el registro
// real): un método `zzNadieMeLlama` que nadie invoca (cruce c) y un
// `getRoundPayload` STUB con `modes.live:true` (cruce a). Si el detector no
// ve las dos, no se confía en el resto de la salida.
// ════════════════════════════════════════════════════════════════════════
function contraPrueba() {
  let rotos = 0;
  class ZZSintetica {
    static meta = { name: 'zz-sintetica-contrato', modes: { live: true }, play: { vs: 'none', teams: 'none', live: ['rounds'] } };
    static getRoundPayload() { return null; }
    static zzNadieMeLlama() { return 1; }
  }
  if (!esStub(ZZSintetica.getRoundPayload)) {
    console.log('  ❌ CONTRA-PRUEBA rota: esStub() no ve un stub obvio (`return null`)'); rotos++;
  } else {
    const reqOk = REQUISITOS.some(r => r.aplica(ZZSintetica) && r.metodos.includes('getRoundPayload'));
    if (!reqOk) { console.log('  ❌ CONTRA-PRUEBA rota: REQUISITOS no exige getRoundPayload con play.live=[\'rounds\']'); rotos++; }
  }
  {
    const plataforma = ficherosPlataforma();
    const enPlataforma = invocadoresDe('zzNadieMeLlama', plataforma);
    const enPlantillas = invocadoresDe('zzNadieMeLlama', ficherosTemplates());
    if (enPlataforma.length || enPlantillas.length) {
      console.log('  ❌ CONTRA-PRUEBA rota: "zzNadieMeLlama" aparece invocado (imposible)'); rotos++;
    }
  }
  // Contra-prueba POSITIVA: un caso real conocido (scoreSubmission, invocado
  // de sobra) NO debe salir como huérfano — si esto fallara, el detector
  // sería tan estricto que no vale para nada.
  {
    const enPlataforma = invocadoresDe('scoreSubmission', ficherosPlataforma());
    if (!enPlataforma.length) {
      console.log('  ❌ CONTRA-PRUEBA rota: "scoreSubmission" no ve un invocador real conocido'); rotos++;
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

const hallazgosA = cruceA();
const { huerfanos: hallazgosC, soloInstrumento } = cruceC();
const hallazgosD = cruceD();
const totalSitiosSinGuardia = hallazgosD.reduce((n, h) => n + h.sinGuardia.length, 0);

// BASELINE — números de la PRIMERA pasada (2026-09-02), tras acotar los
// falsos positivos descritos al final del fichero. RATCHET: solo puede
// bajar. Si un cruce supera su número, código 1 — se añadió un estático
// nuevo con contrato a medias y hay que decidir (basura/conectar/legítimo/
// replantear), no subir el número para callar al script.
const BASELINE = { stubs: 0, copiados: 11, sinInvocador: 0, faltan: 5 };

const excedeStubs = hallazgosA.length > BASELINE.stubs;
const excedeCopiados = GRUPOS_COPIADOS.length > BASELINE.copiados;
const excedeSinInvocador = hallazgosC.length > BASELINE.sinInvocador;
const excedeFaltan = totalSitiosSinGuardia > BASELINE.faltan;

if (asJson) {
  console.log(JSON.stringify({
    stubEnModoEncendido: hallazgosA,
    copiados: GRUPOS_COPIADOS,
    sinInvocador: hallazgosC,
    soloTestOTool: soloInstrumento,
    faltanDefinicion: hallazgosD,
    matriz: {
      metodos: UNIVERSO,
      plantillas: TODAS.map(T => T.meta.name).sort(),
      celdas: Object.fromEntries(TODAS.map(T => [T.meta.name, Object.fromEntries(UNIVERSO.map(m => [m, claseCelda(T, m)]))])),
    },
    baseline: BASELINE,
  }, null, 2));
  process.exit((excedeStubs || excedeCopiados || excedeSinInvocador || excedeFaltan) ? 1 : 0);
}

const ok = (m) => console.log('  ✅', m);
const mal = (m) => console.log('  ❌', m);
const LETRA = { propio: 'P', heredado: 'H', stub: 'S', copiado: 'C', '-': '-' };

console.log('COSTURAS · B2 — contrato a medias (los estáticos de las 13)\n');

console.log('── a · STUB donde el modo está encendido ──');
if (hallazgosA.length > BASELINE.stubs) mal(`${hallazgosA.length} caso(s) (baseline ${BASELINE.stubs}):`);
else ok(`${hallazgosA.length} caso(s) (baseline ${BASELINE.stubs})`);
for (const h of hallazgosA) console.log(`     ${h.plantilla}.${h.metodo}() es stub, pero ${h.porque} lo necesita`);

console.log('\n── b · COPIADO en ≥2 plantillas (misma referencia compartida vía import = legítimo, no cuenta) ──');
if (GRUPOS_COPIADOS.length > BASELINE.copiados) mal(`${GRUPOS_COPIADOS.length} grupo(s) (baseline ${BASELINE.copiados}):`);
else ok(`${GRUPOS_COPIADOS.length} grupo(s) (baseline ${BASELINE.copiados})`);
for (const g of GRUPOS_COPIADOS) console.log(`     ${g.metodo} · ${g.plantillas.join(', ')}`);

console.log('\n── c · DEFINIDO SIN INVOCADOR ──');
if (hallazgosC.length > BASELINE.sinInvocador) mal(`${hallazgosC.length} huérfano(s) (baseline ${BASELINE.sinInvocador}):`);
else ok(`${hallazgosC.length} huérfano(s) (baseline ${BASELINE.sinInvocador})`);
for (const h of hallazgosC) console.log(`     ${h.metodo}`);
if (soloInstrumento.length) {
  console.log(`   (${soloInstrumento.length} método(s) que SOLO invoca un test/tool — informativo, no cuenta)`);
  for (const s of soloInstrumento) console.log(`     ${s.metodo} · tests: ${s.tests.join(', ') || '—'} · tools: ${s.tools.join(', ') || '—'}`);
}

console.log('\n── d · INVOCADO QUE ALGUNA NO DEFINE NI HEREDA ──');
if (totalSitiosSinGuardia > BASELINE.faltan) mal(`${totalSitiosSinGuardia} sitio(s) sin guardia (baseline ${BASELINE.faltan}):`);
else ok(`${totalSitiosSinGuardia} sitio(s) sin guardia (baseline ${BASELINE.faltan})`);
for (const h of hallazgosD) {
  console.log(`     ${h.metodo} · no lo tienen: ${h.faltan.join(', ')}`);
  for (const s of h.sitios) {
    console.log(`       ${s.guardado ? '(guardado)' : '¡SIN GUARDIA!'} ${s.file}:${s.line}`);
  }
}

console.log('\n── INFORMATIVO · matriz 13 plantillas × cada estático que alguna define ──');
console.log('   P=propio · H=heredado de base.js · S=stub · C=copiado · -=no lo tiene\n');
const nombres = TODAS.map(T => T.meta.name).sort();
const anchoMetodo = Math.max(...UNIVERSO.map(m => m.length));
const cabecera = ' '.repeat(anchoMetodo + 2) + nombres.map(n => n.slice(0, 4).padEnd(5)).join('');
console.log('   ' + cabecera);
for (const metodo of UNIVERSO) {
  const fila = nombres.map(n => {
    const T = TODAS.find(t => t.meta.name === n);
    return LETRA[claseCelda(T, metodo)].padEnd(5);
  }).join('');
  console.log(`   ${metodo.padEnd(anchoMetodo + 2)}${fila}`);
}

const total = hallazgosA.length + GRUPOS_COPIADOS.length + hallazgosC.length + totalSitiosSinGuardia;
const baseTotal = BASELINE.stubs + BASELINE.copiados + BASELINE.sinInvocador + BASELINE.faltan;
console.log(`\nB2: ${total} hallazgo(s) (baseline ${baseTotal})`);

if (excedeStubs || excedeCopiados || excedeSinInvocador || excedeFaltan) {
  console.log('❌ algún cruce superó su baseline — el ratchet solo puede bajar.');
  process.exit(1);
}
process.exit(0);

// ════════════════════════════════════════════════════════════════════════
// NOTA DE FALSOS POSITIVOS (primera pasada, antes de fijar BASELINE) —lo que
// dio ruido y cómo se acotó, siguiendo la disciplina de
// tools/costuras-declaraciones.mjs / tools/costuras-cableado.mjs:
//
//  · Cruce (a) SIN excluir el bucle 'claim' marcaba `wheel.scoreSubmission`
//    y `question-live.scoreSubmission` como contrato a medias: son
//    stubs de verdad (`() => ({ correct: null, points: 0, hits: 0, total: 0 })`,
//    SIN parámetros — ni siquiera miran `value`/`item`), pero es la forma
//    CORRECTA de "pedir la palabra" (§26): puntúa el docente a mano, sin
//    clave de respuesta, y el código lo dice en su propio comentario. El
//    mapa modo→métodos de este fichero excluye 'claim' de la exigencia de
//    `scoreSubmission`/`renderRound` (solo pide `getRoundPayload`, que
//    `registry.js` exige siempre que `modes.live` — y wheel/question-live SÍ
//    lo implementan de verdad, con lógica). Con eso, el cruce (a) queda en
//    0 hallazgos: ninguna plantilla real tiene HOY un stub donde su propio
//    `meta.play` diga que ese camino se juega. BASELINE.stubs = 0. Los 6
//    stubs REALES que sí existen hoy (informativo — se ven en la matriz como
//    `S`: migrateContent en comas/diagram/match/memory/question-live/wheel,
//    scoreSubmission en question-live/wheel) están todos fuera de lo que su
//    propia plantilla declara necesitar.
//  · Cruce (b) — la trampa de comparar SOLO por texto: `quiz.scoreSubmission`/
//    `globos.scoreSubmission` y `quiz.renderEditor`/`globos.renderEditor`
//    tienen cuerpo IDÉNTICO pero NO cuentan como copiados: Globos hace
//    `import { scoreQuizSubmission } from '../quiz/scorer.js'; static
//    scoreSubmission = scoreQuizSubmission` — es la MISMA función (`===`),
//    reutilización ya resuelta. Comparar solo por TEXTO (como hace
//    `tools/costuras-declaraciones.mjs` con `meta.*`) habría contado esto
//    como duplicado y mandado a "subir a base.js" algo que ya está subido.
//    Se añadió el filtro por `Function !== Function` (`distinctRefs`) — un
//    grupo con una sola referencia real, aunque lo compartan 5 plantillas,
//    no es una copia.
//  · Cruce (b) SÍ atrapa 11 grupos de funciones DISTINTAS (sintaxis de
//    método de clase, no `= fnCompartida`) con cuerpo normalizado idéntico:
//    `migrateContent` en comas/diagram/match/memory (`return content;`,
//    escrito CUATRO veces), en question-live/wheel
//    (`return migrateLegacyItems(content);`) y en globos/math
//    (`return stripSeededPoints(content);`); `getRoundPayload`,
//    `renderEditor`, `itemLabel` y `valueParts` en comas/tildes (las dos
//    plantillas de corrección de texto: mismo envoltorio, solo cambia el
//    `kind:'coma'|'tilde'` que SÍ está parametrizado en `renderRound`/
//    `scoreSubmission`/`renderRoundHost` — por eso esos tres NO salen en la
//    lista, ver la matriz); `getRoundPayload`/`scoreSubmission` en
//    question-live/wheel; `renderRound` en quiz/match
//    (`renderChoiceRound(root, payload, opts);`); `adoptContent` en
//    quiz/globos (`adoptForQuiz(content);` — el WRAPPER de una línea se
//    escribió dos veces aunque el helper de dentro sí esté compartido).
//    Candidatos reales a que el helper compartido SEA el estático (o a que
//    `templates/base.js` traiga un `migrateContent` identidad por defecto,
//    como ya hace con `renderRoundHost`), o a que comas/tildes compartan una
//    factoría `createTextCorrectionTemplate(kind)` en vez de repetir cuatro
//    envoltorios. BASELINE.copiados = 11 (los once grupos).
//  · Cruce (c): con los 12 métodos del universo actual, los 13 registran
//    invocador real en core/views/kernel/adapters o en otra plantilla — 0
//    huérfanos. OJO con `itemParts`: `core/itemStats.js` lo invoca como
//    `template?.itemParts?.({…})` — doble encadenado opcional, SIN espacio
//    ni paréntesis pegado al nombre del método. El primer regex
//    (`\.metodo\s*\(`) no lo veía y `itemParts` salía "sin invocador" —
//    falso positivo de la primera pasada. Se amplió a `\.metodo\??\.?\(`
//    (cubre `.metodo(` y `.metodo?.(`). `itemParts`/`valueParts`/`itemLabel`
//    (el contrato opcional de analítica, M1) SÍ cuentan como invocador de
//    plataforma vía `core/itemStats.js` (no es un test ni un tool), así que
//    no caen en la lista informativa "solo test/tool". BASELINE.sinInvocador = 0.
//  · Cruce (d): de los 9 métodos CORE, `renderPlayer`/`renderEditor` los
//    tienen las 13 (los exige `registry.js` al registrar) y
//    `scoreSubmission` también (todas las 13 lo definen hoy, aunque en
//    wheel/question-live sea el stub declarado de 'claim') — ninguno de los
//    tres entra en este cruce (`faltantesDe` da lista vacía). De los que sí
//    faltan en alguna plantilla, la mayoría de sitios de invocación
//    resultaron GUARDADOS por la heurística textual — con un
//    `typeof X.metodo === 'function'` en el mismo fichero (`teamsView.js`,
//    `hostTablero.js`), un `?.`/ternario en la propia línea (`kernel/
//    session/score.js`, `core/editorShell.js`, `kernel/content/switch.js`)
//    o un `if (T?.metodo)` de comprobación previa a la llamada bare
//    (`core/migrate.js:68` — la primera versión de la heurística solo
//    reconocía `?.` PEGADO al paréntesis o seguido de `===`/`&&`, así que
//    esta forma —`?.` como VALOR de un `if`— se colaba como "sin guardia":
//    otro falso positivo corregido, con su propia nota en el código).
//    Quedan 5 sitios que la heurística no puede casar con ninguna guardia
//    TEXTUAL, y los 5 son el MISMO patrón: el guardia existe, pero vive
//    AGUAS ARRIBA, en el enrutado por BUCLE/modo, no en el propio fichero —
//    `views/vsView.js:341` (VS solo se ofrece a plantillas donde
//    `isVsCompatible()`, kernel/session/vsMachine.js, ya comprobó
//    `renderRound` antes de montar la vista) y los cuatro de en vivo
//    (`views/live/studentRondas.js:97,115`, `studentCarrera.js:144`,
//    `studentTablero.js:52`: cada uno solo se monta para el BUCLE que
//    `core/liveLoops.js` ya emparejó con plantillas que declaran
//    `renderRound`, nunca para wheel/memory/question-live/crossword/diagram
//    — que son precisamente las que no lo tienen). No se le pidió a la
//    heurística que siguiera el flujo entre módulos (repetiría, con más
//    código, el mismo problema que este barrido persigue: una regla escrita
//    dos veces, aquí "qué plantilla puede llegar a esta vista"). Se deja
//    así, documentado, en vez de una lista de excepciones ad-hoc.
//    BASELINE.faltan = 5 — los cinco sitios seguirán marcados "¡SIN
//    GUARDIA!" en la salida (es la lectura correcta del TEXTO); quien juzgue
//    la lista los marca `legítimo (guardia aguas arriba: enrutado por
//    modo/bucle)`.
