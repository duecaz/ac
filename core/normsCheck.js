// Normas transversales EJECUTABLES — escáner puro de fuente JS que convierte
// las reglas de CLAUDE.md ("Estándares transversales") en checks de máquina:
//
//   · resize-observer : NUNCA `new ResizeObserver(` fuera de core/observeResize.js
//                       (un RO directo cuyo callback muta layout dispara el aviso
//                       "ResizeObserver loop…"; el helper rAF-debounced es la norma).
//   · pb-filter       : NUNCA construir `?filter=` de PocketBase con
//                       `encodeURIComponent` en la misma expresión (no escapa la
//                       comilla simple → inyección/rotura del filtro). La norma es
//                       pbEscape/pbFilterParam (core/pbFilter.js).
//   · kernel-puro     : kernel/** es el cerebro PURO y determinista: sin
//                       `Date.now()` ni `new Date()` (el reloj se inyecta vía
//                       core/clock.js; sin esto los tests dejan de ser deterministas).
//   · ls-dueno        : LEY DE DATOS (docs/leyes.md §21) aplicada al ALMACÉN —
//                       cada clave `ww.*` de localStorage/sessionStorage está
//                       DECLARADA en LS_OWNERS con UN dueño; nadie más la nombra.
//                       Sin esta regla `ww.nick` acabó declarada en dos vistas y
//                       `ww.skin` se leía sin que nadie la escribiera nunca.
//   · pb-dueno        : LEY DE DATOS (docs/leyes.md §21) — cada colección de
//                       PocketBase tiene UN módulo dueño; nadie más la nombra
//                       (ni por URL `collections/x` ni por literal 'x'). Un
//                       módulo nuevo que necesite esos datos pide un método al
//                       dueño, no hace fetch por su cuenta — así "parchar algo"
//                       escribiendo directo a la BD hace fallar CI.
//   · confianza-alumno: LEY DE CONFIANZA (docs/leyes.md §22) — el código del
//                       LADO ALUMNO (views/student*) no puede ni NOMBRAR los
//                       verbos del host (settleItem, endSession, startSession,
//                       kickPlayer, setSessionState, fetchSessionKey/Blob): el
//                       alumno AFIRMA, nunca liquida ni controla la sala. Para
//                       pedir la palabra tiene `claimQuestion`, que escribe
//                       SOLO el campo `ql` (fuera del blob de control).
//   · reloj-primitivo : LEY DE VISTA (docs/leyes.md §23) — nunca `setInterval(`
//                       a pelo: un reloj repetitivo va por su primitivo
//                       (createCountdown / startDeadlineTicker /
//                       startElapsedTicker) o por `ctx.setInterval` (lifecycle,
//                       que lo limpia al salir de la ruta). Un interval crudo
//                       es el reloj zombi que repinta sobre la vista siguiente.
//   · id-rid          : LEY DE CONTENIDO (docs/leyes.md §24) — IDs SIEMPRE con
//                       `rid()` de core/ids.js, nunca `Math.random().toString(36)`
//                       a mano (estaba copiado en ~17 sitios con longitudes y
//                       prefijos dispares).
//
// Lo consumen DOS runners (mismo patrón que core/templateContract.js):
//   · tests/norms.test.mjs — Node, recorre el filesystem COMPLETO (autoridad).
//   · core/selftest.js     — panel #/admin: humo del deploy sobre BROWSER_SCAN_FILES
//                            + los ficheros de plantilla derivados del registro.
const ALLOW = {
  'resize-observer': ['core/observeResize.js'],
  'pb-filter': ['core/pbFilter.js'],   // pbFilterParam usa encodeURIComponent legítimamente
  'kernel-puro': [],
  // Los primitivos de reloj y el ctx del lifecycle SON la implementación.
  'reloj-primitivo': ['core/lifecycle.js', 'core/soloTimer.js', 'core/deadlineTicker.js'],
  'id-rid': ['core/ids.js'],   // la única implementación permitida
};

