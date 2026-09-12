// LOS PUERTOS DE DATOS — la superficie que el dominio le pide a un backend,
// independiente de cuál esté activo. Los adaptadores válidos son DOS: `local`
// (dev offline) y `pocketbase` (producción).
//
// QUIÉN MANDA: los tests de PARIDAD, no este fichero.
//   · `tests/storePort.test.mjs`     — superficie y aridad de RemoteStore y AssignmentsPort.
//   · `tests/realtimePort.test.mjs`  — los métodos de RealtimePort, DERIVADOS de
//     las llamadas de `core/liveTransport.js` (la lista se calcula, no se escribe:
//     un contrato escrito a mano ya mintió una vez y declaraba un `joinRoom`
//     inexistente).
// Si este JSDoc y esos tests discrepan, mandan los tests — y hay que corregir
// esto. Lo que aquí se añade y allí no se puede comprobar son los TIPOS de ida
// y vuelta, que es justo lo que ningún test de aridad ve.
//
// Se consume igual que el resto:
//   /** @typedef {import('../kernel/contracts/dataPort.js').RemoteStore} RemoteStore */

/**
 * @typedef {import('./activity.js').Activity} Activity
 * @typedef {import('./activity.js').ActivityRow} ActivityRow
 * @typedef {import('./persistencia.js').AssignmentAttempt} AssignmentAttempt
 * @typedef {import('./persistencia.js').AssignmentRecord} AssignmentRecord
 * @typedef {import('./session.js').EngineAnswer} EngineAnswer
 * @typedef {import('./session.js').LiveRoom} LiveRoom
 * @typedef {import('./session.js').Player} Player
 * @typedef {import('./session.js').RankedPlayer} RankedPlayer
 * @typedef {import('./persistencia.js').ResultRecord} ResultRecord
 * @typedef {import('./persistencia.js').ResultRow} ResultRow
 * @typedef {import('./session.js').RoomChange} RoomChange
 * @typedef {import('./session.js').RoomPatch} RoomPatch
 * @typedef {import('./session.js').RoomRecord} RoomRecord
 * @typedef {import('./session.js').RoomState} RoomState
 */

// ─── EL ALMACÉN DE ACTIVIDADES ───────────────────────────────────────────────

/**
 * EL BACKEND de actividades y resultados: la mitad remota del almacén.
 * `core/storage.js` guarda en localStorage primero (offline-first) y delega
 * aquí lo remoto.
 *
 * Los DOS últimos métodos son la ÚNICA asimetría declarada (`SOLO_PB` en
 * `tests/storePort.test.mjs`): solo tienen sentido contra un servidor real, y
 * el consumidor los llama con guard (`typeof rs.x === 'function'`).
 *
 * @typedef {Object} RemoteStore
 * @property {(activity: Activity) => Promise<void>} saveActivity
 *   Crea o actualiza. El flag local `_unsynced` se quita antes de subir.
 * @property {(id: string) => Promise<void>} deleteActivity
 *   Un 404 remoto NO es error: la fila ya no existe.
 * @property {(id: string) => Promise<Activity|null>} getActivity
 * @property {(ownerId?: string|null) => Promise<ActivityRow[]>} listActivities
 *   Sin dueño, TODAS (uso legado). OJO: el adaptador local IGNORA `ownerId`.
 * @property {(opts?: {language?: string, owner?: string, limit?: number}) => Promise<ActivityRow[]>} listPublicActivities
 *   La biblioteca pública, ya normalizada y ordenada por `updatedAt` del contenido.
 * @property {(result: ResultRecord) => Promise<void>} saveResult
 *   Idempotente por `_qid`: un reintento tras un ACK perdido no duplica la fila.
 * @property {(activityId?: string) => Promise<ResultRow[]|ResultRecord[]>} listResults
 *   FILTRA por actividad en los dos. La FORMA de la fila no es la misma en los
 *   dos backends (ver el informe de la Fase A).
 * @property {() => Promise<Map<string, number>>} [countActivitiesByOwner]
 *   SOLO PocketBase. Cuántas actividades tiene cada dueño; no salen ni títulos ni contenido.
 * @property {(fields?: string) => Promise<{items: unknown[], bytes: number}>} [probeActivitiesPayload]
 *   SOLO PocketBase. Diagnóstico de `#/admin`: la lista con el TAMAÑO medido.
 */

