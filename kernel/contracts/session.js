// EL VOCABULARIO DE JUGAR — modos, bucles, fases, respuestas y filas de sala.
//
// Uniones DISCRIMINADAS y pequeñas: cada una tiene su dueño ejecutable en el
// código (core/modes.js, core/liveLoops.js, core/livePhases.js…), y aquí solo se
// escribe su forma para que TypeScript pueda contarlas. Si un valor nuevo entra
// en aquel módulo y no aquí, la unión se queda corta: mira siempre el módulo
// citado en cada typedef, que es la autoridad.
//
// Se consume igual que el resto:
//   /** @typedef {import('../kernel/contracts/session.js').LiveLoop} LiveLoop */

/**
 * @typedef {import('./activity.js').Activity} Activity
 * @typedef {import('./activity.js').ScoringRules} ScoringRules
 */

// ─── MODOS Y POLÍTICAS DECLARADAS ────────────────────────────────────────────

/**
 * Los cuatro FORMATOS de sesión del motor (`kernel/session/formats.js`,
 * `FORMATS`). Cada máquina sella `state.format` con uno.
 * @typedef {'solo'|'live'|'teams'|'vs'} SessionFormat
 */

/**
 * Los cinco MODOS de la interfaz (`core/modes.js`, `MODE_DEFS[].id`). No es lo
 * mismo que `SessionFormat`: 'task' es un montaje de plataforma (entrega de
 * tareas) que por dentro corre el player Individual.
 * @typedef {'solo'|'vs'|'teams'|'live'|'task'} ModeId
 */

/**
 * El modo tal y como lo declaran los PLAYERS al persistir
 * (`core/persistPolicy.js`, claves de `PERSIST`). Un valor desconocido no
 * guarda nada (fail-safe).
 * @typedef {'solo'|'async-tracked'|'live-student'|'vs'|'teams'} PersistMode
 */

/**
 * El modelo de PUNTOS que recibe un scorer como `mode` (`core/scoring/award.js`
 * `usaBonusVelocidad`, `core/liveLoops.js` `pointsModeFor`). 'race' = planos.
 * `pointsModeFor` solo devuelve los tres primeros; 'vs' y 'teams' los pasan las
 * máquinas de duelo y de equipos (`kernel/session/`) y son PLANOS por omisión:
 * `usaBonusVelocidad` solo enciende con 'live' o 'solo'.
 * 'report' es el de LEER lo ya jugado (`core/sessionModel.js` re-pregunta al
 * scorer por el mérito de una celda del informe): nunca da bonus.
 * @typedef {'solo'|'live'|'race'|'vs'|'teams'|'report'} PointsMode
 */

/**
 * Política de DUELO declarada en `meta.play.vs`. 'race' = gana quien acaba
 * antes y cierra; 'points' = espera a los dos y gana quien más suma.
 * @typedef {'race'|'points'|'none'} VsPolicy
 */

/**
 * Política de EQUIPOS declarada en `meta.play.teams`. 'propio' = la plantilla
 * trae su mecánica y su vista (Memoria), en vez de la ronda genérica.
 * @typedef {'turns'|'board'|'propio'|'none'} TeamsPolicy
 */

/**
 * Cómo se envía una respuesta en la ronda (`meta.play.submit`): el toque ES la
 * respuesta (cero botones) o se construye y se confirma (EXACTAMENTE uno,
 * marcado `data-ww-submit`).
 * @typedef {'gesto'|'boton'} SubmitKind
 */

/**
 * EL CATÁLOGO CONGELADO de bucles en vivo (ley §26, `core/liveLoops.js`
 * `LIVE_LOOPS`). Una fase nueva es una decisión escrita, no un `if` en una
 * vista. Lo DECLARA la plantilla en `meta.play.live`.
 * @typedef {'rounds'|'race'|'board'|'claim'} LiveLoop
 */

/**
 * Las fases de una sala (`core/livePhases.js` `PHASES`) más las dos que no
 * pasan por la máquina de rondas: 'race' (carrera y tablero la comparten) y
 * 'question-live' (pedir la palabra).
 * @typedef {'idle'|'lobby'|'question'|'reveal'|'leaderboard'|'ended'|'race'|'question-live'} LivePhase
 */

/**
 * El estado de la sala visto desde fuera (fila `live_sessions`).
 * @typedef {'lobby'|'running'|'ended'} RoomStatus
 */

