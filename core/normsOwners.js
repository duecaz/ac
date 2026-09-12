// LOS DUEÑOS, COMO DATO — la TABLA que las normas hacen cumplir, sin el escáner.
//
// Aquí viven las listas que se consultan al leer o al escribir una regla: qué
// fichero es dueño de cada colección de PocketBase y de cada clave `ww.*` del
// almacén (§21), quién está excepcionado de cada norma y por qué, qué vistas del
// panel ya visten con la familia propia, y cuáles son los INSTANTES DE LA SALA.
// Estaban mezcladas con las ~370 líneas del escáner (core/normsCheck.js), así
// que añadir un dueño obligaba a leerse el escáner entero para encontrar dónde
// se escribe; y al revés, leer una regla obligaba a saltarse la tabla.
//
// Es DATO: no importa nada y nadie lo ejecuta. Lo leen el escáner
// (core/normsCheck.js) y `tools/module-map.mjs`, que dibuja el mapa de datos de
// esta misma fuente — el mapa no puede mentir sobre quién manda.
//
// OJO: este fichero NOMBRA todas las claves `ww.*` por definición, así que el
// escáner lo excluye de la regla `ls-dueno` (antes se excluía a sí mismo, que
// era donde vivía la tabla).

/** Excepciones DECLARADAS por regla: ficheros donde el patrón es legítimo.
 *  @type {Record<string, string[]>} */
