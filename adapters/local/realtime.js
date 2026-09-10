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
import { openedKey } from '../../core/serverMs.js';
import { blobDeSala, esFila, fila, mensajeDe, paraHidratar } from '../frontera.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/dataPort.js').PurgeReport} PurgeReport
 * @typedef {import('../../kernel/contracts/dataPort.js').RealtimePort} RealtimePort
 * @typedef {import('../../kernel/contracts/session.js').LiveEngine} LiveEngine
 * @typedef {import('../../kernel/contracts/session.js').RoomChange} RoomChange
 * @typedef {import('../frontera.js').BlobSala} BlobSala
 */

/**
 * LA SALA TAL Y COMO SE GUARDA EN EL ALMACÉN LOCAL. Espejo de la fila de
 * PocketBase con UNA divergencia declarada: aquí el RITMO de la partida
 * (deadline, apertura de respuestas, política de fin, `startedAt`) vive FUERA
 * del blob, en la propia sala, mientras que el driver de PocketBase lo guarda
 * dentro de `state`. Como cada driver lee lo que él mismo escribió, la
 * divergencia no se nota desde el puerto.
 * @typedef {Object} SalaLocal
 * @property {Activity} activity
 * @property {BlobSala} state
 * @property {string} [created]        Espejo del autodate de PocketBase (§25 retención).
 * @property {string|null} [deadline]
 * @property {string|null} [answersOpenAt]
 * @property {number|null} [readSecs]
 * @property {'all'|'firstN'|'time'|null} [endPolicy]
 * @property {number|null} [endN]
 * @property {string|null} [startedAt]
 * @property {PalabraLocal} [ql]
 */

/**
 * «Pedir la palabra», FUERA del blob (§22): es lo único que un alumno escribe.
 * @typedef {Object} PalabraLocal
 * @property {number|null} [open]      Índice de la caja abierta.
 * @property {string|null} [question]
 * @property {string|null} [image]
 * @property {string|null} [by]
 * @property {string|null} [byName]
 */

/**
 * EL ALMACÉN COMPARTIDO entre pestañas. `localStorage` lo cumple entero; los
 * tests inyectan un doble con solo lo que usan, así que lo que no es
 * imprescindible se declara opcional y se pregunta antes de usarlo.
 * @typedef {Object} AlmacenSalas
 * @property {(k: string) => string|null} getItem
 * @property {(k: string, v: string) => void} setItem
 * @property {(k: string) => void} [removeItem]
 * @property {number} [length]
 * @property {(i: number) => string|null} [key]
 */

/**
 * EL CANAL entre pestañas. `BroadcastChannel` lo cumple; los tests inyectan un
 * concentrador de mentira con la misma superficie.
 * @typedef {Object} CanalSalas
 * @property {(msg: unknown) => void} [postMessage]
 * @property {(t: string, fn: (ev: {data?: unknown}) => void) => void} [addEventListener]
 * @property {(t: string, fn: (ev: {data?: unknown}) => void) => void} [removeEventListener]
 */

const PREFIX = 'ww.live.';

/** @returns {AlmacenSalas|null} */
function defaultKV() { try { return globalThis.localStorage || null; } catch { return null; } }
/** @param {string} name @returns {CanalSalas|null} */
function defaultMakeChannel(name) { try { return new BroadcastChannel(name); } catch { return null; } }
function genUserId() { return rid('u_'); }

/** La sala que venga del almacén: sin blob `state` no es una sala.
 *  @param {unknown} x @returns {SalaLocal|null} */
function salaLocal(x) {
  return esFila(x) && esFila(x.state) ? /** @type {SalaLocal} */ (x) : null;
}

/** La tabla virtual que anuncia un mensaje de canal; null si no es de las nuestras
 *  (un mensaje ajeno no debe disparar un re-fetch).
 *  @param {unknown} x @returns {RoomChange['table']|null} */
function tablaDe(x) {
  return x === 'sessions' || x === 'players' || x === 'answers' ? x : null;
}

/**
 * @param {{kv?: AlmacenSalas|null, makeChannel?: (name: string) => CanalSalas|null, userId?: string}} [opts]
 * @returns {RealtimePort}
 */
