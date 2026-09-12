// ───────────────────────────── LIVE ─────────────────────────────
// live   sala con anfitrión, al estilo de un concurso: many players, a synchronized
//        question→reveal→leaderboard flow, anti-cheat scoring at settle()
//        (never when a client submits). Byte-for-byte the old createLiveRoom.
//
// v1.51.630: extraído de kernel/session/engine.js al partir el motor POR
// MÁQUINA (docs/leyes.md §0, deuda condicionada de CLAUDE.md). Sigue fiel al
// motor original para que el driver local, los tests de Node y el espejo de
// la Edge Function (retirada) sigan funcionando sin cambios; createLiveRoom
// delega aquí vía kernel/live/engine.js → kernel/session/engine.js (fachada).
import { planTransition, PHASES, FASE_NO_ACEPTA_RESPUESTAS } from '../../core/livePhases.js';
import { apodoLimpio } from '../../core/nicknameFilter.js';
import { rankPlayers } from '../../core/liveRank.js';
import { pointsModeFor } from '../../core/liveLoops.js';
import { sessionItems } from '../content/sessionItems.js';
import { autoScore, roundPayloadOf } from './score.js';
import { aplicarPlan } from './plan.js';
import { FORMATS } from './formats.js';

/**
 * @typedef {import('../contracts/activity.js').Activity} Activity
 * @typedef {import('../contracts/session.js').EngineAnswer} EngineAnswer
 * @typedef {import('../contracts/session.js').HostAction} HostAction
 * @typedef {import('../contracts/session.js').LiveLoop} LiveLoop
 * @typedef {import('../contracts/session.js').LivePhase} LivePhase
 * @typedef {import('../contracts/session.js').RoomStatus} RoomStatus
 * @typedef {import('../contracts/session.js').SessionFormat} SessionFormat
 * @typedef {import('./score.js').ScoringTemplate} ScoringTemplate
 */

/**
 * Un jugador de la sala VISTO POR ESTA MÁQUINA: aquí `score` no es opcional
 * (nace en 0 y lo acumula `settle`), a diferencia del `Player` del contrato,
 * que también describe al jugador de una fila heredada sin puntaje.
 * @typedef {Object} LivePlayer
 * @property {string} id
 * @property {string} [userId]
 * @property {string} name
 * @property {number} score
 */

/**
 * EL ESTADO DE LA SALA — el mismo blob que se persiste (`RoomState`), pero con
 * lo que esta máquina garantiza SIEMPRE: fase, estado, cursor, jugadores y
 * respuestas. `phase` y `status` son las uniones literales, así que una fase
 * que no esté en el catálogo (§26) no compila.
 * @typedef {Object} LiveState
 * @property {SessionFormat} [format]
 * @property {string} [code]
 * @property {RoomStatus} status
 * @property {LivePhase} phase
 * @property {number} currentItem
 * @property {LivePlayer[]} players
 * @property {Record<string, EngineAnswer>} answers   Clave `${itemIndex}:${playerId}`.
 * @property {LiveLoop|null} [loop]
 * @property {number} _seq
 */

/**
 * @typedef {Object} LiveOpts
 * @property {Partial<LiveState>} [state]   Blob de la fila: hidrata la sala.
 * @property {string} [code]
 */

/**
 * @param {Activity} activity
 * @param {ScoringTemplate} T
 * @param {LiveOpts} opts
 */