/**
 * Acciones del docente que la máquina de fases sabe planificar
 * (`core/livePhases.js` `planTransition`).
 * @typedef {'start'|'reveal'|'leaderboard'|'next'|'end'} HostAction
 */

/**
 * Lo que decide `planTransition`: un parche de fila, una liquidación, el final,
 * o el rechazo con su motivo.
 * @typedef {{type:'patch', patch:RoomPatch}
 *   |{type:'settle', itemIndex:number}
 *   |{type:'end'}
 *   |{type:'invalid', reason:string}} TransitionPlan
 */

// ─── LA RONDA ────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} RoundContext
 * @property {number} itemIndex   Índice del ítem/ronda que se sirve.
 * @property {string} [side]      Lado del duelo ('left'/'right'): una plantilla
 *   de tablero puede repartir uno DISTINTO por lado (la Sopa). Lo pasa
 *   `kernel/session/vsMachine.js`.
 * @property {unknown[]} [found]  Lo ya respondido en turnos anteriores, para
 *   que un tablero libre lo traiga pre-marcado (VS y Equipos lo mandan igual).
 */

/**
 * EL PAYLOAD DE UNA RONDA: lo que la plantilla expone al que juega, ya SIN la
 * clave de respuesta (§22, answer-safety R5). Su forma exacta la decide cada
 * plantilla (Quiz manda `options`, Operaciones solo `question`, Crucigrama la
 * rejilla con `len` en vez de la palabra), así que el tipo declara lo COMÚN y
 * deja el resto abierto: nadie puede leerlo como si supiera lo que hay.
 * @typedef {{ id?: string, question?: string, image?: string|null,
 *   audio?: string|null, points?: number } & Record<string, unknown>} RoundPayload
 */

/**
 * LA ACTIVIDAD TAL Y COMO VIAJA A LA SALA (`core/liveSnapshot.js`): la misma
 * actividad, SANEADA (sin claves de respuesta, §22-2) y con los payloads de
 * cada ronda YA calculados por el host. Quien juega no recalcula sobre un
 * `content` que ya no tiene la clave: se sirve de `payloads`.
 * Una `Activity` normal es asignable a este tipo (el campo es opcional).
 * @typedef {Activity & { payloads?: Array<RoundPayload|null> }} SnapshotActivity
 */

/**
 * Lo que se le pasa al scorer de la plantilla. `value` es FRONTERA (llega de un
 * móvil, de una fila de PocketBase o de un gesto del jugador): se estrecha
 * dentro del scorer, que es el único que sabe qué forma tiene lo suyo.
 * @typedef {Object} ScoreInput
 * @property {unknown} value
 * @property {unknown} [item]          El ítem COMPLETO, con su clave. Solo lo tiene quien puntúa.
 * @property {number} [msTaken]        Milisegundos que tardó (bonus por velocidad).
 * @property {Activity} activity
 * @property {PointsMode} [mode]
 */

/**
 * LA FORMA DEL SCORER, y no otra. `hits`/`total` son el MÉRITO; `total: 0` = no
 * lo puntúa la máquina, lo pone el docente. `over`/`net`/`perfect` los añaden
 * los scorers POR MARCA (Tildes/Comas, `core/scoring/marks.js`) y son los que
 * hacen que «marcarlo todo» no gane.
 * @typedef {Object} ScoreResult
 * @property {boolean|null} correct   `null` = NO puntuable (sin clave), nunca «incorrecto».
 * @property {number} points
 * @property {number} hits
 * @property {number} total
 * @property {number} [over]          Marcas de MÁS.
 * @property {number} [net]           `max(0, hits - over)`.
 * @property {boolean} [perfect]      Todas y ninguna de más. Es la vara de la CARRERA (`racePassed`).
 */

// ─── JUGADORES Y RESPUESTAS ──────────────────────────────────────────────────

/**
 * Un jugador de la sala. `userId` es el dispositivo (reconexión); `id` es la
 * fila de `live_players` (o `p1`, `p2`… en el blob heredado).
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} [userId]
 * @property {string} name
 * @property {number} [score]
 */

/**
 * Una fila del marcador (`core/liveRank.js` `rankPlayers`). La HORA DE META
 * ordena pero NO sale: el marcador es un contrato que ya leen tres vistas.
 * @typedef {Object} RankedPlayer
 * @property {number} rank
 * @property {string} id
 * @property {string} name
 * @property {number} score
 */

