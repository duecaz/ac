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
import { createLiveRoom } from '../../kernel/live/engine.js';
import { pickWord } from '../../core/liveWords.js';
import { PB_URL } from '../../pocketbase.config.js';
import { setConnectionState } from '../../core/connection.js';

const COLL = 'live_sessions';

function genUserId() { return 'u_' + Math.random().toString(36).slice(2, 10); }

async function pbFetch(path, opts = {}) {
  const { body: reqBody, method, headers: extra, timeoutMs = 12000, ...rest } = opts;
  const headers = {};
  if (reqBody && typeof reqBody === 'string') headers['Content-Type'] = 'application/json';
  if (extra) Object.assign(headers, extra);
  // Abort a stalled socket instead of hanging forever: on flaky mobile a TCP
  // connection can open but never respond, which would leave submit/load/host
  // actions pending indefinitely (frozen UI, submitQueue never enqueues). The
  // AbortError flows into the offline queue / reconnect backoff like any failure.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(`${PB_URL}${path}`, {
      method: method || 'GET',
      headers,
      ...(reqBody !== undefined ? { body: reqBody } : {}),
      ...rest,
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { throw Object.assign(new Error(`PocketBase error ${r.status}: respuesta no-JSON`), { status: r.status }); }
  }
  if (!r.ok) throw Object.assign(new Error(body?.message || `PocketBase error ${r.status}`), { status: r.status, pb: body });
  return body;
}

