// Local RealtimePort driver — runs a whole LIVE session inside the browser, no
// backend. Room state is shared across tabs via a key-value store (localStorage)
// and change notifications via a channel (BroadcastChannel). Both are injectable
// so two simulated "tabs" can be driven in a Node test.
//
// Each driver instance models ONE tab/user (its own anon userId). The host tab
// owns nothing special: any tab loads the shared state, applies an op through
// the pure kernel/live/engine, persists, and notifies. Scoring still happens in
// settle() (engine, anti-cheat parity) — fine for local dev. The Supabase driver
// keeps true server-side scoring.
import { createLiveRoom } from '../../kernel/live/engine.js';
import { LETTERS, PIN_LENGTH } from '../../core/constants.js';

const PREFIX = 'ww.live.';

function defaultKV() { try { return globalThis.localStorage || null; } catch { return null; } }
function defaultMakeChannel(name) { try { return new BroadcastChannel(name); } catch { return null; } }
function genCode() { let s = ''; for (let i = 0; i < PIN_LENGTH; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return s; }
function genUserId() { return 'u_' + Math.random().toString(36).slice(2, 10); }

export function createLocalRealtime({ kv = defaultKV(), makeChannel = defaultMakeChannel, userId = genUserId() } = {}) {
  const mem = new Map();
  const read = (code) => {
    const k = PREFIX + code;
    if (kv) { try { return JSON.parse(kv.getItem(k) || 'null'); } catch { return null; } }
    return mem.get(k) || null;
  };
  const write = (code, room) => { const k = PREFIX + code; if (kv) kv.setItem(k, JSON.stringify(room)); else mem.set(k, room); };

  const channels = new Map();
  const subs = new Map(); // code -> Set<onChange>  (this tab's own subscribers)
  const chan = (code) => { let c = channels.get(code); if (!c) { c = makeChannel(PREFIX + code); channels.set(code, c); } return c; };
  // Notify other tabs (channel) AND this tab's own subscribers — Supabase echoes
  // postgres_changes to every client including the one that made the change, so
  // the host UI relies on seeing its own actions reflected.
  const notify = (code, table) => {
    chan(code)?.postMessage?.({ table });
    for (const fn of subs.get(code) || []) fn({ table, eventType: '*' });
  };

  // Load shared room → rebuild engine over its state → mutate → persist.
  function load(code) {
    const room = read(code);
    if (!room) throw new Error('Sala no encontrada');
    return { room, engine: createLiveRoom(room.activity, { state: room.state, code }) };
  }
  function save(code, room, engine) { room.state = engine.state; write(code, room); }

  return {
    async createRoom(activity) {
      const code = genCode();
      const engine = createLiveRoom(activity, { code });
      write(code, { activity, state: engine.state });
      return { id: code, code };
    },

    async joinSession(code, nickname) {
      const { room, engine } = load(code);
      const p = engine.join(userId, nickname);
      save(code, room, engine); notify(code, 'players');
      return { sessionId: code, playerId: p.id, name: p.name };
    },

    async setSessionState(code, patch) {
      const { room, engine } = load(code);
      const s = engine.state;
      if (patch.status) s.status = patch.status;
      if (patch.phase) s.phase = patch.phase;
      if ('current_item' in patch) s.currentItem = patch.current_item;
      save(code, room, engine); notify(code, 'sessions');
    },

    async startSession(code) {
      return this.setSessionState(code, { status: 'running', phase: 'question', current_item: 0 });
    },

    async endSession(code) {
      return this.setSessionState(code, { status: 'ended', phase: 'ended' });
    },

    async settleItem(code, itemIndex) {
      const { room, engine } = load(code);
      const settled = engine.settle(itemIndex); // sets phase=reveal, scores server-side
      save(code, room, engine); notify(code, 'answers'); notify(code, 'sessions');
      return { ok: true, settled };
    },

    async submitAnswer(code, playerId, itemIndex, value, msTaken) {
      const { room, engine } = load(code);
      engine.submit(playerId, itemIndex, value, msTaken);
      save(code, room, engine); notify(code, 'answers');
    },

    async findRoomByCode(code) {
      try { return await this.fetchSession(code); } catch { return null; }
    },

    async getOwnAnswer(code, playerId, itemIndex) {
      return load(code).engine.state.answers[`${itemIndex}:${playerId}`] || null;
    },

    async kickPlayer(code, playerId) {
      const { room, engine } = load(code);
      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
      save(code, room, engine); notify(code, 'players');
    },

    async pingPresence(/* playerId */) { /* no-op locally */ },
    async pingHost(/* code */) { /* no-op locally */ },

    async listPlayers(code) { return load(code).engine.state.players.slice(); },

    async listAnswers(code, itemIndex) {
      const a = load(code).engine.state.answers;
      return Object.entries(a).filter(([k]) => k.startsWith(itemIndex + ':')).map(([, v]) => v);
    },

    async leaderboard(code, limit = 50) { return load(code).engine.leaderboard(limit); },

    async fetchSession(code) {
      const r = read(code);
      if (!r) throw new Error('Sala no encontrada');
      return { id: code, code, status: r.state.status, phase: r.state.phase, current_item: r.state.currentItem, activity_snap: r.activity };
    },

    // onChange({ table }) — the view re-fetches players/answers/session on notice.
    // Registers both a same-tab subscriber (self-echo) and a cross-tab channel
    // listener; the returned function tears both down.
    subscribeRoom(code, onChange) {
      const set = subs.get(code) || new Set();
      set.add(onChange); subs.set(code, set);
      const c = chan(code);
      const h = (ev) => onChange({ table: ev?.data?.table, eventType: '*' });
      c?.addEventListener?.('message', h);
      return () => { set.delete(onChange); c?.removeEventListener?.('message', h); };
    },
  };
}

export default createLocalRealtime;