// LEY DE DATOS — colección → ficheros que pueden nombrarla. El PRIMERO es el
// DUEÑO (único escritor); `views/adminView.js` está en todas por ser el dueño
// del ESQUEMA (crear colecciones/reglas), y `core/stressTest.js` es la
// excepción sancionada (prueba de carga: escribe filas `stress_*` y las borra).
// Los marcados "lector directo" son deuda registrada en la ley: leen bien pero
// esquivan al dueño; al migrarlos, quítalos de aquí (el ratchet solo encoge).
// Dueños del ESQUEMA y de las REGLAS: nombran TODAS las colecciones por
// definición (crear colecciones / declarar sus reglas), así que están exentos de
// la regla de dueño-por-colección. Se añaden a cada lista más abajo.
const PB_SCHEMA_OWNERS = ['views/adminView.js', 'core/pbRules.js'];

/** Dueño de cada colección (§21). Exportado para que `tools/module-map.mjs`
 *  dibuje el mapa de datos de la misma fuente que lo vigila. */
export const PB_OWNERS = {
  // Ya NO hay lectores directos: portada, Explorar, perfil de autor, el panel de
  // Profesores y el diagnóstico piden métodos al dueño (M6). El ratchet solo
  // encoge: no volver a añadir ficheros aquí, se añade un método al dueño.
  activities: ['adapters/pocketbase/remoteStore.js', 'views/adminView.js'],
  results: ['adapters/pocketbase/remoteStore.js', 'views/adminView.js'],
  live_sessions: ['adapters/pocketbase/realtime.js', 'views/adminView.js', 'core/stressTest.js'],
  live_answers: ['adapters/pocketbase/realtime.js', 'views/adminView.js', 'core/stressTest.js'],
  live_players: ['adapters/pocketbase/realtime.js', 'views/adminView.js', 'core/stressTest.js'],
  live_keys: ['adapters/pocketbase/realtime.js', 'views/adminView.js'],
  // stressTest: la prueba de carga registra la credencial del alumno simulado
  // (§22-4) porque sin ella el servidor rechaza sus respuestas — simular al
  // alumno es justo su trabajo, igual que ya lo hace en live_players/answers.
  live_claims: ['adapters/pocketbase/realtime.js', 'views/adminView.js', 'core/stressTest.js'],
  assignments: ['adapters/pocketbase/assignments.js', 'views/adminView.js', 'core/stressTest.js',
    'adapters/index.js'],  // pbCollectionExists: decide el fallback local, no escribe
  assignment_attempts: ['adapters/pocketbase/assignments.js', 'views/adminView.js', 'core/stressTest.js'],
  reports: ['core/reports.js', 'views/adminView.js'],
  activity_likes: ['core/likes.js', 'views/adminView.js'],
  profiles: ['core/profile.js', 'views/adminView.js'],
  users: ['core/auth.js', 'core/teachers.js', 'views/adminView.js'],
  _superusers: ['views/adminView.js'],
};
// LEY DE DATOS, aplicada al ALMACÉN LOCAL (§21) — prefijo de clave → ficheros
// que pueden nombrarla; el PRIMERO es el dueño. Las colecciones de PocketBase
// tenían registro y guardián desde L1; las ~30 claves `ww.*` no tenían ni una
// cosa ni la otra, y se notó (auditoría v1.51.397): `ww.nick` acabó DECLARADA
// DOS VECES (studentLive y studentTask, una de ellas escribiendo con
// `localStorage` crudo) y `ww.skin` se leía en los dos `main.*` sin que nadie
// la escribiera jamás. Con este registro, las dos se cazan solas.
//
// Se casa por PREFIJO (gana el más largo declarado) porque muchas claves llevan
// sufijo dinámico: `ww.activities.<uid>`, `ww.solo.progress.<id>`, `ww.live.<code>`…
export const LS_OWNERS = {
  'ww.activities': ['core/storage.js', 'core/io.js'],  // io.js: export/import del dueño
  'ww.tombstones': ['core/storage.js'],
  'ww.anonId': ['core/state.js', 'core/pbRules.js'],   // pbRules la NOMBRA al declarar reglas
  'ww.nick': ['core/identity.js'],                     // el apodo es de la identidad, no de una pantalla
  'ww.pb.auth': ['core/auth.js'],
  'ww.pb.synced': ['adapters/pocketbase/remoteStore.js'],
  'ww.oauth.pending': ['core/auth.js'],
  'ww.google.token': ['core/auth.js'],
  'ww.classroom.token': ['core/classroomAuth.js'],
  'ww.claim.': ['adapters/pocketbase/realtime.js'],
  'ww.live_words': ['core/liveWords.js'],
  'ww.live.': ['adapters/local/realtime.js'],
  'ww.assignments': ['adapters/local/assignments.js'],
  'ww.assignment_attempts': ['adapters/local/assignments.js'],
  'ww.remote.': ['adapters/local/remoteStore.js'],
  'ww.backend': ['adapters/index.js'],
  'ww.resultQueue': ['core/results.js'],
  'ww.submitQueue': ['core/submitQueue.js'],
  'ww.attemptQueue': ['core/attemptQueue.js'],
  'ww.errlog': ['core/errorLog.js'],
  'ww.profile.': ['core/profile.js'],
  'ww.muted': ['core/sounds.js'],
  'ww.fxMuted': ['core/effects.js'],
  'ww.solo.progress.': ['core/soloPlayer.js'],
  'ww.vs.anims': ['core/vsAnimStore.js'],
  'ww.vsavatar.': ['views/vsView.js'],
  'ww.streaks': ['core/streaks.js'],
  'ww.player.': ['views/studentLive.js'],   // sessionStorage: la fila de jugador de ESTA sala
  'ww.vreload.': ['views/studentLive.js'],
};
const LS_PREFIXES = Object.keys(LS_OWNERS).sort((a, b) => b.length - a.length);
// Cualquier literal 'ww.…' que aparezca en el código.
const LS_LITERAL_RE = /['"`](ww\.[A-Za-z0-9_.]*)/g;

// Precompilado: nombre → regex que caza `collections/<x>` o el literal '<x>'.
const PB_RES = Object.keys(PB_OWNERS).map(c => ({
  coll: c,
  allow: [...PB_OWNERS[c], ...PB_SCHEMA_OWNERS],
  re: new RegExp(`collections/${c}(?![a-zA-Z_])|['"\`]${c}['"\`]`),
}));

// LEY DE CONFIANZA — verbos del HOST que el lado alumno no puede ni nombrar.
// (Como cadenas, no regex literal: si fueran identificadores, moduleRefs los
// contaría como "usados sin importar" en este mismo fichero.)
const HOST_VERBS = ['settleItem', 'endSession', 'startSession', 'kickPlayer', 'setSessionState',
  'fetchSessionKey', 'fetchSessionBlob'];
const HOST_VERBS_RE = new RegExp(`\\b(${HOST_VERBS.join('|')})\\b`);

// Comentarios fuera (mismo truco que tests/styles.test.mjs: se preservan los
// saltos de línea para que los números de línea no se corran).
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));