/**
 * Lo que devuelve `save()` de `core/storage.js`: guardado LOCAL ya hecho,
 * remoto en vuelo. `persisted:false` = la cuota del navegador rechazó la
 * escritura, y el llamador NO debe fingir éxito (R6).
 * @typedef {Object} SaveResult
 * @property {Activity} activity       La actividad normalizada y ya guardada en local.
 * @property {Promise<void>} remote    Resuelve cuando el backend confirma; rechaza si falla.
 * @property {boolean} persisted
 */

/**
 * LA FACHADA que consumen las vistas (`core/storage.js`): lecturas SÍNCRONAS
 * desde el cache local, escrituras que salen a la nube por detrás.
 * @typedef {Object} DataPort
 * @property {() => Activity[]} list                          Las del usuario actual, ya migradas y ordenadas.
 * @property {(id: string) => Activity|null} get              Del cache local.
 * @property {(id: string) => Promise<Activity|null>} getRemote
 * @property {(id: string, opts?: {cache?: boolean}) => Promise<Activity|null>} getAnywhere
 *   Local y, si no está, de la nube. `cache:true` la guarda en el almacén del usuario.
 * @property {(activity: Activity, opts?: {keepUpdatedAt?: boolean}) => SaveResult} save
 * @property {(id: string) => Promise<{ok: boolean, error?: string}>} remove
 *   NUNCA rechaza, pero DICE LA VERDAD sobre el servidor (R6).
 * @property {() => Promise<Activity[]>} sync                  Trae del backend y mezcla (last-write-wins + tombstones).
 * @property {() => Promise<{tried: number, ok: number}>} [retryUnsynced]
 * @property {(userId: string) => void} [setUser]              Cambia el ámbito por usuario del almacén.
 */

// ─── LAS TAREAS ──────────────────────────────────────────────────────────────

/**
 * EL BACKEND de tareas (`assignments.js` de cada adaptador). Superficie y aridad
 * IDÉNTICAS en los dos adaptadores (sin asimetría declarada).
 *
 * @typedef {Object} AssignmentsPort
 * @property {(activity: Activity, opts?: {title?: string, dueAt?: string|null, maxAttempts?: number}) => Promise<{id: string, code: string}>} createAssignment
 *   Congela la actividad en `activity_snap` y acuña el PIN.
 * @property {(activityId: string) => Promise<AssignmentRecord[]>} listAssignmentsForActivity
 *   MIS tareas de esa actividad: el predicado de quién soy yo es `esMiTarea`.
 * @property {(code: string) => Promise<AssignmentRecord|null>} findAssignmentByCode
 * @property {(id: string) => Promise<void>} closeAssignment
 * @property {(id: string) => Promise<string>} rotateAssignmentCode   Devuelve el PIN nuevo.
 * @property {(assignmentId: string) => Promise<AssignmentAttempt[]>} listAttempts
 * @property {(assignmentId: string) => Promise<number>} countOwnAttempts
 * @property {(assignmentId: string, activityId: string, playerName: string,
 *   scoreAuto: number, maxScore: number, timeUsed: number,
 *   answers?: unknown[], qid?: string) => Promise<void>} recordAttempt
 *   El intento declara su NÚMERO y el SERVIDOR lo acota contra `max_attempts` (§22-3).
 */

// ─── EL TIEMPO REAL ──────────────────────────────────────────────────────────

/**
 * Una respuesta como la sirve `listAnswers` a las vistas.
 * @typedef {Object} AnswerView
 * @property {string} playerId
 * @property {unknown} value
 * @property {number} [msTaken]
 * @property {boolean|null} correct   `null` = aún sin liquidar.
 * @property {number} [points]
 * @property {unknown} [v0]           Primer intento de la carrera (analítica).
 * @property {boolean} [c0]
 * @property {string} [created]       Autodate del SERVIDOR: sin él no se puede derivar el tiempo (§22-1).
 * @property {string} [updated]
 * @property {boolean} [scored]
 */

/**
 * Una fila propia del alumno (`listOwnAnswers`), con la que se REANUDA una
 * carrera tras recargar. `correct: true` = este dispositivo ya lo acertó.
 * @typedef {Object} OwnAnswerRow
 * @property {number} itemIndex
 * @property {unknown} value
 * @property {boolean|null} correct
 * @property {number} [points]
 * @property {number} [ms]
 */

/**
 * El informe de la purga por retención (§25).
 * @typedef {Object} PurgeReport
 * @property {string} cutoff
 * @property {boolean} dryRun
 * @property {number} sessions
 * @property {number} answers
 * @property {number} players
 * @property {number} claims
 * @property {string[]} errors
 */