function createLiveSession(activity, T, opts) {
  const items = sessionItems(activity);
  const total = items.length;
  const maxPlayers = activity?.live?.maxPlayers || 60;
  const allowLateJoin = activity?.live?.allowLateJoin !== false;

  const state = /** @type {LiveState} */ (opts.state ? { players: [], answers: {}, _seq: 0, ...opts.state } : {
    format: FORMATS.LIVE,
    code: opts.code || 'LOCAL1',
    status: 'lobby',
    phase: PHASES.IDLE,
    currentItem: -1,
    players: [],          // { id, userId, name, score }
    answers: {},          // `${itemIndex}:${playerId}` → { playerId, value, msTaken, correct, points }
    _seq: 0,
  });

  const session = () => ({ phase: state.phase, current_item: state.currentItem, status: state.status });
  /** @param {number} i @param {string} pid */
  const answerKey = (i, pid) => `${i}:${pid}`;

  /**
   * @param {string} userId
   * @param {string} nickname
   * @returns {LivePlayer}
   */
  function join(userId, nickname) {
    const existing = state.players.find(p => p.userId === userId);
    if (existing) return existing; // reconnect — name unchanged
    // Filtro de apodos: la política (rechazar o no, según el interruptor del
    // panel) y la normalización viven en su dueño, `core/nicknameFilter.js`.
    // Se pregunta ANTES que el aforo y la fase, como siempre: el orden de los
    // mensajes de error es lo que ve el alumno.
    const limpio = apodoLimpio(activity, nickname);
    if (state.status === 'ended') throw new Error('La sala ha terminado');
    if (state.status !== 'lobby' && !allowLateJoin) throw new Error('La partida ya empezó');
    if (state.players.length >= maxPlayers) throw new Error('La sala está llena');
    // Apodos únicos (P2-4): dos móviles distintos con "Juan" antes creaban dos
    // jugadores indistinguibles (al expulsar, en la clasificación y en el mapa
    // nombre→respuesta del reveal). Se auto-sufija ("Juan 2") en vez de rechazar.
    const p = { id: 'p' + (++state._seq), userId, name: uniqueNickname(limpio), score: 0 };
    state.players.push(p);
    return p;
  }

  /** @param {string} base @returns {string} */
  function uniqueNickname(base) {
    const taken = new Set(state.players.map(p => (p.name || '').toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; ; n++) {
      const cand = `${base} ${n}`;
      if (!taken.has(cand.toLowerCase())) return cand;
    }
  }

  /** @param {HostAction} action */
  function dispatch(action) {
    const plan = planTransition(session(), action, total);
    // LA RAMA PROPIA de esta máquina: liquidar el ítem (puntúa y revela). Lo
    // común (invalid · end · patch) lo aplica `aplicarPlan`.
    if (plan.type === 'settle') { settle(plan.itemIndex); return plan; }
    aplicarPlan(state, plan);
    return plan;
  }

  /**
   * @param {string} playerId
   * @param {number} itemIndex
   * @param {unknown} value
   * @param {number} [msTaken]
   */
  function submit(playerId, itemIndex, value, msTaken = 0) {
    const isRace = state.phase === 'race';
    if (!isRace && (state.phase !== PHASES.QUESTION || itemIndex !== state.currentItem)) {
      throw new Error(FASE_NO_ACEPTA_RESPUESTAS);
    }
    const key = answerKey(itemIndex, playerId);
    const prev = state.answers[key];
    // Lock the first answer (como en un concurso). In the standard question phase a
    // duplicate submit — double-tap, or a submitQueue retry landing after the
    // original already saved — must NOT overwrite the recorded answer (which
    // would clobber its msTaken and let a slower resend beat the real one).
    //
    // Race mode retries a WRONG answer (requeued), so a re-submit is legitimate —
    // BUT una respuesta YA CORRECTA no se reintenta. Si se dejara pisar (reset a
    // {correct:null}), un settle posterior la re-puntuaría → DOBLE conteo en
    // carrera (deuda B). Por eso el lock cubre también en carrera las respuestas
    // ya CORRECTAS; solo las incorrectas se pueden re-enviar.
    if (prev && (!isRace || prev.correct === true)) return;
    state.answers[key] = { playerId, value, msTaken, correct: null, points: 0 };
  }

  // `keepPhase`: puntúa SIN mover la máquina de estados. Se usa al CERRAR la sala
  // para liquidar respuestas REZAGADAS — las que llegaron después del settle de su
  // pregunta (rescate del trazo al avanzar, reintento de la cola offline, red
  // lenta). Sin esto quedaban `scored:false` → 0 puntos para siempre; y con el
  // settle normal la fase saltaría a 'reveal' encima del podio.
  /**
   * @param {number} itemIndex
   * @param {{keepPhase?: boolean}} [opts]
   * @returns {number} respuestas liquidadas
   */
  function settle(itemIndex, { keepPhase = false } = {}) {
    const item = items[itemIndex];
    // Out-of-range index (e.g. a hydrated/corrupt state, or a race-mode client
    // that recorded an answer under an itemIndex past the end): there's nothing
    // valid to score, so degrade quietly instead of throwing in scoreSubmission.
    if (!item) return 0;
    let settled = 0;
    for (const [key, ans] of Object.entries(state.answers)) {
      if (!key.startsWith(itemIndex + ':')) continue;
      // MODO DE PUNTOS: lo decide el BUCLE que declaró el lobby (§26), no la
      // fase. La fase es transitoria y AMBIGUA: `race` y `board` comparten la
      // fase 'race', y este mismo settle corre con la sala ya en 'ended' (el
      // barrido de cierre) — mirar la fase le daría bonus por velocidad a una carrera.
      // El respaldo por fase es solo para salas abiertas ANTES de que el bucle
      // se guardara. En carrera los puntos son PLANOS: quien acertaba 2 de 5 en
      // los primeros segundos superaba a quien acertaba las 5 (medido: 2997 vs
      // 2500). Ver docs/estudio-bucles-live.md ficha 2b.
      const mode = state.loop ? pointsModeFor(state.loop) : (state.phase === 'race' ? 'race' : 'live');
      const r = autoScore(T, { value: ans.value, item, msTaken: ans.msTaken, activity, mode });
      const wasUnscored = ans.correct === null;
      ans.correct = r.correct;
      ans.points = r.points;
      if (wasUnscored) {
        const p = state.players.find(pl => pl.id === ans.playerId);
        if (p) p.score += ans.points;
      }
      settled++;
    }
    if (!keepPhase && state.phase !== 'race') state.phase = PHASES.REVEAL;
    return settled;
  }

  // Barrido de cierre: liquida TODOS los ítems (settle salta lo ya puntuado, así
  // que es idempotente en puntos). Lo llaman los drivers al cerrar la sala para
  // que ninguna respuesta pendiente quede en 0; devuelve respuestas procesadas.
  /** @param {{keepPhase?: boolean}} [opts] */
  const settleAll = (opts) => {
    let n = 0;
    for (let i = 0; i < total; i++) n += settle(i, opts);
    return n;
  };

  /** @param {number} [itemIndex] */
  const roundPayload = (itemIndex = state.currentItem) =>
    roundPayloadOf(T, activity, itemIndex);

  // Ranking con desempate por HORA DE META (core/liveRank.js): mismos puntos ⇒
  // gana quien llegó ANTES a ellos. El puntaje sale de las respuestas (idéntico
  // a players[].score, que settle() acumula de las mismas filas) para que este
  // ranking y el derivado de PocketBase sean LA MISMA función.
  /** @param {number} [limit] */
  const leaderboard = (limit = 50) => rankPlayers(state.players, Object.values(state.answers), limit);

  return {
    state, join, dispatch, submit, settle, settleAll, roundPayload, leaderboard,
    get phase() { return state.phase; },
    get currentItem() { return state.currentItem; },
    get totalItems() { return total; },
  };
}

export { createLiveSession };
