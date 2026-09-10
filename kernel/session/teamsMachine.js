// ───────────────────────────── TEAMS ────────────────────────────
// teams  One screen, no 1:1 devices (Baamboozle/Factile-style): fixed teams
//        take TURNS on a shared question flow. Scored automatically
//        (scoreSubmission) OR by a TEACHER JUDGE — the host marks ✓/✗ — so ANY
//        content plays in teams, even templates without a machine scorer.
//
// Shared-screen, turn-based classroom play. One team answers per item; the turn
// rotates each time the host advances. Scoring is `auto` (machine scorer) or
// `judge` (the teacher marks the active team's answer right/wrong) — judge mode
// lets ANY content be played in teams, which is the whole point for a classroom.
//
// v1.51.630: extraído de kernel/session/engine.js al partir el motor POR
// MÁQUINA (docs/leyes.md §0, deuda condicionada de CLAUDE.md).
import { planTransition, PHASES, FASE_NO_ACEPTA_RESPUESTAS } from '../../core/livePhases.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { canAutoScoreRound } from '../../core/templateCapability.js';
import { basePoints } from '../../core/scoring/index.js';
import { sessionItems } from '../content/sessionItems.js';
import { autoScore, roundPayloadOf } from './score.js';
import { FORMATS } from './formats.js';
import { seedTeams as seedTeamsShared } from './teamsSeed.js';

/**
 * @typedef {import('../contracts/activity.js').Activity} Activity
 * @typedef {import('./score.js').PlantillaRegistrada} PlantillaRegistrada
 * @typedef {import('../contracts/session.js').HostAction} HostAction
 * @typedef {import('../contracts/session.js').LivePhase} LivePhase
 * @typedef {import('../contracts/session.js').RoomPatch} RoomPatch
 * @typedef {import('../contracts/session.js').RoomStatus} RoomStatus
 * @typedef {import('../contracts/session.js').SessionFormat} SessionFormat
 * @typedef {import('./score.js').ScoringTemplate} ScoringTemplate
 * @typedef {import('./teamsSeed.js').Team} Team
 * @typedef {import('./teamsSeed.js').TeamMember} TeamMember
 */

/**
 * El equipo de ESTA máquina: siempre con roster (se siembra con
 * `withMembers: true`), porque en Equipos en vivo se pueden unir móviles.
 * @typedef {Team & { members: TeamMember[] }} RosterTeam
 */

/**
 * LA RESPUESTA de un equipo a un ítem. `correct: null` = registrada y sin
 * liquidar (o sin clave); los puntos los pone `settle` o el juez.
 * @typedef {Object} TeamAnswer
 * @property {string} teamId
 * @property {unknown} value
 * @property {number} [msTaken]
 * @property {boolean|null} correct
 * @property {number} points
 */

/**
 * EL ESTADO DE LA PARTIDA POR EQUIPOS. `phase`/`status` son las uniones
 * literales: una fase fuera del catálogo no compila.
 * @typedef {Object} TeamsState
 * @property {SessionFormat} [format]
 * @property {string} [code]
 * @property {'auto'|'judge'} scoring
 * @property {RoomStatus} status
 * @property {LivePhase} phase
 * @property {number} currentItem
 * @property {number} turn            Índice en `teams[]`: de quién es el turno.
 * @property {RosterTeam[]} teams
 * @property {Record<string, TeamAnswer>} answers   Clave `${itemIndex}:${teamId}`.
 * @property {number} _seq
 */

/**
 * @typedef {Object} TeamsOpts
 * @property {Partial<TeamsState>} [state]
 * @property {string} [code]
 * @property {string[]|number} [teams]
 * @property {'auto'|'judge'} [scoring]
 */

/**
 * @param {Activity} activity
 * @param {PlantillaRegistrada} T
 * @param {TeamsOpts} opts
 */