export function createPocketbaseRealtime({ userId = genUserId() } = {}) {
  // Load a session record and rebuild the engine over its persisted state.
  async function load(sessionId) {
    const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
    if (!rec) throw new Error('Sala no encontrada');
    const engine = createLiveRoom(rec.activity, { state: rec.state, code: rec.code });
    return { rec, engine };
  }

  async function saveState(sessionId, engine) {
    await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: engine.state }),
    });
  }

  return {
    kind: 'pocketbase',

    async createRoom(activity) {
      // Fetch currently active codes so pickWord avoids duplicates. On any
      // network failure or uniqueness collision we retry once with another word.
      let usedCodes = new Set();
      try {
        const res = await pbFetch(`/api/collections/${COLL}/records?fields=code&perPage=200`);
        for (const rec of res?.items || []) usedCodes.add(rec.code);
      } catch { /* proceed with empty set — collision handled by retry below */ }

      for (let attempt = 0; attempt < 5; attempt++) {
        const code = pickWord(attempt === 0 ? usedCodes : new Set());
        const engine = createLiveRoom(activity, { code });
        try {
          const rec = await pbFetch(`/api/collections/${COLL}/records`, {
            method: 'POST',
            body: JSON.stringify({ code, activity, state: engine.state }),
          });
          return { id: rec.id, code };
        } catch (e) {
          if (e.status === 404) {
            throw new Error('La colección "live_sessions" no existe en el servidor. '
              + 'Créala una sola vez en Admin → "Crear colecciones".');
          }
          // Retry on PIN collision (400/409) AND on transient failures (network
          // error → no status, 5xx, timeout) — a momentary blip shouldn't kill
          // room creation outright.
          const retryable = !e.status || e.status === 400 || e.status === 409 || e.status >= 500;
          if (attempt < 4 && retryable) continue;
          throw e;
        }
      }
      // All attempts exhausted (persistent collisions / validation): fail loudly
      // so the caller shows a clear message instead of crashing on undefined.id.
      throw new Error('No se pudo crear la sala tras varios intentos. Revisa la conexión e inténtalo de nuevo.');
    },

    async findRoomByCode(code) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=(code='${encodeURIComponent(code.toUpperCase())}')`
      );
      const rec = res?.items?.[0];
      if (!rec) return null;
      return {
        id: rec.id,
        code: rec.code,
        status: rec.state?.status,
        phase: rec.state?.phase,
        current_item: rec.state?.currentItem,
        deadline: rec.state?.deadline ?? null,
        activity_snap: rec.activity,
        ql_open: rec.state?.qlOpen ?? null,
        ql_question: rec.state?.qlQuestion ?? null,
        ql_image: rec.state?.qlImage ?? null,
        ql_points: rec.state?.qlPoints ?? {},
        ql_by: rec.state?.qlBy ?? null,
        ql_by_name: rec.state?.qlByName ?? null,
      };
    },

    async fetchSession(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      if (!rec) throw new Error('Sala no encontrada');
      return {
        id: rec.id,
        code: rec.code,
        status: rec.state?.status,
        phase: rec.state?.phase,
        current_item: rec.state?.currentItem,
        deadline: rec.state?.deadline ?? null,
        started_at: rec.state?.startedAt ?? null,
        activity_snap: rec.activity,
        ql_open: rec.state?.qlOpen ?? null,
        ql_question: rec.state?.qlQuestion ?? null,
        ql_image: rec.state?.qlImage ?? null,
        ql_points: rec.state?.qlPoints ?? {},
        ql_by: rec.state?.qlBy ?? null,
        ql_by_name: rec.state?.qlByName ?? null,
      };
    },

    // The host holds the full activity (with answer keys) — return it directly.
    async fetchSessionKey(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      return rec?.activity || null;
    },

    async joinSession(code, nickname) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=(code='${encodeURIComponent(code.toUpperCase())}')`
      );
      const rec = res?.items?.[0];
      if (!rec) throw new Error('Sala no encontrada');
      if (rec.state?.status === 'ended') throw new Error('La sala ha terminado');
      const live = rec.activity?.live || {};
      if (rec.state?.status !== 'lobby' && !live.allowLateJoin) throw new Error('La partida ya empezó');

      const engine = createLiveRoom(rec.activity, { state: rec.state, code: rec.code });
      const p = engine.join(userId, nickname);
      await saveState(rec.id, engine);
      return { sessionId: rec.id, playerId: p.id, name: p.name };
    },

    async startSession(sessionId) {
      const { engine } = await load(sessionId);
      engine.state.status = 'running';
      engine.state.phase = 'question';
      engine.state.currentItem = 0;
      await saveState(sessionId, engine);
    },

    async endSession(sessionId) {
      const { engine } = await load(sessionId);
      engine.state.status = 'ended';
      engine.state.phase = 'ended';
      await saveState(sessionId, engine);
    },

    async setSessionState(sessionId, patch) {
      const { engine } = await load(sessionId);
      if (patch.status !== undefined) engine.state.status = patch.status;
      if (patch.phase !== undefined) engine.state.phase = patch.phase;
      if ('current_item' in patch) engine.state.currentItem = patch.current_item;
      if ('deadline' in patch) engine.state.deadline = patch.deadline ?? null;
      if ('started_at' in patch) engine.state.startedAt = patch.started_at ?? null;
      if ('ql_open' in patch) engine.state.qlOpen = patch.ql_open ?? null;
      if ('ql_question' in patch) engine.state.qlQuestion = patch.ql_question ?? null;
      if ('ql_image' in patch) engine.state.qlImage = patch.ql_image ?? null;
      if ('ql_points' in patch) engine.state.qlPoints = patch.ql_points ?? {};
      if ('ql_by' in patch) engine.state.qlBy = patch.ql_by ?? null;
      if ('ql_by_name' in patch) engine.state.qlByName = patch.ql_by_name ?? null;
      if (patch.ql_award) {
        const { playerId, points } = patch.ql_award;
        const p = engine.state.players.find(pl => pl.id === playerId);
        if (p) p.score += points;
      }
      await saveState(sessionId, engine);
    },

    async settleItem(sessionId, itemIndex) {
      const { engine } = await load(sessionId);
      const settled = engine.settle(itemIndex);
      await saveState(sessionId, engine);
      return { ok: true, settled };
    },

    async submitAnswer(sessionId, playerId, itemIndex, value, msTaken) {
      const { engine } = await load(sessionId);
      engine.submit(playerId, itemIndex, value, msTaken);
      await saveState(sessionId, engine);
    },

    async getOwnAnswer(sessionId, playerId, itemIndex) {
      const { engine } = await load(sessionId);
      return engine.state.answers[`${itemIndex}:${playerId}`] || null;
    },

    async listPlayers(sessionId) {
      const { engine } = await load(sessionId);
      return engine.state.players.slice();
    },

    async listAnswers(sessionId, itemIndex) {
      const { engine } = await load(sessionId);
      const a = engine.state.answers;
      return Object.entries(a)
        .filter(([k]) => k.startsWith(itemIndex + ':'))
        .map(([, v]) => v);
    },

    async leaderboard(sessionId, limit = 50) {
      const { engine } = await load(sessionId);
      return engine.leaderboard(limit);
    },

    async kickPlayer(sessionId, playerId) {
      const { engine } = await load(sessionId);
      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
      await saveState(sessionId, engine);
    },

    async pingPresence() { /* state is in PB record, no presence table needed */ },
    async pingHost() { /* no-op */ },

    // PocketBase SSE realtime. Subscribes to the specific live_sessions record.
    // On any update, notifies the view with all three table types so it re-fetches
    // players, answers, and session state (all live in the same PB record).
    subscribeRoom(sessionId, onChange) {
      const topic = `${COLL}/${sessionId}`;
      let active = true;
      let es = null;
      let retries = 0;          // consecutive failed connection attempts
      let retryTimer = null;

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
        // so brief blips during normal heartbeats don't flash it).
        try { setConnectionState('reconnecting'); } catch {}
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

      function connect() {
        if (!active) return;
        teardown(es);
        const self = new EventSource(`${PB_URL}/api/realtime`);
        es = self;

        self.addEventListener('PB_CONNECT', async (e) => {
          if (!active || es !== self) return;
          retries = 0; // a successful handshake resets the backoff
          try { setConnectionState('connected'); } catch {}
          try {
            const { clientId } = JSON.parse(e.data);
            const r = await fetch(`${PB_URL}/api/realtime`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, subscriptions: [topic] }),
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
          try {
            const { action } = JSON.parse(e.data);
            // All state is in one record: fire all three virtual tables so views
            // that listen for 'sessions', 'players', or 'answers' all re-fetch.
            onChange({ table: 'sessions', eventType: action });
            onChange({ table: 'players', eventType: action });
            onChange({ table: 'answers', eventType: action });
          } catch (err) { console.warn('[realtime] malformed SSE payload — skipping event:', err, e?.data?.slice?.(0, 120)); }
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
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        teardown(es);
        es = null;
      };
    },
  };
}

export default createPocketbaseRealtime;