/**
 * MI PUESTO Y A CUÁNTO ESTOY (`core/liveRank.js` `standingOf`). El puesto es
 * COMPARTIDO, como en deporte: 1 + cuántos tienen MÁS puntos.
 * @typedef {Object} Standing
 * @property {number} rank
 * @property {number} total
 * @property {number} score
 * @property {number} gap
 * @property {string|null} aboveName
 * @property {number} tied
 * @property {string|null} tiedName
 */

/**
 * Lo que un alumno AFIRMA al responder (§22: es una afirmación, no un
 * veredicto). Es lo que viaja en `submitAnswer`/`submitRaceAttempt`.
 * @typedef {Object} Submission
 * @property {string} playerId
 * @property {number} itemIndex
 * @property {unknown} value
 * @property {number} [msTaken]   Lo que dice el móvil. En carrera lo PISA el servidor al liquidar.
 */

/**
 * LA FILA DE `live_answers` — una por (sala, jugador, ítem), con índice único.
 * El alumno escribe `value`/`ms`; el VEREDICTO (`scored`, `correct`,
 * `unscorable`, `points`) lo pone el host al liquidar.
 * @typedef {Object} LiveAnswer
 * @property {string} [id]
 * @property {string} session
 * @property {string} player
 * @property {number} item
 * @property {unknown} value
 * @property {number} ms            Tras el settle es el tiempo del SERVIDOR, no el del móvil (§22-1).
 * @property {boolean} scored       false = respondió, sin puntuar (PocketBase no admite null en bool).
 * @property {boolean} correct
 * @property {boolean} [unscorable] Liquidada SIN clave de respuesta: el mérito es del docente.
 * @property {number} points
 * @property {unknown} [v0]         PRIMER intento de la carrera (analítica); inmutable.
 * @property {boolean} [c0]
 * @property {string} [created]     Autodate de PocketBase.
 * @property {string} [updated]
 */

/**
 * La respuesta tal y como vive DENTRO del motor (`state.answers['idx:playerId']`),
 * que no es la fila: aquí `correct: null` significa «sin liquidar».
 * @typedef {Object} EngineAnswer
 * @property {string} playerId
 * @property {unknown} value
 * @property {number} msTaken
 * @property {number} [msClaimed]   Lo que afirmó el móvil, conservado para diagnóstico.
 * @property {string} [msSource]    De dónde salió el `msTaken` (`core/serverMs.js`).
 * @property {boolean|null} correct
 * @property {number} points
 * @property {boolean} [hint]       Avance afirmado por el cliente en carrera; NO otorga puntos.
 * @property {unknown} [v0]         PRIMER intento de la carrera (analítica); inmutable.
 * @property {boolean} [c0]         Veredicto de ese primer intento.
 * @property {string} [created]     Espejo del autodate de PocketBase: el driver local
 *   los sella a mano, o no habría hora de meta que derivar (§22-1).
 * @property {string} [updated]
 */

// ─── LA SALA ─────────────────────────────────────────────────────────────────

/**
 * EL BLOB `state` de la fila de sala: el estado del motor, persistido. Es
 * HOST-ONLY (§22) salvo la rama heredada sin `live_players`.
 * @typedef {Object} RoomState
 * @property {SessionFormat} [format]
 * @property {string} [code]
 * @property {RoomStatus} [status]
 * @property {LivePhase} [phase]
 * @property {number} [currentItem]
 * @property {Player[]} [players]
 * @property {Record<string, EngineAnswer>} [answers]   Clave `${itemIndex}:${playerId}`.
 * @property {LiveLoop|null} [loop]          EL BUCLE que corrió la sala (§26). Sin migración: se guarda al arrancar.
 * @property {string|null} [deadline]        Instante de cierre de la pregunta (ISO).
 * @property {string|null} [answersOpenAt]   Instante en que se pueden TOCAR las respuestas (R-1).
 * @property {number|null} [readSecs]        Ventana de lectura.
 * @property {string|null} [startedAt]
 * @property {'all'|'firstN'|'time'|null} [endPolicy]
 * @property {number|null} [endN]
 * @property {Record<string, string>} [itemOpenedAt]  Sello SERVIDOR de apertura por ítem (§22-1).
 * @property {Record<string, number>} [qlPoints]      Puntos que da el docente en «pedir la palabra».
 * @property {Record<string, string>} [qlTaken]       Quién se llevó cada caja (CL-1).
 * @property {number|null} [qlOpen]        LEGADO: «pedir la palabra» vivía en el blob;
 *   hoy es el campo `ql` de la fila (§22). Los dos adaptadores lo leen como respaldo
 *   para las salas creadas antes del cambio.
 * @property {string|null} [qlQuestion]
 * @property {string|null} [qlImage]
 * @property {string|null} [qlBy]
 * @property {string|null} [qlByName]
 * @property {number} [_seq]
 */