/**
 * Escanea UN fichero. `path` relativo a la raíz del repo (p.ej. "views/explore.js").
 * @returns {{path:string, line:number, rule:string, text:string}[]}
 */
export function scanNormsSource(path, source) {
  const out = [];
  const lines = blank(String(source || '')).split('\n');
  const allowed = (rule) => ALLOW[rule].some(a => path.endsWith(a));
  lines.forEach((ln, i) => {
    if (/new\s+ResizeObserver\s*\(/.test(ln) && !allowed('resize-observer')) {
      out.push({ path, line: i + 1, rule: 'resize-observer', text: ln.trim() });
    }
    if (/filter=/.test(ln) && /encodeURIComponent\s*\(/.test(ln) && !allowed('pb-filter')) {
      out.push({ path, line: i + 1, rule: 'pb-filter', text: ln.trim() });
    }
    if (path.startsWith('kernel/') && /(Date\.now\s*\(|new Date\s*\(\s*\))/.test(ln)) {
      out.push({ path, line: i + 1, rule: 'kernel-puro', text: ln.trim() });
    }
    for (const { coll, re, allow } of PB_RES) {
      if (re.test(ln) && !allow.some(a => path.endsWith(a))) {
        out.push({ path, line: i + 1, rule: 'pb-dueno', text: `[${coll}] ${ln.trim()}` });
      }
    }
    // ls-dueno: toda clave del almacén está DECLARADA y solo la nombra su dueño.
    // (Este mismo fichero ES el registro: nombra todas por definición.)
    for (const m of (path.endsWith('core/normsCheck.js') ? [] : ln.matchAll(LS_LITERAL_RE))) {
      const clave = m[1];
      const pref = LS_PREFIXES.find(p => clave.startsWith(p));
      if (!pref) {
        out.push({ path, line: i + 1, rule: 'ls-dueno', text: `[${clave}] clave sin dueño declarado en LS_OWNERS` });
      } else if (!LS_OWNERS[pref].some(a => path.endsWith(a))) {
        out.push({ path, line: i + 1, rule: 'ls-dueno', text: `[${clave}] la escribe/lee ${path}, y su dueño es ${LS_OWNERS[pref][0]}` });
      }
    }
    if (path.startsWith('views/student') && HOST_VERBS_RE.test(ln)) {
      out.push({ path, line: i + 1, rule: 'confianza-alumno', text: ln.trim() });
    }
    // `setInterval(` sin prefijo (ctx.setInterval y setIntervalFn( son legítimos).
    if (/(^|[^.\w])setInterval\s*\(/.test(ln) && !allowed('reloj-primitivo')) {
      out.push({ path, line: i + 1, rule: 'reloj-primitivo', text: ln.trim() });
    }
    if (/Math\.random\s*\(\s*\)\s*\.toString\s*\(\s*36\s*\)/.test(ln) && !allowed('id-rid')) {
      out.push({ path, line: i + 1, rule: 'id-rid', text: ln.trim() });
    }
  });
  return out;
}

// Ficheros que el self-test del ADMIN alcanza por fetch (GitHub Pages no lista
// directorios). Los de plantilla NO van aquí: se derivan del registro en
// runtime (templates/<name>/{template,player,editor}.js). Esta lista es humo
// del deploy — la AUTORIDAD exhaustiva es tests/norms.test.mjs (recorre fs),
// así que un fichero nuevo queda cubierto por CI aunque no esté listado aquí.
export const BROWSER_SCAN_FILES = [
  'adapters/index.js',
  'adapters/local/assignments.js', 'adapters/local/realtime.js', 'adapters/local/remoteStore.js',
  'adapters/pocketbase/assignments.js', 'adapters/pocketbase/realtime.js', 'adapters/pocketbase/remoteStore.js',
  'kernel/session/engine.js', 'kernel/session/memory.js', 'kernel/live/engine.js',
  'views/adminView.js', 'views/assignments.js', 'views/editList.js', 'views/editView.js',
  'views/embedModal.js', 'views/explore.js', 'views/home.js', 'views/hostLive.js',
  'views/listView.js', 'views/memoryView.js', 'views/modeSetup.js', 'views/playerView.js',
  'views/reports.js', 'views/sorteoView.js', 'views/startScreen.js', 'views/studentLive.js',
  'views/studentTask.js', 'views/switchTemplate.js', 'views/teamsView.js',
  'views/templateSelector.js', 'views/vsView.js',
  'core/textCorrectionRound.js', 'core/textCorrectionDraw.js', 'core/activityThumb.js',
  'core/soloPlayer.js', 'core/connectRope.js', 'core/liveTransport.js',
];
