// PocketBase RealtimePort driver.
// All live-session state lives in a single `live_sessions` PocketBase record
// (same approach as the local driver but persisted remotely). Scoring runs
// client-side in the host browser via the same kernel engine.
//
// Required PocketBase collection `live_sessions` fields:
//   code     text   (required, unique index)
//   activity json
//   state    json
// API rules: allow all (or at minimum Create/Read/Update without auth).
//
// ── ENSAMBLADOR (partido por colección, deuda condicionada del CLAUDE.md) ──
// Este fichero ya NO contiene toda la lógica: crea el estado COMPARTIDO
// (`pbFetch`, las cuatro colecciones, los dos probes de "¿existe esta
// colección?") y las CUATRO secciones —una por colección PocketBase de la
// sala en vivo—, cada una en su propio módulo con una única fábrica:
//   · realtimeClaims.js         → `live_claims`   (§22-4, credencial del móvil)
//   · realtimeAnswers.js        → `live_answers`  (respuestas, settle, podio)
//   · realtimeRooms.js          → `live_sessions` + `live_players` (la sala y su roster)
//   · realtimeMantenimiento.js  → kickPlayer, purgeOldLive (§25), pings no-op
//   · realtimeStream.js         → la máquina SSE (`subscribeRoom`): conexión,
//     backoff y renovación preventiva. No pertenece a una colección —reenvía
//     cambios de sesión Y de jugadores— pero tampoco es ensamblaje.
//
// DEPENDENCIA CIRCULAR DECLARADA: `rooms.setSessionState` (ql_award) y
// `rooms.endSession` necesitan `postAnswer`/`getAnswerRow`/`settlePendingInto`
// de la sección answers; `answers.*` necesita `load`/`saveState`/`fetchPlayers`
// de la sección rooms. Como rooms se construye primero, se le pasan tres
// funciones-puente que reenvían a `answersSection` — una variable `let` que el
// ensamblador rellena en cuanto crea answers, un instante después. Los métodos
// de rooms solo LEEN esas funciones cuando se EJECUTAN (nunca durante la
// construcción), así que el orden de creación no importa, solo el de uso.
import { rid } from '../../core/ids.js';
import { pbJson } from '../../core/pbHttp.js';
import { createClaimsSection } from './realtimeClaims.js';
import { createAnswersSection } from './realtimeAnswers.js';
import { createRoomsSection } from './realtimeRooms.js';
import { createMantenimientoSection } from './realtimeMantenimiento.js';
import { crearSuscripcionSala } from './realtimeStream.js';
import { sondaDeColeccion } from './colecciones.js';
import { fila, numeroOnulo, texto } from '../frontera.js';

/**
 * @typedef {import('../../kernel/contracts/dataPort.js').RealtimePort} RealtimePort
 * @typedef {ReturnType<typeof createAnswersSection>} SeccionRespuestas
 */

const COLL = 'live_sessions';
const ANS = 'live_answers';   // one record per student answer (lost-update fix)
const PLR = 'live_players';   // one record per player (lost-update fix del join)
const KEY = 'live_keys';      // contenido COMPLETO de la sala (host-only, §22-2)
const CLM = 'live_claims';    // credencial del dispositivo del alumno (§22-4)

function genUserId() { return rid('u_'); }

