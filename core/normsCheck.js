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
//   · fallo-mudo      : R6 del norte ("la clase no espera": fallar en silencio
//                       está PROHIBIDO) — un `catch {}` vacío que se traga una
//                       operación que el usuario PIDIÓ (guardar, borrar,
//                       entregar, sincronizar). El best-effort no se prohíbe: se
//                       exige DECIR el motivo en un comentario, que es justo
//                       cuando uno se da cuenta de si de verdad lo era.
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
//   · imagen-buscable : toda puerta de imagen de CONTENIDO ofrece las DOS vías —
//                       subir un archivo Y buscar una libre (core/imageSearchModal.js).
//                       «Etiqueta el diagrama» solo dejaba subir: quien quería un
//                       corazón humano no tenía ninguno en el móvil y no podía ni
//                       empezar. Las excepciones (perfil, avatar, fondo de partida)
//                       están declaradas con su motivo en ALLOW.
//   · reloj-primitivo : LEY DE VISTA (docs/leyes.md §23) — nunca `setInterval(`
//                       a pelo: un reloj repetitivo va por su primitivo
//                       (createCountdown / startDeadlineTicker /
//                       startElapsedTicker) o por `ctx.setInterval` (lifecycle,
//                       que lo limpia al salir de la ruta). Un interval crudo
//                       es el reloj zombi que repinta sobre la vista siguiente.
//   · reloj-sala      : LEY DE CONFIANZA §22-5 (docs/leyes.md) — un INSTANTE DE
//                       LA SALA (answers_open_at · deadline · started_at ·
//                       last_seen) lo estampa un aparato y lo leen otros, así
//                       que se compara y se sella con `serverNow()` (hora
//                       común), NUNCA con `clock.now()` (el reloj de este
//                       cacharro). Con un Android 10 s atrasado, el profe veía
//                       «Preparados… 9» y el alumno «19»; con 25 s, al alumno
//                       no se le abrían las respuestas y la pregunta se
//                       liquidaba «sin respuesta · 0 puntos».
//   · azar-primitivo  : LEY DE VISTA (docs/leyes.md §23), gemela de reloj-primitivo
//                       — el azar sale del PRIMITIVO `azar.random()`
//                       (core/azar.js) y el barajado, de su `shuffle`. Nadie
//                       nombra `Math.random` salvo los usos declarados en ALLOW
//                       con su motivo: IDs, confeti, partículas, jitter de
//                       reconexión y los PIN de sala y tarea, que deben ser
//                       IMPREDECIBLES (reproducirlos sería el fallo).
//                       Se paga en herramientas: `tools/shots.mjs` comparaba dos
//                       capturas del MISMO árbol y cantaba 2.500 píxeles de
//                       cambio porque Quiz baraja al montar, y el apaño fue
//                       apagar el barajado de UNA plantilla desde su `rules`.
//                       Prohibido también el Fisher–Yates a mano: estaba copiado
//                       en cuatro sitios y el dueño es `shuffle` de core/azar.js.
//   · id-rid          : LEY DE CONTENIDO (docs/leyes.md §24) — IDs SIEMPRE con
//                       `rid()` de core/ids.js, nunca `Math.random().toString(36)`
//                       a mano (estaba copiado en ~17 sitios con longitudes y
//                       prefijos dispares).
//   · almacen-crudo   : LEY DE DATOS (docs/leyes.md §21) aplicada al ALMACÉN,
//                       gemela de `ls-dueno` pero por el otro lado: `ls-dueno`
//                       vigila que cada CLAVE tenga un dueño; esta vigila que
//                       el ACCESO en sí pase por el wrapper. Ningún fichero
//                       fuera de `core/ls.js` nombra `localStorage.` /
//                       `sessionStorage.` / `globalThis.localStorage` — el
//                       barrido `tools/costuras-cableado.mjs` encontró 35
//                       sitios saltándose el portero (informativo entonces, sin
//                       CI detrás). Los wrappers `ls*`/`ss*` son el ÚNICO punto
//                       que sabe tratar la ausencia de storage (modo privado,
//                       sandbox estricto) y la cuota llena — un acceso directo
//                       no hereda ese tratamiento y revienta donde el wrapper
//                       no revienta. Excepciones en ALLOW_ALMACEN_CRUDO, con motivo.
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
  'reloj-primitivo': ['core/lifecycle.js', 'core/soloTimer.js', 'core/deadlineTicker.js',
    // El vigía de un flujo permanente (SSE) es el CUARTO primitivo de reloj: no
    // pinta, vigila silencio y renueva la conexión. Su scheduler se inyecta.
    'core/streamWatchdog.js'],
  'id-rid': ['core/ids.js'],   // la única implementación permitida
  // azar-primitivo · quién PUEDE nombrar `Math.random`, y por qué. Los dos
  // primeros SON la implementación; el resto no es contenido que nadie juegue, y
  // los PIN además tienen que ser IMPREDECIBLES: reproducirlos sería el fallo.
  'azar-primitivo': [
    'core/azar.js', 'core/ids.js',
    'core/effects.js',          // confeti
    'core/soloAnimations.js',   // partículas
    'core/migrate.js',          // PIN de sala
    'core/liveWords.js',        // palabra-código de la sala (misma familia que el PIN)
    'core/streamWatchdog.js',   // jitter de reconexión (y su scheduler ya se inyecta)
    'adapters/pocketbase/assignments.js', 'adapters/local/assignments.js',  // PIN de tarea
    'adapters/pocketbase/realtime.js',    // jitter
  ],
  // `core/serverNow.js` ES la hora común (usa clock.now para calcularla) y
  // `core/deadlineTicker.js` ya la consume; `core/clock.js` es el reloj crudo.
  'reloj-sala': ['core/serverNow.js', 'core/clock.js', 'core/deadlineTicker.js'],
  // imagen-buscable · quién puede pedir una imagen SIN ofrecer buscarla, y por qué.
  // Los dos primeros SON la implementación; los tres siguientes no piden imagen
  // de CONTENIDO: la foto de perfil y el avatar del duelo son de una PERSONA
  // (buscarle la cara en internet es justo lo que R7 no quiere) y el fondo del
  // player es un capricho de ESTA partida, que no se guarda en la actividad.
  'imagen-buscable': [
    'core/upload.js', 'core/backgrounds.js',
    'views/author.js', 'views/vsView.js', 'views/playerView.js',
  ],
};