/**
 * EL PARCHE que el host manda a la sala (`setSessionState`). Va en snake_case
 * porque es el vocabulario de la FILA, no el del blob: los adaptadores
 * traducen (`current_item` → `state.currentItem`).
 * @typedef {Object} RoomPatch
 * @property {RoomStatus} [status]
 * @property {LivePhase} [phase]
 * @property {number} [current_item]
 * @property {string|null} [deadline]
 * @property {string|null} [answers_open_at]
 * @property {number|null} [read_secs]
 * @property {LiveLoop|null} [loop]
 * @property {'all'|'firstN'|'time'} [end_policy]
 * @property {number|null} [end_n]
 * @property {string|null} [started_at]
 * @property {Record<string, number>} [ql_points]
 * @property {Record<string, string>} [ql_taken]
 * @property {number|null} [ql_open]   Índice de la caja/casilla abierta (la pide un alumno).
 * @property {string|null} [ql_question]
 * @property {string|null} [ql_image]
 * @property {string|null} [ql_by]
 * @property {string|null} [ql_by_name]
 * @property {{playerId:string, points:number, item?:number}} [ql_award]
 */

/**
 * LA SALA COMO LA DEVUELVEN LOS ADAPTADORES (`fetchSession`/`findRoomByCode`):
 * los campos del blob aplanados a snake_case, más el snapshot de la actividad.
 * `activity_snap` es el snapshot SANEADO (sin claves) salvo durante la carrera,
 * que es la excepción declarada de §22-2.
 * @typedef {Object} LiveRoom
 * @property {string} id
 * @property {string} code
 * @property {RoomStatus} [status]
 * @property {LivePhase} [phase]
 * @property {number} [current_item]
 * @property {string|null} deadline
 * @property {string|null} answers_open_at
 * @property {number|null} read_secs
 * @property {LiveLoop|null} loop
 * @property {'all'|'firstN'|'time'|null} end_policy
 * @property {number|null} end_n
 * @property {string|null} [started_at]
 * @property {Activity|null} [activity_snap]
 * @property {number|null} ql_open    Índice de la caja abierta; null = ninguna.
 * @property {string|null} ql_question
 * @property {string|null} ql_image
 * @property {string|null} ql_by
 * @property {string|null} ql_by_name
 * @property {Record<string, number>} ql_points
 * @property {Record<string, string>} ql_taken
 */

/**
 * LA FILA CRUDA de `live_sessions` (informes: `listSessions`,
 * `fetchSessionRecord`). El parseo es de quien la pide.
 * @typedef {Object} RoomRecord
 * @property {string} id
 * @property {string} code
 * @property {Activity|null} [activity]
 * @property {RoomState} [state]
 * @property {Object} [ql]
 * @property {string} [created]
 * @property {string} [updated]
 */

/**
 * EL MOTOR DE UNA SALA EN VIVO — lo que `createLiveRoom` (`kernel/live/engine.js`)
 * entrega a quien conduce la partida: `state`, `join`, `submit`, `settle`,
 * `settleAll`, `leaderboard`… Su forma la POSEE quien lo construye
 * (`kernel/session/liveMachine.js`), igual que `RoomChange` la posee
 * `core/liveTransport.js`; aquí solo se le pone la puerta, porque los DOS
 * adaptadores en vivo (local y PocketBase) lo cargan, lo mutan y lo persisten.
 * @typedef {ReturnType<typeof import('../session/liveMachine.js').createLiveSession>} LiveEngine
 */