export const ALLOW = {
  'resize-observer': ['core/observeResize.js'],
  'pb-filter': [],   // ya no hay ficheros excepcionados: pbFilterParam ya no matchea el patrón
  'kernel-puro': [],
  // Los primitivos de reloj y el ctx del lifecycle SON la implementación.
  'reloj-primitivo': ['core/lifecycle.js', 'core/soloTimer.js',
    // El vigía de un flujo permanente (SSE) es el CUARTO primitivo de reloj: no
    // pinta, vigila silencio y renueva la conexión. Su scheduler se inyecta.
    'core/streamWatchdog.js'],
  'id-rid': ['core/ids.js'],   // la única implementación permitida
  // azar-primitivo · quién PUEDE nombrar `Math.random`, y por qué. Los dos
  // primeros SON la implementación; el resto no es contenido que nadie juegue, y
  // los PIN además tienen que ser IMPREDECIBLES: reproducirlos sería el fallo.
  // icono-primitivo · solo el dueño del primitivo puede escribir un icono a mano.
  // Vacía a propósito: si algún día hace falta un glifo que Lucide no tenga, se
  // añade AQUÍ con su motivo, no se pega en una plantilla.
  'icono-primitivo': ['core/lucide.js'],
  'azar-primitivo': [
    'core/azar.js', 'core/ids.js',
    'core/effects.js',          // confeti
    'core/soloAnimations.js',   // partículas
    'core/migrate.js',          // PIN de sala
    'core/liveWords.js',        // palabra-código de la sala (misma familia que el PIN)
    'core/streamWatchdog.js',   // jitter de reconexión (y su scheduler ya se inyecta)
    'core/assignmentRules.js',  // PIN de tarea (dueño único; lo llaman los dos drivers)
    'adapters/pocketbase/assignments.js', 'adapters/local/assignments.js',  // PIN de tarea (legado: ya lo piden al dueño)
    'adapters/pocketbase/realtimeStream.js',  // jitter del backoff SSE
  ],
  'reloj-sala': [],
  // imagen-buscable · quién puede pedir una imagen SIN ofrecer buscarla, y por qué.
  // Los dos primeros SON la implementación; los tres siguientes no piden imagen
  // de CONTENIDO: la foto de perfil y el avatar del duelo son de una PERSONA
  // (buscarle la cara en internet es justo lo que R7 no quiere) y el fondo del
  // player es un capricho de ESTA partida, que no se guarda en la actividad.
  'imagen-buscable': [
    'core/upload.js', 'core/backgrounds.js',
    'views/author.js', 'views/vsView.js', 'views/player/apariencia.js',
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
  'adapters/local/kv.js': 'KV inyectable para tests sin DOM (dev offline) — dueño único de los tres drivers',
  'adapters/local/assignments.js': 'KV inyectable para tests sin DOM (dev offline)',
  'adapters/local/realtime.js': 'KV inyectable para tests sin DOM (dev offline)',
  'adapters/local/remoteStore.js': 'KV inyectable para tests sin DOM (dev offline)',
  // Arnés de pruebas manual (hoja imprimible de QA), no producto: nunca corre
  // con la clase delante y no pasa por §21.
  'qa/hoja.js': 'arnés de pruebas, no producto',
};

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
export const INSTANTES_SALA = [
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
// Fase 6: el ESQUEMA salió de la vista a `core/pbSchema.js` (los DEFS como dato)
// y aplicarlo, a `core/pbProvision.js` (la API de ADMINISTRACIÓN, que no es ser
// dueño de los DATOS de una colección). La vista se quedó con la pantalla y por
// eso ya no nombra ninguna: se le quita el permiso, no se duplica.
export const PB_SCHEMA_OWNERS = ['core/pbSchema.js', 'core/pbProvision.js', 'views/admin/ai.js', 'core/pbRules.js'];

/** Dueño de cada colección (§21). Exportado para que `tools/module-map.mjs`
 *  dibuje el mapa de datos de la misma fuente que lo vigila. */
/** @type {Record<string, string[]>} */
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
/** @type {Record<string, string[]>} */
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
export const LS_PREFIXES = Object.keys(LS_OWNERS).sort((a, b) => b.length - a.length);

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
  'views/admin/ai.js', 'views/admin/collections.js',
  'views/admin/dataSystem.js', 'views/admin/liveWords.js', 'views/admin/maintenance.js',
  'views/admin/teachers.js', 'views/admin/vsAnimations.js',
  // Y el DIAGNÓSTICO PURO (lo que solo mira: pruebas, matrices, capacidad,
  // errores, fluidez) vive aparte desde v1.51.9xx (T8): esas secciones no
  // gestionan nada del profe, y agruparlas deja ver de un vistazo qué del panel
  // es administración y qué es lupa.
  'views/admin/diagnostico/capacity.js', 'views/admin/diagnostico/errorLog.js',
  'views/admin/diagnostico/fluidez.js', 'views/admin/diagnostico/liveTests.js',
  'views/admin/diagnostico/loadTests.js', 'views/admin/diagnostico/matrix.js',
  'views/admin/diagnostico/templateCapacity.js',
  'views/listView.js', 'views/memoryView.js', 'views/antesala.js', 'views/playerView.js',
  // La página de jugar reparte sus piezas en views/player/ y el duelo su
  // encuentro en views/vs/ desde la Fase 6 (mismo patrón que live/ y admin/).
  'views/player/apariencia.js', 'views/player/cabecera.js', 'views/player/otraPlantilla.js',
  'views/vs/arena.js',
  'views/reports.js', 'views/studentLive.js',
  'views/studentTask.js', 'views/teamsView.js',
  'views/templateSelector.js', 'views/vsView.js',
  'core/switchTemplate.js', 'core/textCorrectionRound.js', 'core/textCorrectionDraw.js',
  // La mecánica de corregir texto y el chasis del editor también repartieron sus
  // piezas en la Fase 6. La fachada sigue arriba, pero el humo del navegador
  // tiene que alcanzar el módulo donde vive HOY cada cosa: si solo se escanea la
  // fachada, un fallo de carga en la ronda o en la puerta de la IA no aparece.
  'core/textCorrectionPasaje.js', 'core/textCorrectionRonda.js',
  'core/textCorrectionRevision.js', 'core/textCorrectionSolo.js',
  'core/editorPresentacion.js', 'core/editorIA.js',
  'core/soloPlayer.js', 'core/connectRope.js', 'core/liveTransport.js',
];