// almacen-crudo · quién PUEDE nombrar `localStorage`/`sessionStorage` a pelo
// fuera de `core/ls.js`, y por qué. `core/ls.js` mismo no necesita entrada
// (está excluido explícitamente en el escáner, igual que `ls-dueno`).
export const ALLOW_ALMACEN_CRUDO = {
  // El KV inyectable de los drivers OFFLINE (dev sin PocketBase, sin DOM en
  // los tests): necesitan poder sustituir el storage por un objeto falso, algo
  // que los wrappers de core/ls.js (que hablan SIEMPRE con el storage global
  // real) no ofrecen. No es contenido de producción con la clase delante.
  'adapters/local/assignments.js': 'KV inyectable para tests sin DOM (dev offline)',
  'adapters/local/realtime.js': 'KV inyectable para tests sin DOM (dev offline)',
  'adapters/local/remoteStore.js': 'KV inyectable para tests sin DOM (dev offline)',
  // Arnés de pruebas manual (hoja imprimible de QA), no producto: nunca corre
  // con la clase delante y no pasa por §21.
  'qa/hoja.js': 'arnés de pruebas, no producto',
};
const RE_ALMACEN_CRUDO = /\blocalStorage\s*\.|\bsessionStorage\s*\.|globalThis\.localStorage\b/;

// chrome-boton · las vistas del PANEL que ya visten con la familia propia
// (.btn-ghost / .btn-primary-solid, styles/home.css) y por tanto NO pueden
// volver a Bootstrap. Es un RATCHET con lista declarada, igual que LS_OWNERS:
// lo que está limpio no retrocede, y lo que falta por migrar (adminView,
// assignments, editView, editList, reports, moderate, templateSelector…) sigue
// siendo legal hasta que se decidan las variantes que la familia aún no tiene
// (no hay `.btn-ghost--danger` para los borrados del admin).
// `views/playerView.js` NO está aquí a propósito: su cabecera es chrome, pero
// los botones de MODO (Individual/VS/Equipos) llevan el color del modo y son
// affordance de JUEGO, no de panel — el día que se separen, entra en la lista.
export const CHROME_VIEWS = [
  'views/home.js', 'views/landing.js', 'views/explore.js',
  'views/juegos.js', 'views/author.js',
];