/** @param {string} path @param {RequestInit & {timeoutMs?: number}} [opts] @returns {Promise<unknown>} */
async function pbFetchOnce(path, opts = {}) {
  const { body: reqBody, method, headers: extra, timeoutMs = 12000 } = opts;
  // Abort a stalled socket instead of hanging forever: on flaky mobile a TCP
  // connection can open but never respond, which would leave submit/load/host
  // actions pending indefinitely (frozen UI, submitQueue never enqueues). The
  // AbortError flows into the offline queue / reconnect backoff like any failure.
  // El wrapper JSON (firma profe/anónimo + parseo + error { status, pb }) vive
  // UNA vez en core/pbHttp.js; aquí solo se le añade el timeout.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await pbJson(path, { method, body: reqBody, headers: extra, signal: ctrl.signal });
  } catch (e) {
    if (texto(fila(e).name) === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Reintenta las lecturas (GET) ante fallos TRANSITORIOS — timeout, red caída, 5xx —
// que en móvil flojo tumbaban un `join`/`fetchSession` de una sola vez ("un alumno
// no entra y hay que refrescar"). Solo GET: es idempotente, reintentarlo no duplica
// nada. Las ESCRITURAS (POST/PATCH) NO se reintentan aquí (podrían pisar el blob
// `state` — deuda A); su resiliencia vive en la cola offline. Backoff 300/700ms.
/** @param {string} path @param {RequestInit & {timeoutMs?: number}} [opts] @returns {Promise<unknown>} */
async function pbFetch(path, opts = {}) {
  const attempts = (!opts.method || opts.method === 'GET') ? 3 : 1;
  for (let i = 0; ; i++) {
    try { return await pbFetchOnce(path, opts); }
    catch (e) {
      const estado = numeroOnulo(fila(e).status);
      const transient = fila(e).timeout === true || estado === 0 || (estado ?? 0) >= 500;
      if (!transient || i >= attempts - 1) throw e;
      await new Promise(res => setTimeout(res, i === 0 ? 300 : 700));
    }
  }
}

/**
 * @param {{userId?: string}} [opts]
 * @returns {RealtimePort}
 */
export function createPocketbaseRealtime({ userId = genUserId() } = {}) {
  // "¿Existe esta colección?" — la sonda memoizada vive en ./colecciones.js (la
  // misma que decide si las tareas van a PocketBase). Si falta, las rutas que la
  // usan caen al blob heredado (cero cambio pre-migración).
  const answersReady = sondaDeColeccion(ANS);
  const playersReady = sondaDeColeccion(PLR);

  const claims = createClaimsSection({ pbFetch, CLM });

  // Ver la nota de "DEPENDENCIA CIRCULAR DECLARADA" en la cabecera: rooms se
  // crea primero y recibe puentes hacia `answersSection`, rellenada justo
  // después. Los puentes solo se INVOCAN al ejecutar un método (ql_award,
  // endSession), nunca durante esta construcción.
  /** @type {SeccionRespuestas} */
  let answersSection;
  const rooms = createRoomsSection({
    pbFetch, COLL, KEY, PLR, ANS, userId, answersReady, playersReady,
    registerClaim: claims.registerClaim,
    claimSecret: claims.claimSecret,
    postAnswer: (body) => answersSection.postAnswer(body),
    getAnswerRow: (sessionId, itemIndex, playerId) => answersSection.getAnswerRow(sessionId, itemIndex, playerId),
    settlePendingInto: (engine, sessionId) => answersSection.settlePendingInto(engine, sessionId),
  });

  answersSection = createAnswersSection({
    pbFetch, ANS,
    claimHeaders: claims.claimHeaders,
    load: rooms.load,
    saveState: rooms.saveState,
    fetchPlayers: rooms.fetchPlayers,
    playersReady, answersReady,
  });

  const mantenimiento = createMantenimientoSection({
    pbFetch, COLL, ANS, PLR, CLM, playersReady,
    load: rooms.load, saveState: rooms.saveState,
  });

  return {
    kind: 'pocketbase',

    // ── sección rooms (`live_sessions` + `live_players`) ──────────────────
    createRoom: rooms.createRoom,
    findRoomByCode: rooms.findRoomByCode,
    fetchSession: rooms.fetchSession,
    fetchSessionKey: rooms.fetchSessionKey,
    listSessions: rooms.listSessions,
    fetchSessionRecord: rooms.fetchSessionRecord,
    fetchSessionBlob: rooms.fetchSessionBlob,
    joinSession: rooms.joinSession,
    startSession: rooms.startSession,
    endSession: rooms.endSession,
    setSessionState: rooms.setSessionState,
    claimQuestion: rooms.claimQuestion,
    listPlayers: rooms.listPlayers,

    // ── sección answers (`live_answers`) ───────────────────────────────────
    settleItem: answersSection.settleItem,
    submitAnswer: answersSection.submitAnswer,
    submitRaceAttempt: answersSection.submitRaceAttempt,
    submitProgress: answersSection.submitProgress,
    getOwnAnswer: answersSection.getOwnAnswer,
    listOwnAnswers: answersSection.listOwnAnswers,
    listAnswers: answersSection.listAnswers,
    leaderboard: answersSection.leaderboard,

    // ── sección mantenimiento ───────────────────────────────────────────────
    kickPlayer: mantenimiento.kickPlayer,
    purgeOldLive: mantenimiento.purgeOldLive,
    pingPresence: mantenimiento.pingPresence,
    pingHost: mantenimiento.pingHost,

    subscribeRoom: crearSuscripcionSala({ COLL, PLR, playersReady }),
  };
}

export default createPocketbaseRealtime;
