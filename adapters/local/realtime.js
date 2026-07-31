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
import { rid } from '../../core/ids.js';
import { createLiveRoom } from '../../kernel/live/engine.js';
import { pickWord } from '../../core/liveWords.js';
import { clock } from '../../core/clock.js';

const PREFIX = 'ww.live.';

function defaultKV() { try { return globalThis.localStorage || null; } catch { return null; } }
function defaultMakeChannel(name) { try { return new BroadcastChannel(name); } catch { return null; } }
function genUserId() { return rid('u_'); }

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
    // Driver de mismo dispositivo (localStorage + BroadcastChannel). La vista lo
    // usa para avisar que la sala NO funciona entre dispositivos/redes.
    kind: 'local',

    async createRoom(activity) {
      // Collect currently-active codes (localStorage keys under our prefix) so
      // pickWord can avoid handing out a word that's already in use.
      let usedCodes = new Set();
      try {
        if (kv) {
          for (let i = 0; i < kv.length; i++) {
            const k = kv.key(i);
            if (k?.startsWith(PREFIX)) usedCodes.add(k.slice(PREFIX.length));
          }
        } else {
          usedCodes = new Set(mem.keys()).difference ? new Set([...mem.keys()].map(k => k.slice(PREFIX.length))) : usedCodes;
        }
      } catch { /* ignore — worst case two rooms share a word (recycling) */ }
      const code = pickWord(usedCodes);
      const engine = createLiveRoom(activity, { code });
      // `created`: espejo del campo autodate de PocketBase. Sin él, la retención
      // (§25) no tendría por dónde decidir qué sala es vieja en modo local.
      write(code, { activity, state: engine.state, created: new Date(clock.now()).toISOString() });
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
      if ('deadline' in patch) room.deadline = patch.deadline ?? null;
      // R-1 · espejo del driver PB: el instante de apertura de respuestas.
      if ('answers_open_at' in patch) room.answersOpenAt = patch.answers_open_at ?? null;
      // Espejo: la política de fin de carrera/tablero (core/liveEnd.js).
      if ('end_policy' in patch) room.endPolicy = patch.end_policy ?? null;
      if ('end_n' in patch) room.endN = patch.end_n ?? null;
      if ('started_at' in patch) room.startedAt = patch.started_at ?? null;
      if ('ql_points' in patch) s.qlPoints = patch.ql_points ?? {};
      // Espejo del driver PB: el "pedir la palabra" vive en room.ql, fuera del
      // blob de estado (ley de confianza §22).
      const MAP = { ql_open: 'open', ql_question: 'question', ql_image: 'image', ql_by: 'by', ql_by_name: 'byName' };
      for (const [k, f] of Object.entries(MAP)) if (k in patch) (room.ql ||= {})[f] = patch[k] ?? null;
      if (patch.ql_award) {
        const { playerId, points } = patch.ql_award;
        const p = s.players.find(pl => pl.id === playerId);
        if (p) p.score += points;
      }
      save(code, room, engine); notify(code, 'sessions');
    },

    async startSession(code) {
      return this.setSessionState(code, { status: 'running', phase: 'question', current_item: 0 });
    },

    // El alumno pide la palabra: solo room.ql (espejo del driver PB).
    async claimQuestion(code, claim) {
      const room = read(code);
      if (!room) throw new Error('Sala no encontrada');
      room.ql = {
        open: claim?.open ?? null, question: claim?.question ?? null, image: claim?.image ?? null,
        by: claim?.by ?? null, byName: claim?.byName ?? null,
      };
      write(code, room);
      notify(code, 'sessions');
    },

    // Cerrar la sala LIQUIDA lo pendiente y luego marca 'ended' (mismo contrato que
    // el driver PocketBase): ninguna respuesta rezagada se queda sin puntuar.
    // `keepPhase` evita que settle() mueva la fase a 'reveal' al cerrar; solo se
    // guarda el barrido si procesó algo (el cierre repetido no re-escribe).
    async endSession(code) {
      const { room, engine } = load(code);
      if (engine.settleAll({ keepPhase: true }) > 0) save(code, room, engine);
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

    // Carrera (opción A analítica): captura v0/c0 (primer intento) sin cambiar el
    // juego. ANTI-TRAMPA (C6, espejo del adaptador PB): el veredicto del cliente
    // es solo un HINT de avance — la respuesta queda SIN puntuar (correct:null)
    // y la liquida el settle del host con la fórmula real.
    async submitRaceAttempt(code, playerId, itemIndex, value, correct, points, msTaken) {
      const { room, engine } = load(code);
      const key = `${Number(itemIndex)}:${playerId}`;
      const prev = engine.state.answers[key];
      const v0 = prev && 'v0' in prev ? prev.v0 : value;
      const c0 = prev && 'c0' in prev ? prev.c0 : !!correct;
      if (!prev || (correct && prev.hint !== true)) {
        engine.state.answers[key] = { playerId, value, msTaken: msTaken ?? 0, correct: null, points: 0, hint: !!correct, v0, c0 };
        save(code, room, engine); notify(code, 'answers');
      }
    },

    // Continuous progress upsert (live board templates). Overwrites the player's
    // own answer slot each move so the host's dashboard updates live.
    async submitProgress(code, playerId, value, msTaken, itemIndex = 0) {
      const { room, engine } = load(code);
      engine.state.answers[`${Number(itemIndex)}:${playerId}`] = { playerId, value, msTaken: msTaken ?? 0, correct: null, points: 0 };
      save(code, room, engine); notify(code, 'answers');
    },

    async findRoomByCode(code) {
      try { return await this.fetchSession(code); } catch { return null; }
    },

    async getOwnAnswer(code, playerId, itemIndex) {
      return load(code).engine.state.answers[`${itemIndex}:${playerId}`] || null;
    },

    // Filas PROPIAS del alumno (reanudar la carrera tras recarga —
    // core/raceResume.js). Espejo del adaptador PB: `correct: true` = ya lo
    // acertó (veredicto O hint de carrera); un fallo sin puntuar queda en null.
    async listOwnAnswers(code, playerId) {
      const a = load(code).engine.state.answers;
      return Object.entries(a)
        .filter(([k]) => k.endsWith(':' + playerId))
        .map(([k, v]) => ({
          itemIndex: Number(k.split(':')[0]), value: v.value,
          correct: (v.correct === true || v.hint === true) ? true : (v.correct === false ? false : null),
          points: v.points,
        }));
    },

    async kickPlayer(code, playerId) {
      const { room, engine } = load(code);
      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
      save(code, room, engine); notify(code, 'players');
    },

    // §25 CAPACIDAD — espejo de la retención del driver PocketBase. En local
    // una sala ES su clave de localStorage (con sus respuestas y jugadores
    // dentro del blob), así que purgar la sala se lleva todo lo suyo.
    async purgeOldLive(cutoffIso, { dryRun = true } = {}) {
      const out = { cutoff: cutoffIso, dryRun, sessions: 0, answers: 0, players: 0, claims: 0, errors: [] };
      const codes = [];
      try {
        if (kv) { for (let i = 0; i < kv.length; i++) { const k = kv.key(i); if (k?.startsWith(PREFIX)) codes.push(k.slice(PREFIX.length)); } }
        else for (const k of mem.keys()) codes.push(k.slice(PREFIX.length));
      } catch (e) { out.errors.push(e.message); return out; }
      for (const code of codes) {
        const room = read(code);
        // Sin fecha NO se purga (§24: ante la duda, se conserva).
        if (!room?.created || String(room.created) >= String(cutoffIso)) continue;
        out.sessions++;
        out.answers += Object.keys(room.state?.answers || {}).length;
        out.players += (room.state?.players || []).length;
        if (!dryRun) { try { kv ? kv.removeItem(PREFIX + code) : mem.delete(PREFIX + code); } catch (e) { out.errors.push(`${code}: ${e.message}`); } }
      }
      return out;
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
      return {
        id: code, code,
        status: r.state.status, phase: r.state.phase,
        current_item: r.state.currentItem,
        deadline: r.deadline ?? null,
        started_at: r.startedAt ?? null,
        answers_open_at: r.answersOpenAt ?? null,
        end_policy: r.endPolicy ?? null,
        end_n: r.endN ?? null,
        activity_snap: r.activity,
        // `ql` fuera del blob (§22), con respaldo al blob de salas anteriores.
        ql_open: r.ql?.open ?? r.state.qlOpen ?? null,
        ql_question: r.ql?.question ?? r.state.qlQuestion ?? null,
        ql_image: r.ql?.image ?? r.state.qlImage ?? null,
        ql_by: r.ql?.by ?? r.state.qlBy ?? null,
        ql_by_name: r.ql?.byName ?? r.state.qlByName ?? null,
        ql_points: r.state.qlPoints ?? {},
      };
    },

    // Single-device local mode: no separate answer key — the host already holds
    // the full activity in its session. Return null so callers fall back to it.
    async fetchSessionKey() { return null; },

    // Espejo del driver PB: el blob de estado para el respaldo del informe.
    async fetchSessionBlob(code) { return read(code)?.state || {}; },

    // Informes (§21): el DUEÑO sirve las filas de salas también en local, así el
    // informe funciona en dev sin PocketBase (antes la vista consultaba PB a
    // pelo y en local no había nada que ver).
    async listSessions() {
      const out = [];
      const keys = kv ? Object.keys(kv).filter(k => k.startsWith(PREFIX)) : [...mem.keys()];
      for (const k of keys) {
        const code = k.slice(PREFIX.length);
        const room = read(code);
        if (room) out.push({ id: code, code, activity: room.activity, state: room.state });
      }
      return out;
    },

    async fetchSessionRecord(code) {
      const room = read(code);
      return room ? { id: code, code, activity: room.activity, state: room.state } : null;
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