/**
 * Lo que entrega `subscribeRoom` a su callback. LA DEFINICIÓN VIVE EN
 * `core/liveTransport.js`, junto a las llamadas que la producen, y
 * `tests/realtimePort.test.mjs` EXIGE que siga ahí (comprueba el `@typedef` en
 * ese fichero: un contrato que nadie lee es el que se queda desfasado). Aquí
 * solo se re-exporta para que quien viva en `kernel/contracts` no tenga que
 * saberse la ruta.
 * @typedef {import('../../core/liveTransport.js').RoomChange} RoomChange
 */

/**
 * EL BUS DE EVENTOS DE JUEGO, re-exportado por la misma razón que `RoomChange`:
 * su catálogo tiene dueño (`kernel/contracts/events.js`, espejo de
 * `core/gameEvents.js`) y aquí se le pone la puerta, porque «jugar» es donde se
 * va a buscar quién avisa de una racha o de un podio.
 * @typedef {import('./events.js').GameEventMap} GameEventMap
 * @typedef {import('./events.js').GameEventName} GameEventName
 */

// ─── LO QUE SE GUARDA AL TERMINAR ────────────────────────────────────────────

/**
 * EL RESULTADO QUE AFIRMA EL CLIENTE (`core/results.js` `saveResult`), en
 * camelCase. Solo lo escribe el modo Individual (`core/persistPolicy.js`).
 * @typedef {Object} ResultRecord
 * @property {string} activityId
 * @property {string} [sessionId]
 * @property {string} [userId]
 * @property {string} [playerName]
 * @property {number} [scoreAuto]
 * @property {number} [scoreFinal]
 * @property {number} [maxScore]     El techo lo DERIVA el shell del scorer, no una fórmula paralela.
 * @property {number} [timeUsed]     Segundos.
 * @property {unknown[]} [overrides]
 * @property {string} [_qid]         Clave de idempotencia de la cola offline (deuda D).
 */

/**
 * LA FILA de la colección `results` de PocketBase, en snake_case. OJO: NO es lo
 * mismo que `ResultRecord` — el adaptador local guarda y devuelve el objeto
 * camelCase tal cual, y el de PocketBase devuelve ESTA fila (ver el informe de
 * la Fase A: es una divergencia real de `listResults`, no un descuido de tipos).
 * @typedef {Object} ResultRow
 * @property {string} [id]
 * @property {string} activity_id
 * @property {string|null} [session_id]
 * @property {string|null} [user_id]
 * @property {string|null} [player_name]
 * @property {number|null} [score_auto]
 * @property {number|null} [score_final]
 * @property {number|null} [max_score]
 * @property {number|null} [time_used]
 * @property {unknown[]} [overrides]
 * @property {string} [qid]
 * @property {string} [created]
 */

/**
 * LA FILA de `assignments` (una TAREA). Snake_case en los dos adaptadores.
 * `activity_snap` es la actividad CONGELADA al mandarla: editarla después no
 * cambia lo que el alumno tiene delante (§24).
 * @typedef {Object} AssignmentRecord
 * @property {string} id
 * @property {string} code            PIN público, mayúsculas (`normalizeCode`).
 * @property {string} activity_id
 * @property {Activity} activity_snap
 * @property {string} author_id       La CUENTA del profe (o su id anónimo, en tareas legadas).
 * @property {string} title
 * @property {string|null} due_at      ISO.
 * @property {number} max_attempts     Defecto 1.
 * @property {'open'|'closed'} status
 * @property {string} created_at
 */

/**
 * LA FILA de `assignment_attempts` (una ENTREGA). `attempt_no` lo acota el
 * SERVIDOR contra `max_attempts` (§22-3): el tope no vive solo en el cliente.
 * @typedef {Object} AssignmentAttempt
 * @property {string} [id]
 * @property {number} [attempt_no]
 * @property {string} [qid]           Idempotencia del reintento (deuda D).
 * @property {string} assignment_id
 * @property {string} activity_id
 * @property {string} user_id
 * @property {string} player_name
 * @property {number} score_auto
 * @property {number} score_final
 * @property {number} max_score
 * @property {number} time_used
 * @property {unknown[]} [answers]    Detalle por ítem, para la analítica.
 * @property {string} created_at
 */

/**
 * El veredicto de `assignmentGate` (`core/assignmentRules.js`): en ese orden —
 * no existe, cerrada, vencida, sin intentos.
 * @typedef {Object} AssignmentGate
 * @property {boolean} allowed
 * @property {'notFound'|'closed'|'pastDue'|'noAttemptsLeft'|null} reason
 */

export {};
