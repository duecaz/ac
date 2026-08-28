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
// La suscripción SSE (`subscribeRoom`) se queda AQUÍ: no pertenece a una sola
// colección (reenvía cambios de sesión Y de jugadores) y es el movimiento más
// pequeño correcto.
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
import { PB_URL } from '../../pocketbase.config.js';
import { startStreamWatchdog } from '../../core/streamWatchdog.js';
import { setConnectionState } from '../../core/connection.js';
import { createClaimsSection } from './realtimeClaims.js';
import { createAnswersSection } from './realtimeAnswers.js';
import { createRoomsSection } from './realtimeRooms.js';
import { createMantenimientoSection } from './realtimeMantenimiento.js';

const COLL = 'live_sessions';
const ANS = 'live_answers';   // one record per student answer (lost-update fix)
const PLR = 'live_players';   // one record per player (lost-update fix del join)
const KEY = 'live_keys';      // contenido COMPLETO de la sala (host-only, §22-2)
const CLM = 'live_claims';    // credencial del dispositivo del alumno (§22-4)

function genUserId() { return rid('u_'); }

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
    if (e?.name === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
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
async function pbFetch(path, opts = {}) {
  const attempts = (!opts.method || opts.method === 'GET') ? 3 : 1;
  for (let i = 0; ; i++) {
    try { return await pbFetchOnce(path, opts); }
    catch (e) {
      const transient = e?.timeout || e?.status === 0 || e?.status >= 500;
      if (!transient || i >= attempts - 1) throw e;
      await new Promise(res => setTimeout(res, i === 0 ? 300 : 700));
    }
  }
}

// "¿Existe esta colección?" — probe cacheado por adaptador. Si falta, las rutas
// que la usan caen al blob heredado (cero cambio pre-migración). Una sola
// implementación para live_answers (lost-update de respuestas) y live_players
// (deuda A, lost-update del join).
function collectionProbe(coll) {
  let cached;   // undefined = desconocido, luego true/false
  return async () => {
    if (cached !== undefined) return cached;
    try {
      const r = await fetch(`${PB_URL}/api/collections/${coll}/records?perPage=1`);
      if (r.status === 200) return (cached = true);
      const body = await r.json().catch(() => ({}));
      if (body?.message?.includes('Missing collection')) return (cached = false);
      cached = r.ok;
    } catch { cached = false; }
    return cached;
  };
}

export function createPocketbaseRealtime({ userId = genUserId() } = {}) {
  const answersReady = collectionProbe(ANS);
  const playersReady = collectionProbe(PLR);

  const claims = createClaimsSection({ pbFetch, CLM });

  // Ver la nota de "DEPENDENCIA CIRCULAR DECLARADA" en la cabecera: rooms se
  // crea primero y recibe puentes hacia `answersSection`, rellenada justo
  // después. Los puentes solo se INVOCAN al ejecutar un método (ql_award,
  // endSession), nunca durante esta construcción.
  let answersSection;
  const rooms = createRoomsSection({
    pbFetch, COLL, KEY, PLR, ANS, userId, answersReady, playersReady,
    registerClaim: claims.registerClaim,
    claimSecret: claims.claimSecret,
    postAnswer: (...args) => answersSection.postAnswer(...args),
    getAnswerRow: (...args) => answersSection.getAnswerRow(...args),
    settlePendingInto: (...args) => answersSection.settlePendingInto(...args),
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

    // PocketBase SSE realtime. Subscribes to the specific live_sessions record.
    // On any update, notifies the view with all three table types so it re-fetches
    // players, answers, and session state (all live in the same PB record).
    subscribeRoom(sessionId, onChange) {
      const topic = `${COLL}/${sessionId}`;
      let active = true;
      let es = null;
      let retries = 0;          // consecutive failed connection attempts
      let retryTimer = null;
      let vigia = null;         // renovación preventiva (core/streamWatchdog.js)

      // Exponential backoff with jitter, capped at 30s. The native EventSource
      // reconnect hammers a downed server every ~3s; this backs off instead so
      // a PocketBase outage doesn't flood it with reconnects from every client.
      function backoffDelay() {
        const base = Math.min(30000, 1000 * 2 ** Math.min(retries, 5)); // 1,2,4,8,16,30…
        return base / 2 + Math.random() * (base / 2);                   // 50–100% jitter
      }

      function scheduleReconnect() {
        if (!active || retryTimer) return;
        const delay = backoffDelay();
        retries++;
        console.warn(`[realtime] reconnecting in ${Math.round(delay)}ms (attempt ${retries})`);
        // Surface the sticky "Reconectando…" banner (debounced inside connection.js
        // so brief blips during normal heartbeats don't flash it). After several
        // failed attempts, escalate to "Conexión perdida" so the user knows it's
        // not just a momentary blip.
        try { setConnectionState(retries >= 5 ? 'error' : 'reconnecting'); } catch {}
        retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
      }

      // Re-fetch all virtual tables. SSE only delivers CHANGES, so anything the
      // host changed while we were disconnected was never delivered; firing this
      // on every (re)connect makes a reconnecting student catch up instead of
      // staying stuck on a stale question.
      function resync(reason) {
        onChange({ table: 'sessions', eventType: reason });
        onChange({ table: 'players', eventType: reason });
        onChange({ table: 'answers', eventType: reason });
      }

      // Tear down an EventSource so a superseded source can't keep firing its
      // onerror and spawn a second reconnect stream (orphaned ES hammering a
      // downed server). Detaching onerror BEFORE close is the key step.
      function teardown(src) {
        if (!src) return;
        src.onerror = null;
        try { src.close(); } catch {}
      }

      // RENOVAR ANTES DE QUE LO CORTEN (propuesta del dueño, 2026-08-16: «si es
      // por inactividad debería tener un aviso antes de cumplirse la
      // inactividad»). El porqué y el matiz de SSE están en el primitivo
      // (core/streamWatchdog.js); aquí solo se elige el umbral.
      //
      // 80 s va por debajo del corte por inactividad más común en un
      // intermediario (Cloudflare cierra a los 100 s).
      //
      // OJO con la premisa: escribí que «un flujo vivo nunca llega a 80 s porque
      // el host sella `host_seen_at` cada ~10 s», y es FALSO en este adaptador —
      // `pingHost()` es un no-op aquí. Así que en los tramos tranquilos (lobby,
      // ventana de lectura, carrera sin envíos) la renovación NO es excepcional:
      // es rutina, cada 80 s y en cada aparato. Eso es justo lo que evita el
      // corte, pero cuesta un POST de suscripción y un `resync` por cliente.
      //
      // QUÉ HACER CON LA PESTAÑA OCULTA lo decide el PRIMITIVO (§23), no este
      // adaptador: `pausarOculto` no gasta con la pantalla apagada y, al volver
      // a primer plano, renueva solo si hubo silencio de verdad. Y `jitterMs`
      // reparte las reconexiones: cuando el profe dice «sacad el móvil», 30
      // aparatos disparan `visibilitychange` en el mismo segundo y la Pi —que
      // además sirve a otros dos proyectos— recibía las 30 de golpe. Aquí solo
      // queda el UMBRAL, que es lo único de PocketBase.
      const SILENCIO_MAX = 80000;
      function pararVigia() { if (vigia) { vigia.stop(); vigia = null; } }
      function renovar() {
        if (!active) return;
        // Si estamos en pleno backoff (sin flujo y con reintento pendiente), la
        // renovación ADELANTA ese reintento en vez de no hacer nada: volver a
        // mirar el móvil con la pantalla congelada y esperar otros 30 s era lo
        // contrario de lo que el alumno espera.
        if (!es) {
          if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; connect(); }
          return;
        }
        // Sin ruido y sin banner: esto NO es un fallo, es mantenimiento.
        teardown(es);
        es = null;
        retries = 0;
        connect();
      }
      function armarVigia() {
        pararVigia();
        vigia = startStreamWatchdog({
          silencioMs: SILENCIO_MAX,
          pausarOculto: true,
          jitterMs: 2000,
          onRenew: renovar,
        });
      }

      function connect() {
        if (!active) return;
        teardown(es);
        const self = new EventSource(`${PB_URL}/api/realtime`);
        es = self;

        self.addEventListener('PB_CONNECT', async (e) => {
          if (!active || es !== self) return;
          retries = 0; // a successful handshake resets the backoff
          armarVigia();
          try { setConnectionState('connected'); } catch {}
          try {
            const { clientId } = JSON.parse(e.data);
            // Suscribe también a live_players (deuda A) para que el lobby del
            // profe vea entrar gente al instante: los joins ya NO PATCHean el blob
            // (dejarían de disparar el topic de la sesión). Solo si la colección
            // existe — sin ella, suscribir un topic inexistente podría dejar el
            // POST connected-but-deaf en despliegues pre-migración.
            const subs = [topic];
            if (await playersReady()) subs.push(PLR);
            const r = await fetch(`${PB_URL}/api/realtime`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, subscriptions: subs }),
            });
            if (!r.ok) throw new Error(`subscribe HTTP ${r.status}`);
            resync('reconnect');
          } catch (err) {
            // PB_CONNECT fires once per connection; a failed subscribe would
            // leave us connected-but-deaf forever (no events, no error). Force a
            // fresh reconnect cycle instead of waiting for a PB_CONNECT that
            // will never come again.
            console.warn('[realtime] subscription POST failed — forcing reconnect:', err);
            if (es === self) { teardown(self); es = null; scheduleReconnect(); }
          }
        });

        self.addEventListener(topic, (e) => {
          if (!active || es !== self) return;
          vigia?.touch();
          try {
            const { action } = JSON.parse(e.data);
            // All state is in one record: fire all three virtual tables so views
            // that listen for 'sessions', 'players', or 'answers' all re-fetch.
            onChange({ table: 'sessions', eventType: action });
            onChange({ table: 'players', eventType: action });
            onChange({ table: 'answers', eventType: action });
          } catch (err) { console.warn('[realtime] malformed SSE payload — skipping event:', err, e?.data?.slice?.(0, 120)); }
        });

        // live_players (deuda A): un alumno entró/salió → el profe re-lee la
        // lista. El topic es la colección ENTERA (filtramos por sesión al
        // re-fetch en listPlayers); a escala colegio el ruido entre salas es
        // despreciable. Payload ignorado a propósito: forzamos un re-fetch.
        self.addEventListener(PLR, (e) => {
          if (!active || es !== self) return;
          vigia?.touch();
          try { onChange({ table: 'players', eventType: JSON.parse(e.data).action }); }
          catch { onChange({ table: 'players' }); }
        });

        self.onerror = (err) => {
          if (es !== self) return; // a superseded source firing late — ignore
          // Take over reconnection from the native EventSource: close it and
          // reconnect on an exponential backoff so a downed server isn't flooded.
          console.warn('[realtime] SSE connection error — backing off before reconnect:', err);
          teardown(self);
          es = null;
          scheduleReconnect();
        };
      }

      connect();
      return () => {
        active = false;
        pararVigia();
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        teardown(es);
        es = null;
      };
    },
  };
}

export default createPocketbaseRealtime;