function createTeamsSession(activity, T, opts) {
  const items = sessionItems(activity);
  // Cada equipo debe responder la MISMA cantidad de preguntas. Como los turnos
  // alternan (t1, t2, t1, …), un total IMPAR haría que el primer equipo responda
  // de más. Recortamos el total a un múltiplo del nº de equipos (con 2 equipos →
  // siempre PAR). Si hay menos ítems que equipos, se juega con lo que haya.
  const teamCount = Array.isArray(opts.teams) ? opts.teams.length
    : (typeof opts.teams === 'number' ? opts.teams
      : (opts.state?.teams?.length || 2));
  const total = (teamCount > 0 && items.length >= teamCount)
    ? items.length - (items.length % teamCount)
    : items.length;
  // MISMO criterio que core/modes.js y views/teamsView.js (core/templateCapability.js):
  // hace falta scoreSubmission Y renderRound — sin renderRound la ronda "auto" no
  // se puede PINTAR (ver teamsView.js roundBody/wire), aunque haya scorer.
  // El predicado pide `Plantilla` (core/templateCapability.js), que es la MISMA
  // plantilla descrita con otro typedef que el del registro: mira `typeof` sobre
  // dos métodos y nada más.
  const canAuto = canAutoScoreRound(/** @type {import('../../core/templateCapability.js').Plantilla} */ (T));
  // Default to auto when possible; fall back to teacher judge otherwise.
  const scoring = opts.scoring || (canAuto ? 'auto' : 'judge');
  if (scoring === 'auto' && !canAuto) {
    throw new Error('La plantilla no tiene scoreSubmission: usa scoring "judge"');
  }

  const seedTeams = () => /** @type {RosterTeam[]} */ (seedTeamsShared(opts, { withMembers: true }));

  const state = /** @type {TeamsState} */ (opts.state ? { answers: {}, _seq: 0, ...opts.state } : {
    format: FORMATS.TEAMS,
    code: opts.code || 'TEAM1',
    scoring,
    status: 'lobby',
    phase: PHASES.IDLE,
    currentItem: -1,
    turn: 0,              // index into teams[] — whose turn it is
    teams: seedTeams(),
    answers: {},          // `${itemIndex}:${teamId}` → { teamId, value, msTaken, correct, points }
    _seq: 0,
  });

  const session = () => ({ phase: state.phase, current_item: state.currentItem, status: state.status });
  const activeTeam = () => state.teams[state.turn] || null;
  /** @param {string} [id] */
  const teamById = (id) => state.teams.find(t => t.id === id) || null;

  // Optional roster — a player can be attached to a team for display only.
  /**
   * @param {string} userId
   * @param {string} nickname
   * @param {string} [teamId]
   */
  function join(userId, nickname, teamId) {
    const team = teamById(teamId) || activeTeam();
    if (!team) throw new Error('Equipo desconocido');
    // El interruptor del panel MANDA. Estaba escrito por el editor («Filtro de
    // apodos») y no lo leía nadie: se rechazaba siempre, así que apagarlo no
    // hacía nada. Ojo: lo que el interruptor decide es si se RECHAZA, no si se
    // normaliza — `f.value` (el apodo limpio, recortado) se sigue usando abajo,
    // y saltárselo dejaba entrar nombres sin normalizar.
    const f = isAcceptableNickname(nickname);
    if (!f.ok && activity?.live?.nicknameFilter !== false) throw new Error('Apodo: ' + f.reason);
    // Igual que en la sala en vivo: con el filtro APAGADO entra un apodo que el
    // filtro rechaza, y ahí `f.value` no existe — se normaliza aquí (recortado)
    // en vez de dejar al miembro con `name: undefined` en el roster.
    const member = { id: 'p' + (++state._seq), userId, name: f.ok ? f.value : String(nickname ?? '').trim() };
    team.members.push(member);
    return { ...member, teamId: team.id };
  }

  /** @param {HostAction} action */
  function dispatch(action) {
    const plan = planTransition(session(), action, total);
    if (plan.type === 'invalid') throw new Error(plan.reason);
    if (plan.type === 'end') { state.status = 'ended'; state.phase = PHASES.ENDED; return plan; }
    if (plan.type === 'settle') {
      // In judge mode the teacher has already awarded; reveal just flips phase.
      if (state.scoring === 'auto') settle(plan.itemIndex);
      else state.phase = PHASES.REVEAL;
      return plan;
    }
    const pa = /** @type {RoomPatch} */ (plan.patch);
    if (pa.status) state.status = pa.status;
    if (pa.phase) state.phase = pa.phase;
    if (pa.current_item !== undefined) state.currentItem = pa.current_item;
    // Advancing to the next item hands the turn to the next team.
    if (action === 'next') state.turn = (state.turn + 1) % state.teams.length;
    return plan;
  }

  // The team whose turn it is records one answer for the current item.
  /**
   * @param {string} teamId
   * @param {number} itemIndex
   * @param {unknown} value
   * @param {number} [msTaken]
   */
  function submit(teamId, itemIndex, value, msTaken = 0) {
    if (state.phase !== PHASES.QUESTION || itemIndex !== state.currentItem) {
      throw new Error(FASE_NO_ACEPTA_RESPUESTAS);
    }
    if (teamId !== activeTeam()?.id) throw new Error('No es el turno de ese equipo');
    state.answers[`${itemIndex}:${teamId}`] = { teamId, value, msTaken, correct: null, points: 0 };
  }

  // Auto-scoring path: score the active team's submission for this item.
  /** @param {number} itemIndex */
  function settle(itemIndex) {
    const item = items[itemIndex];
    const team = activeTeam();
    const ans = team && state.answers[`${itemIndex}:${team.id}`];
    // Guard `item`: an out-of-range index must not throw in scoreSubmission. We
    // still fall through to set REVEAL so the round never gets stuck.
    if (ans && ans.correct === null && item) {
      // Aquí solo se llega en `scoring: 'auto'` (lo despacha `dispatch`), y ese
      // modo lo garantiza el constructor: sin `canAutoScoreRound(T)` lanza.
      const scorer = /** @type {ScoringTemplate} */ (T);
      const r = autoScore(scorer, { value: ans.value, item, msTaken: ans.msTaken, activity, mode: 'teams' });
      ans.correct = r.correct;
      ans.points = r.points;
      team.score += r.points;
    }
    state.phase = PHASES.REVEAL;
    return ans ? 1 : 0;
  }

  // Teacher-judge path: the host rules on the active team's answer. Idempotent
  // per item (re-judging replaces the previous award).
  /** @param {{correct?: boolean, points?: number}} [ruling] */
  function judge({ correct, points } = {}) {
    if (state.scoring !== 'judge') throw new Error('judge() solo en scoring "judge"');
    const team = activeTeam();
    if (!team) throw new Error('No hay equipo activo');
    const item = items[state.currentItem];
    // Puntos del juez por la FÓRMULA común (C5): item.points, si no el
    // pointsPerCorrect de la actividad, si no 1. Antes era `item.points || 1`,
    // que ignoraba la configuración de puntos — la única fuga en el kernel.
    const pts = Number.isFinite(points) ? Number(points) : (correct ? basePoints(item, activity?.scoring) : 0);
    const key = `${state.currentItem}:${team.id}`;
    const prev = state.answers[key];
    if (prev) team.score -= (prev.points || 0); // undo a previous ruling
    state.answers[key] = { teamId: team.id, value: prev?.value ?? null, correct: !!correct, points: pts };
    team.score += pts;
    return { teamId: team.id, correct: !!correct, points: pts };
  }

  // Raw point grant (e.g. buzzer bonus / steal) to any team.
  /** @param {string} teamId @param {number} delta */
  function award(teamId, delta) {
    const team = teamById(teamId);
    if (!team) throw new Error('Equipo desconocido');
    // A non-numeric delta (a UI bug calling award('t1') with no value) would set
    // the score to NaN and poison sorting for the rest of the match.
    const d = Number(delta);
    if (!Number.isFinite(d)) throw new Error('Puntos inválidos');
    team.score += d;
    return team.score;
  }

  // MISMO contrato que VS (`found`): las palabras/valores ya respondidos en
  // turnos ANTERIORES viajan en el payload, para que una ronda de tablero libre
  // (la Sopa) las pre-marque y no deje re-encontrar la misma palabra cada turno.
  /** @param {number} [itemIndex] */
  const roundPayload = (itemIndex = state.currentItem) =>
    roundPayloadOf(T, activity, itemIndex, null,
      { found: Object.values(state.answers).map(a => a?.value).filter(Boolean) });

  const leaderboard = () =>
    [...state.teams].sort((a, b) => b.score - a.score)
      .map((t, i) => ({ rank: i + 1, name: t.name, score: t.score, id: t.id }));

  return {
    state, join, dispatch, submit, settle, judge, award, roundPayload, leaderboard,
    activeTeam,
    get phase() { return state.phase; },
    get currentItem() { return state.currentItem; },
    get turn() { return state.turn; },
    get totalItems() { return total; },
  };
}

export { createTeamsSession };