export function createLocalRealtime({ kv = defaultKV(), makeChannel = defaultMakeChannel, userId = genUserId() } = {}) {
  /** @type {Map<string, SalaLocal>} */
  const mem = new Map();
  /** @param {string} code @returns {SalaLocal|null} */
  const read = (code) => {
    const k = PREFIX + code;
    if (kv) { try { return salaLocal(JSON.parse(kv.getItem(k) || 'null')); } catch { return null; } }
    return salaLocal(mem.get(k));
  };
  /** @param {string} code @param {SalaLocal} room */
  const write = (code, room) => { const k = PREFIX + code; if (kv) kv.setItem(k, JSON.stringify(room)); else mem.set(k, room); };

  /** @type {Map<string, CanalSalas|null>} */
  const channels = new Map();
  /** @type {Map<string, Set<(change: RoomChange) => void>>} */
  const subs = new Map(); // code -> Set<onChange>  (this tab's own subscribers)
  /** @param {string} code @returns {CanalSalas|null} */
  const chan = (code) => { let c = channels.get(code); if (!c) { c = makeChannel(PREFIX + code); channels.set(code, c); } return c; };
  // Notify other tabs (channel) AND this tab's own subscribers — Supabase echoes
  // postgres_changes to every client including the one that made the change, so
  // the host UI relies on seeing its own actions reflected.
  /** @param {string} code @param {RoomChange['table']} table */
  const notify = (code, table) => {
    chan(code)?.postMessage?.({ table });
    for (const fn of subs.get(code) || []) fn({ table, eventType: '*' });
  };

  // Load shared room → rebuild engine over its state → mutate → persist.
  /** @param {string} code @returns {{room: SalaLocal, engine: LiveEngine}} */
  function load(code) {
    const room = read(code);
    if (!room) throw new Error('Sala no encontrada');
    return { room, engine: /** @type {LiveEngine} */ (createLiveRoom(room.activity, { state: paraHidratar(room.state), code })) };
  }
  /** @param {string} code @param {SalaLocal} room @param {LiveEngine} engine */
  function save(code, room, engine) { room.state = blobDeSala(engine); write(code, room); }

  return {
    // Driver de mismo dispositivo (localStorage + BroadcastChannel). La vista lo
    // usa para avisar que la sala NO funciona entre dispositivos/redes.
    kind: 'local',

    async createRoom(activity) {
      // Collect currently-active codes (localStorage keys under our prefix) so
      // pickWord can avoid handing out a word that's already in use.
      /** @type {Set<string>} */
      let usedCodes = new Set();
      try {
        if (kv) {
          for (let i = 0; i < (kv.length ?? 0); i++) {
            const k = kv.key?.(i);
            if (k?.startsWith(PREFIX)) usedCodes.add(k.slice(PREFIX.length));
          }
        } else {
          usedCodes = new Set([...mem.keys()].map(k => k.slice(PREFIX.length)));
        }
      } catch { /* ignore — worst case two rooms share a word (recycling) */ }
      const code = pickWord(usedCodes);
      const engine = /** @type {LiveEngine} */ (createLiveRoom(activity, { code }));
      // `created`: espejo del campo autodate de PocketBase. Sin él, la retención
      // (§25) no tendría por dónde decidir qué sala es vieja en modo local.
      write(code, { activity, state: blobDeSala(engine), created: new Date(clock.now()).toISOString() });
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
      const s = blobDeSala(engine);
      if (patch.status) s.status = patch.status;
      if (patch.phase) s.phase = patch.phase;
      // Espejo del driver PB: sello de apertura del ítem (en carrera, uno solo,
      // clave 'race'). Aquí no hay autodate, así que el `ms` sigue siendo el
      // afirmado (fallback honesto de core/serverMs.js); el sello vale porque
      // DECLARA que la partida fue una carrera — el podio lee eso para mostrar
      // la hora de meta cuando la sala ya está 'ended'.
      if (patch.phase === 'question' || patch.phase === 'race') {
        const idx = ('current_item' in patch) ? Number(patch.current_item) : s.currentItem;
        ((s.itemOpenedAt ||= {}))[openedKey(patch.phase, idx)] ??= new Date(clock.now()).toISOString();
      }
      if (patch.current_item !== undefined) s.currentItem = patch.current_item;
      if ('deadline' in patch) room.deadline = patch.deadline ?? null;
      // R-1 · espejo del driver PB: el instante de apertura de respuestas.
      if ('answers_open_at' in patch) room.answersOpenAt = patch.answers_open_at ?? null;
      if ('read_secs' in patch) room.readSecs = patch.read_secs ?? null;
      // Espejo: la política de fin de carrera/tablero (core/liveEnd.js).
      if ('loop' in patch) s.loop = patch.loop ?? null;   // el BUCLE de la sala (§26)
      if ('end_policy' in patch) room.endPolicy = patch.end_policy ?? null;
      if ('end_n' in patch) room.endN = patch.end_n ?? null;
      if ('started_at' in patch) room.startedAt = patch.started_at ?? null;
      if ('ql_points' in patch) s.qlPoints = patch.ql_points ?? {};
      if ('ql_taken' in patch) s.qlTaken = patch.ql_taken ?? {};   // CL-1: quién se llevó cada caja
      // Espejo del driver PB: el "pedir la palabra" vive en room.ql, fuera del
      // blob de estado (ley de confianza §22).
      const ql = () => (room.ql ||= {});
      if ('ql_open' in patch) ql().open = patch.ql_open ?? null;
      if ('ql_question' in patch) ql().question = patch.ql_question ?? null;
      if ('ql_image' in patch) ql().image = patch.ql_image ?? null;
      if ('ql_by' in patch) ql().by = patch.ql_by ?? null;
      if ('ql_by_name' in patch) ql().byName = patch.ql_by_name ?? null;
      if (patch.ql_award) {
        const { playerId, points } = patch.ql_award;
        const p = (s.players || []).find(pl => pl.id === playerId);
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
      const a = engine.state.answers[`${Number(itemIndex)}:${playerId}`];
      if (a && !a.created) { a.created = a.updated = new Date(clock.now()).toISOString(); }
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
        // Espejo de los autodate de PocketBase: sin ellos el driver local no
        // puede derivar la HORA DE META (§22-1) y caería al `ms` del cliente,
        // que en carrera es el tiempo EN ESA PREGUNTA. `created` = primer
        // intento; `updated` = este write (el acierto, que es lo que cuenta).
        const nowIso = new Date(clock.now()).toISOString();
        engine.state.answers[key] = { playerId, value, msTaken: msTaken ?? 0, correct: null, points: 0, hint: !!correct, v0, c0,
                                      created: prev?.created || nowIso, updated: nowIso };
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
          // Paridad con el adaptador PB: reanudar recupera la HORA DE META. Decía
          // `v.ms`, un campo que la respuesta del motor NUNCA tuvo (se llama
          // `msTaken`), así que tras un F5 la meta volvía indefinida.
          ms: v.msTaken,
        }));
    },

    async kickPlayer(code, playerId) {
      const { room, engine } = load(code);
      engine.state.players = engine.state.players.filter((p) => p.id !== playerId);
      save(code, room, engine); notify(code, 'players');
    },

    // §25 CAPACIDAD — espejo de la retención del driver PocketBase. En local
    // una sala ES su clave de localStorage (con sus respuestas y jugadores
    // dentro del blob), así que purgar la sala se lleva todo lo suyo.
    async purgeOldLive(cutoffIso, { dryRun = true } = {}) {
      /** @type {PurgeReport} */
      const out = { cutoff: cutoffIso, dryRun, sessions: 0, answers: 0, players: 0, claims: 0, errors: [] };
      /** @type {string[]} */
      const codes = [];
      try {
        if (kv) { for (let i = 0; i < (kv.length ?? 0); i++) { const k = kv.key?.(i); if (k?.startsWith(PREFIX)) codes.push(k.slice(PREFIX.length)); } }
        else for (const k of mem.keys()) codes.push(k.slice(PREFIX.length));
      } catch (e) { out.errors.push(mensajeDe(e)); return out; }
      for (const code of codes) {
        const room = read(code);
        // Sin fecha NO se purga (§24: ante la duda, se conserva).
        if (!room?.created || String(room.created) >= String(cutoffIso)) continue;
        out.sessions++;
        out.answers += Object.keys(room.state?.answers || {}).length;
        out.players += (room.state?.players || []).length;
        if (!dryRun) {
          try {
            if (!kv) mem.delete(PREFIX + code);
            else if (kv.removeItem) kv.removeItem(PREFIX + code);
            else throw new Error('el almacén no sabe borrar');   // R6: no en silencio
          } catch (e) { out.errors.push(`${code}: ${mensajeDe(e)}`); }
        }
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
        loop: r.state?.loop ?? null,
        answers_open_at: r.answersOpenAt ?? null,
        read_secs: r.readSecs ?? null,
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
        ql_taken: r.state.qlTaken ?? {},
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
    async listSessions({ limit = 500 } = {}) {
      /** @type {import('../../kernel/contracts/session.js').RoomRecord[]} */
      const out = [];
      const keys = kv ? Object.keys(kv).filter(k => k.startsWith(PREFIX)) : [...mem.keys()];
      for (const k of keys) {
        const code = k.slice(PREFIX.length);
        const room = read(code);
        if (room) out.push({ id: code, code, activity: room.activity, state: room.state });
      }
      return out.slice(0, Number(limit) || 500);
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
      /** @param {{data?: unknown}} ev */
      const h = (ev) => { const t = tablaDe(fila(ev?.data).table); if (t) onChange({ table: t, eventType: '*' }); };
      c?.addEventListener?.('message', h);
      return () => { set.delete(onChange); c?.removeEventListener?.('message', h); };
    },
  };
}

export default createLocalRealtime;