// §22-5 · Los nombres de los INSTANTES DE LA SALA. Si uno de estos aparece en la
// misma línea que `clock.now()`, se está midiendo tiempo compartido con el reloj
// de un solo aparato. La lista es de NOMBRES REALES del blob de la sala, no un
// patrón adivinado: al añadir un instante nuevo, se añade aquí.
// Solo nombres INEQUÍVOCOS: los campos del blob de la sala y los locales que se
// derivan de ellos. Fuera quedan a propósito `startedAt`/`timeUsed` (un aparato
// midiendo SU propia duración: el player Individual, el cronómetro de Pelotas)
// y los objetivos locales calculados a partir de una espera ya acotada — ahí el
// reloj del cacharro es el correcto, y meterlos daría un guardián que grita en
// los sitios buenos hasta que alguien lo apaga.
const INSTANTES_SALA = [
  'answers_open_at', 'openAtMs',
  'deadlineMs', 'liveDeadline',
  'started_at',
  'last_seen',
];

// LEY DE DATOS — colección → ficheros que pueden nombrarla. El PRIMERO es el
// DUEÑO (único escritor); el ESQUEMA (crear colecciones/reglas) tiene su lista
// del ESQUEMA (crear colecciones/reglas), y `core/stressTest.js` es la
// excepción sancionada (prueba de carga: escribe filas `stress_*` y las borra).
// Los marcados "lector directo" son deuda registrada en la ley: leen bien pero
// esquivan al dueño; al migrarlos, quítalos de aquí (el ratchet solo encoge).
// Dueños del ESQUEMA y de las REGLAS: nombran TODAS las colecciones por
// definición (crear colecciones / declarar sus reglas), así que están exentos de
// la regla de dueño-por-colección. Se añaden a cada lista más abajo.
// v1.51.629: el panel se partió POR PANEL y el esquema/las reglas viven en su
// sección (collections.js; ai.js prueba la clave con la sesión de _superusers).
// El ensamblador adminView.js ya no nombra NINGUNA colección — se le quita el
// permiso en vez de duplicarlo: un dueño que no escribe es un permiso muerto.
const PB_SCHEMA_OWNERS = ['views/admin/collections.js', 'views/admin/ai.js', 'core/pbRules.js'];

/** Dueño de cada colección (§21). Exportado para que `tools/module-map.mjs`
 *  dibuje el mapa de datos de la misma fuente que lo vigila. */
export const PB_OWNERS = {
  // Ya NO hay lectores directos: portada, Explorar, perfil de autor, el panel de
  // Profesores y el diagnóstico piden métodos al dueño (M6). El ratchet solo
  // encoge: no volver a añadir ficheros aquí, se añade un método al dueño.
  activities: ['adapters/pocketbase/remoteStore.js'],
  results: ['adapters/pocketbase/remoteStore.js'],
  // El adaptador de live se partió POR COLECCIÓN (v1.51.627): el dueño es la
  // FAMILIA realtime* — el ensamblador declara las constantes y cada sección
  // toca solo la suya. Solo se listan los ficheros que de verdad la NOMBRAN.
  live_sessions: ['adapters/pocketbase/realtime.js', 'adapters/pocketbase/realtimeRooms.js', 'core/stressTest.js', 'core/raceE2e.js'],
  live_answers: ['adapters/pocketbase/realtime.js', 'core/stressTest.js', 'core/raceE2e.js'],
  live_players: ['adapters/pocketbase/realtime.js', 'core/stressTest.js', 'core/raceE2e.js'],
  live_keys: ['adapters/pocketbase/realtime.js', 'adapters/pocketbase/realtimeRooms.js'],
  // stressTest y raceE2e (carrera e2e de botón): simulan al alumno — filas
  // `stress_*` que ellos mismos borran; misma excepción sancionada.
  // stressTest: la prueba de carga registra la credencial del alumno simulado
  // (§22-4) porque sin ella el servidor rechaza sus respuestas — simular al
  // alumno es justo su trabajo, igual que ya lo hace en live_players/answers.
  live_claims: ['adapters/pocketbase/realtime.js', 'core/stressTest.js', 'core/raceE2e.js'],
  assignments: ['adapters/pocketbase/assignments.js', 'core/stressTest.js',
    'adapters/index.js'],  // pbCollectionExists: decide el fallback local, no escribe
  assignment_attempts: ['adapters/pocketbase/assignments.js', 'core/stressTest.js'],
  reports: ['core/reports.js'],
  activity_likes: ['core/likes.js'],
  profiles: ['core/profile.js'],
  users: ['core/auth.js', 'core/teachers.js'],
  // Las claves de la IA: dueño ÚNICO desde que hubo que gestionar varias. El
  // panel le pide métodos; no habla con la colección, y así el `fields=` que
  // deja la clave en el servidor vive en un solo sitio.
  ia_config: ['core/iaKeys.js'],
  _superusers: [],   // solo el esquema (PB_SCHEMA_OWNERS) la nombra
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
  'ww.claim.': ['adapters/pocketbase/realtimeClaims.js'],   // la credencial vive en su sección (§22-4)
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
  // sessionStorage: calibración del PUNTERO de ESTE aparato para ESTA visita.
  // Renombrada desde la heredada `ep-pen-thresholds` (no era `ww.*`, sin dueño
  // declarado); §24 no aplica (no es contenido del usuario, es calibración local).
  'ww.pen.thresholds': ['core/penDetector.js'],
};
const LS_PREFIXES = Object.keys(LS_OWNERS).sort((a, b) => b.length - a.length);