/**
 * EL TRANSPORTE EN VIVO. Lo implementan `adapters/pocketbase/realtime.js` y
 * `adapters/local/realtime.js`; la fachada `core/liveTransport.js` resuelve el
 * driver y reenvía — y como su `call()` es `async`, TODO lo que las vistas ven
 * llega envuelto en una promesa, incluido el desuscriptor de `subscribeRoom`.
 *
 * El primer argumento es el id de sala en PocketBase y el CÓDIGO (PIN) en
 * local: las vistas lo tratan como un identificador opaco, y por eso funciona.
 *
 * @typedef {Object} RealtimePort
 * @property {'local'|'pocketbase'} kind
 * @property {(activity: Activity) => Promise<{id: string, code: string}>} createRoom
 *   En PocketBase guarda el snapshot SANEADO en la sala y la actividad completa en `live_keys` (§22-2).
 * @property {(code: string) => Promise<LiveRoom|null>} findRoomByCode
 * @property {(sessionId: string) => Promise<LiveRoom>} fetchSession       Lanza si la sala no existe.
 * @property {(sessionId: string) => Promise<Activity|null>} fetchSessionKey
 *   La actividad COMPLETA, solo para el host. El driver local devuelve siempre null.
 * @property {(sessionId: string) => Promise<RoomState>} fetchSessionBlob
 * @property {(opts?: {limit?: number}) => Promise<RoomRecord[]>} listSessions
 * @property {(sessionId: string) => Promise<RoomRecord|null>} fetchSessionRecord
 * @property {(sessionId: string) => Promise<void>} startSession
 * @property {(sessionId: string, patch: RoomPatch) => Promise<void>} setSessionState
 * @property {(sessionId: string) => Promise<void>} endSession
 *   Liquida lo pendiente ANTES de marcar 'ended': una rezagada que llegó a tiempo cuenta.
 * @property {(sessionId: string, itemIndex: number) => Promise<{ok: boolean, settled: number}>} settleItem
 * @property {(sessionId: string) => Promise<Player[]>} listPlayers
 * @property {(sessionId: string, itemIndex: number) => Promise<AnswerView[]|EngineAnswer[]>} listAnswers
 *   El driver local devuelve la respuesta del MOTOR, no la vista de fila (ver el informe de la Fase A).
 * @property {(sessionId: string, playerId: string, itemIndex: number, value: unknown,
 *   correct: boolean, points: number, msTaken?: number) => Promise<void>} submitRaceAttempt
 *   El veredicto del cliente es solo un HINT de avance: la fila se guarda sin puntuar (C6).
 * @property {(sessionId: string, limit?: number) => Promise<RankedPlayer[]>} leaderboard
 * @property {(sessionId: string, playerId: string) => Promise<void>} kickPlayer
 * @property {(cutoffIso: string, opts?: {dryRun?: boolean}) => Promise<PurgeReport>} purgeOldLive
 * @property {(sessionId?: string) => Promise<void>} pingHost
 * @property {(code: string, nickname: string) => Promise<{sessionId: string, playerId: string, name: string}>} joinSession
 *   El apodo se normaliza y se hace único (sufijo « 2»), nunca se rechaza por repetido.
 * @property {(sessionId: string, playerId: string, itemIndex: number, value: unknown, msTaken?: number) => Promise<void>} submitAnswer
 *   Candado de PRIMERA respuesta: una segunda no pisa la registrada.
 * @property {(sessionId: string, playerId: string, itemIndex: number) => Promise<AnswerView|EngineAnswer|null>} getOwnAnswer
 * @property {(sessionId: string, playerId: string) => Promise<OwnAnswerRow[]>} listOwnAnswers
 * @property {(playerId?: string) => Promise<void>} pingPresence
 * @property {(sessionId: string, playerId: string, value: unknown, msTaken?: number, itemIndex?: number) => Promise<void>} submitProgress
 *   UPSERT de la fila PROPIA (tablero): el host ve el avance movimiento a movimiento.
 * @property {(sessionId: string, claim: {open?: number|null, question?: string|null,
 *   image?: string|null, by?: string|null, byName?: string|null}) => Promise<void>} claimQuestion
 *   La ÚNICA afirmación de un alumno sobre la sala: escribe el campo `ql`, jamás el blob (§22).
 * @property {(sessionId: string, onChange: (change: RoomChange) => void) => (() => void)} subscribeRoom
 *   Devuelve el desuscriptor (la fachada lo entrega envuelto en una promesa).
 */

export {};
