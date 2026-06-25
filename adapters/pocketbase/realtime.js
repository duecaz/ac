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

const COLL = 'live_sessions';

function genUserId() { return 'u_' + Math.random().toString(36).slice(2, 10); }

async function pbFetch(path, opts = {}) {
  const { body: reqBody, method, headers: extra, ...rest } = opts;
  const headers = {};
  if (reqBody && typeof reqBody === 'string') headers['Content-Type'] = 'application/json';
  if (extra) Object.assign(headers, extra);
  const r = await fetch(`${PB_URL}${path}`, {
    method: method || 'GET',
    headers,
    ...(reqBody !== undefined ? { body: reqBody } : {}),
    ...rest,
  });
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
          if (attempt < 4 && (e.status === 400 || e.status === 409)) continue;
          if (e.status === 404) {
            throw new Error('La colección "live_sessions" no existe en el servidor. '
              + 'Créala una sola vez en Admin → "Crear colecciones".');
          }
          throw e;
        }
      }
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
        ql_done: rec.state?.qlDone ?? [],
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
        ql_done: rec.state?.qlDone ?? [],
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
      if ('ql_done' in patch) engine.state.qlDone = patch.ql_done ?? [];
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

      function connect() {
        if (!active) return;
        es = new EventSource(`${PB_URL}/api/realtime`);

        es.addEventListener('PB_CONNECT', async (e) => {
          if (!active) return;
          try {
            const { clientId } = JSON.parse(e.data);
            await fetch(`${PB_URL}/api/realtime`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, subscriptions: [topic] }),
            });
          } catch { /* subscription failed — will reconnect on next PB_CONNECT */ }
        });

        es.addEventListener(topic, (e) => {
          if (!active) return;
          try {
            const { action } = JSON.parse(e.data);
            // All state is in one record: fire all three virtual tables so views
            // that listen for 'sessions', 'players', or 'answers' all re-fetch.
            onChange({ table: 'sessions', eventType: action });
            onChange({ table: 'players', eventType: action });
            onChange({ table: 'answers', eventType: action });
          } catch { /* malformed SSE payload */ }
        });

        es.onerror = () => {
          // EventSource auto-reconnects; PB_CONNECT fires again on reconnect
          // and re-runs the subscription POST. No manual reconnect needed.
        };
      }

      connect();
      return () => { active = false; es?.close(); };
    },
  };
}

export default createPocketbaseRealtime;