// R6 · FALLAR EN SILENCIO ESTÁ PROHIBIDO. Un `catch {}` vacío alrededor de una
// operación que el usuario PIDIÓ (guardar, borrar, entregar…) es la forma más
// barata de perder el trabajo de una clase sin que nadie se entere.
const CATCH_VACIO_RE = /catch\s*(\([A-Za-z_$][\w$]*\))?\s*\{\s*\}/;
// Como CADENAS y no regex literal: escritos como identificadores, moduleRefs
// los contaría como "usados sin importar" en este mismo fichero (mismo truco
// que HOST_VERBS más abajo).
const VERBOS_USUARIO = ['save', 'remove', 'delete', 'submit', 'record', 'create', 'update',
  'patch', 'post', 'fetch', 'send', 'upload', 'publish', 'flush', 'settle', 'end' + 'Session'];
const VERBO_USUARIO_RE = new RegExp(`\\b(${VERBOS_USUARIO.join('|')})\\w*\\s*\\(`, 'i');
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

// El intercambio de Fisher–Yates, escrito a mano: `[a[i], a[j]] = [a[j], a[i]]`.
// Con UNA retro-referencia basta (el array tiene que ser el mismo); pedir además
// que los índices se crucen era precisión que no compraba nada —un barajado con
// variable temporal se escapa de las dos formas— a cambio de un regex que nadie
// puede verificar de un vistazo. Comprobado sobre todo el repo: mismas líneas.
const BARAJADO_A_MANO = /\[\s*(\w+)\[[^\]]+\]\s*,\s*\1\[[^\]]+\]\]\s*=\s*\[\s*\1\[/;

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
  const crudas = String(source || '').split('\n');   // CON comentarios: el motivo se lee ahí
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
    // almacen-crudo: SOLO core/ls.js habla directamente con el storage; el
    // resto pasa por lsGet/lsSet/lsDel/ssGet/ssSet/ssDel.
    if (!path.endsWith('core/ls.js')
        && !Object.keys(ALLOW_ALMACEN_CRUDO).some(a => path.endsWith(a))
        && RE_ALMACEN_CRUDO.test(ln)) {
      out.push({ path, line: i + 1, rule: 'almacen-crudo', text: ln.trim() });
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
    // fallo-mudo: un `catch {}` VACÍO que se traga una operación que el usuario
    // PIDIÓ (guardar, borrar, entregar, sincronizar) sin decir por qué. R6 del
    // norte: "fallar en silencio está prohibido". No se prohíbe el best-effort
    // —hay teardowns y `setPointerCapture` que deben poder fallar—: se exige
    // DECIR el motivo en un comentario, que es cuando uno se da cuenta de si de
    // verdad lo era. El almacén local queda fuera (su aviso ya lo da core/ls.js
    // con `ww:storage-full`, y limpiar una clave que no está es inofensivo).
    if (CATCH_VACIO_RE.test(ln)) {
      const ctxTry = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
      const almacen = /(local|session)Storage/.test(ctxTry);
      const conMotivo = /\/\/|\/\*/.test(crudas[i] || '') || /\/\/|\*/.test(crudas[i - 1] || '');
      if (VERBO_USUARIO_RE.test(ctxTry) && !almacen && !conMotivo) {
        out.push({ path, line: i + 1, rule: 'fallo-mudo', text: ln.trim() });
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
    // azar-primitivo · el azar sale del PRIMITIVO, en TODO el repo.
    //
    // Dos correcciones de altitud, las dos aprendidas en caliente:
    // · El alcance era una lista de rutas (`kernel/`, `templates/` y tres
    //   ficheros de core NOMBRADOS). Eso lo hacía la única regla del fichero que
    //   mira solo donde se le dice: su modo de fallar era SILENCIOSO —un
    //   `core/loQueSea.js` nuevo que ordenase lo que ve la clase simplemente no
    //   se miraba—. Las otras diez escanean todo y declaran sus excepciones con
    //   motivo, y su modo de fallar es RUIDOSO. Ahora esta también.
    // · Se dejaba pasar `Math.random` como VALOR (`rnd = Math.random` en una
    //   firma) por considerar que «eso ES inyectarlo». No lo era: ningún
    //   llamador inyectaba nunca, así que el defecto era el que corría siempre y
    //   sembrar el azar no llegaba a la ruleta, a Pregunta en vivo ni al tablero
    //   de las Pelotas. Un parámetro cuyo defecto esquiva el primitivo ES el
    //   primitivo sin usar. Se inyecta pasando `azar.random` o una fuente
    //   sembrada; `Math.random` no se nombra fuera de ALLOW.
    if (!allowed('azar-primitivo')) {
      if (/Math\.random\b/.test(ln)) {
        out.push({ path, line: i + 1, rule: 'azar-primitivo', text: ln.trim() });
      }
      if (BARAJADO_A_MANO.test(ln)) {
        out.push({ path, line: i + 1, rule: 'azar-primitivo',
                   text: `barajado a mano; el dueño es shuffle() de core/azar.js — ${ln.trim()}` });
      }
    }
    // §22-5 · un instante de la SALA medido con el reloj de ESTE aparato.
    // (el patrón lleva clase de caracteres a propósito: escrito entero, el
    //  escáner de imports de moduleRefs lo lee como un uso de `clock` aquí)
    if (/c[l]ock\.now\s*\(\s*\)/.test(ln) && !allowed('reloj-sala')
        && INSTANTES_SALA.some(n => ln.includes(n))) {
      out.push({ path, line: i + 1, rule: 'reloj-sala', text: ln.trim() });
    }
  });
  // imagen-buscable · TODA puerta de imagen ofrece BUSCARLA (F6, 2026-08-13).
  // Es de FICHERO, no de línea: lo que se comprueba es que quien pide una
  // imagen de contenido tenga las DOS puertas. Nació porque «Etiqueta el
  // diagrama» solo dejaba subir: el dueño quería un corazón humano y no tenía
  // ninguno en el móvil, con lo que la actividad no se podía ni empezar. Un
  // editor nuevo que copie el bloque de subir y olvide el de buscar rompe CI —
  // que es lo que impide que la puerta se vuelva a cerrar en un sitio solo.
  // (los nombres van con clase de caracteres a propósito: escritos enteros, el
  //  escáner de imports de moduleRefs los lee como usos REALES en este fichero)
  if (/\b(u[p]loadMedia|r[e]adBackgroundImage)\s*\(/.test(blank(String(source || '')))
      && !/a[b]rirBuscadorImagenes/.test(String(source || ''))
      && !allowed('imagen-buscable')) {
    out.push({ path, line: 1, rule: 'imagen-buscable',
               text: 'pide una imagen pero no ofrece buscarla (core/imageSearchModal.js)' });
  }

  // chrome-boton · UNA gramática de botón en el panel del profe. Las vistas de
  // CHROME_VIEWS visten con la familia propia (.btn-ghost / .btn-primary-solid,
  // styles/home.css), no con la de Bootstrap. Nació de una captura del dueño:
  // «Crear actividad» llevaba `btn btn-primary` y salía en azul de Bootstrap,
  // con esquina afilada y otra altura, dentro de una barra crema/naranja —
  // «está horrible». Arreglarlo a mano en una vista no impide que la siguiente
  // pantalla del panel vuelva a nacer con Bootstrap, que es exactamente cómo
  // llegó: es un RATCHET, no una migración. Las vistas que aún no están en la
  // lista (admin, tareas, editor, informes…) siguen siendo legales; migrarlas
  // pide antes decidir las variantes que la familia no tiene (peligro, aviso).
  // El JUEGO queda fuera a propósito: allí manda el skin con sus tokens --ww-*.
  if (CHROME_VIEWS.includes(path) && /class="[^"]*\bbtn\s+btn-/.test(String(source || ''))) {
    const src = String(source || '').split(/\r?\n/);
    src.forEach((ln, i) => {
      if (/class="[^"]*\bbtn\s+btn-/.test(ln)) {
        out.push({ path, line: i + 1, rule: 'chrome-boton',
                   text: `botón de Bootstrap en una vista de chrome: usa .btn-ghost / .btn-primary-solid — ${ln.trim().slice(0, 90)}` });
      }
    });
  }
  // comilla-en-comentario · UN ACENTO GRAVE DENTRO DE UN COMENTARIO HTML CIERRA
  // LA PLANTILLA DE TEXTO. Las vistas escriben su markup con plantillas de texto
  // (backticks), así que un comentario HTML con acentos graves
  // dentro TERMINA la plantilla ahí: el fichero deja de parsearse y la página
  // entera muere con «SyntaxError: missing ) after argument list». Sin pista de
  // dónde, porque el error apunta al final del fichero.
  //
  // Ha pasado TRES veces en este proyecto (dos en playerView, una en adminView),
  // siempre por documentar bien: el hábito de citar código con acentos graves es
  // correcto en Markdown y letal aquí. No lo caza `node --check` (el fichero
  // sigue siendo sintaxis válida hasta que se lee entero) y no lo caza ningún
  // test de unidad: solo el navegador, o esto.
  {
    const src = String(source || '');
    const re = /<!--[\s\S]*?-->/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      if (m[0].indexOf('`') === -1) continue;
      const linea = src.slice(0, m.index).split('\n').length;
      out.push({ path, line: linea, rule: 'comilla-en-comentario',
                 text: 'comentario HTML con acento grave: cierra la plantilla de texto y mata la página. '
                     + 'Escribe el nombre sin comillas.' });
    }
  }
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
  // El motor de sesión se partió POR MÁQUINA desde v1.51.630 (mismo patrón que
  // views/live/* y views/admin/* abajo: un fichero por máquina, ensamblados en
  // engine.js como fachada).
  'kernel/session/engine.js', 'kernel/session/formats.js', 'kernel/session/score.js',
  'kernel/session/liveMachine.js', 'kernel/session/teamsMachine.js', 'kernel/session/vsMachine.js',
  'kernel/session/memory.js', 'kernel/live/engine.js',
  'views/assignments.js', 'views/editList.js', 'views/editView.js',
  'views/embedModal.js', 'views/explore.js', 'views/home.js', 'views/hostLive.js',
  // Los bucles del live viven en su carpeta desde v1.51.628 (partición por bucle).
  'views/live/hostLobby.js', 'views/live/hostRondas.js', 'views/live/hostCarrera.js',
  'views/live/hostTablero.js', 'views/live/hostPalabra.js', 'views/live/hostInforme.js',
  'views/live/studentLobby.js', 'views/live/studentRondas.js', 'views/live/studentCarrera.js',
  'views/live/studentTablero.js', 'views/live/studentPalabra.js', 'views/live/studentFin.js',
  // El panel #/admin se partió POR PANEL desde v1.51.629 (mismo patrón que
  // views/live/* arriba: un módulo por sección <h5>, ensamblados en adminView.js).
  'views/admin/ai.js', 'views/admin/capacity.js', 'views/admin/collections.js',
  'views/admin/dataSystem.js', 'views/admin/errorLog.js', 'views/admin/liveTests.js',
  'views/admin/liveWords.js', 'views/admin/loadTests.js', 'views/admin/maintenance.js',
  'views/admin/matrix.js', 'views/admin/teachers.js', 'views/admin/templateCapacity.js',
  'views/admin/vsAnimations.js',
  'views/listView.js', 'views/memoryView.js', 'views/antesala.js', 'views/playerView.js',
  'views/reports.js', 'views/startScreen.js', 'views/studentLive.js',
  'views/studentTask.js', 'views/switchTemplate.js', 'views/teamsView.js',
  'views/templateSelector.js', 'views/vsView.js',
  'core/textCorrectionRound.js', 'core/textCorrectionDraw.js',
  'core/soloPlayer.js', 'core/connectRope.js', 'core/liveTransport.js',
];
