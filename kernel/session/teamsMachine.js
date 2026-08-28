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
import { planTransition, PHASES } from '../../core/livePhases.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { canAutoScoreRound } from '../../core/templateCapability.js';
import { basePoints } from '../../core/scoring/index.js';
import { sessionItems } from '../content/sessionItems.js';
import { autoScore, roundPayloadOf } from './score.js';
import { FORMATS } from './formats.js';

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
  const canAuto = canAutoScoreRound(T);
  // Default to auto when possible; fall back to teacher judge otherwise.
  const scoring = opts.scoring || (canAuto ? 'auto' : 'judge');
  if (scoring === 'auto' && !canAuto) {
    throw new Error('La plantilla no tiene scoreSubmission: usa scoring "judge"');
  }

  const seedTeams = () => {
    const names = Array.isArray(opts.teams) ? opts.teams
      : (typeof opts.teams === 'number' ? Array.from({ length: opts.teams }, (_, i) => `Equipo ${i + 1}`)
        : ['Equipo 1', 'Equipo 2']);
    return names.map((name, i) => ({ id: 't' + (i + 1), name, score: 0, members: [] }));
  };

  const state = opts.state ? { answers: {}, _seq: 0, ...opts.state } : {
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
  };

  const session = () => ({ phase: state.phase, current_item: state.currentItem, status: state.status });
  const activeTeam = () => state.teams[state.turn] || null;
  const teamById = (id) => state.teams.find(t => t.id === id) || null;

  // Optional roster — a player can be attached to a team for display only.
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
    const member = { id: 'p' + (++state._seq), userId, name: f.value };
    team.members.push(member);
    return { ...member, teamId: team.id };
  }

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
    const pa = plan.patch;
    if (pa.status) state.status = pa.status;
    if (pa.phase) state.phase = pa.phase;
    if ('current_item' in pa) state.currentItem = pa.current_item;
    // Advancing to the next item hands the turn to the next team.
    if (action === 'next') state.turn = (state.turn + 1) % state.teams.length;
    return plan;
  }

  // The team whose turn it is records one answer for the current item.
  function submit(teamId, itemIndex, value, msTaken = 0) {
    if (state.phase !== PHASES.QUESTION || itemIndex !== state.currentItem) {
      throw new Error('No se aceptan respuestas en esta fase');
    }
    if (teamId !== activeTeam()?.id) throw new Error('No es el turno de ese equipo');
    state.answers[`${itemIndex}:${teamId}`] = { teamId, value, msTaken, correct: null, points: 0 };
  }

  // Auto-scoring path: score the active team's submission for this item.
  function settle(itemIndex) {
    const item = items[itemIndex];
    const team = activeTeam();
    const ans = team && state.answers[`${itemIndex}:${team.id}`];
    // Guard `item`: an out-of-range index must not throw in scoreSubmission. We
    // still fall through to set REVEAL so the round never gets stuck.
    if (ans && ans.correct === null && item) {
      const r = autoScore(T, { value: ans.value, item, msTaken: ans.msTaken, activity, mode: 'teams' });
      ans.correct = r.correct;
      ans.points = r.points;
      team.score += r.points;
    }
    state.phase = PHASES.REVEAL;
    return ans ? 1 : 0;
  }

  // Teacher-judge path: the host rules on the active team's answer. Idempotent
  // per item (re-judging replaces the previous award).
  function judge({ correct, points } = {}) {
    if (state.scoring !== 'judge') throw new Error('judge() solo en scoring "judge"');
    const team = activeTeam();
    if (!team) throw new Error('No hay equipo activo');
    const item = items[state.currentItem];
    // Puntos del juez por la FÓRMULA común (C5): item.points, si no el
    // pointsPerCorrect de la actividad, si no 1. Antes era `item.points || 1`,
    // que ignoraba la configuración de puntos — la única fuga en el kernel.
    const pts = Number.isFinite(points) ? points : (correct ? basePoints(item, activity?.scoring) : 0);
    const key = `${state.currentItem}:${team.id}`;
    const prev = state.answers[key];
    if (prev) team.score -= (prev.points || 0); // undo a previous ruling
    state.answers[key] = { teamId: team.id, value: prev?.value ?? null, correct: !!correct, points: pts };
    team.score += pts;
    return { teamId: team.id, correct: !!correct, points: pts };
  }

  // Raw point grant (e.g. buzzer bonus / steal) to any team.
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
