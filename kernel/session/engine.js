// Backend-agnostic SESSION engine — one pure core that drives every
// multiplayer / classroom format from a single brain, so scoring and flow live
// in ONE place (and stay in parity with the Supabase Edge Functions):
//
//   live   Kahoot-style hosted room: many players, a synchronized
//          question→reveal→leaderboard flow, anti-cheat scoring at settle()
//          (never when a client submits). Byte-for-byte the old createLiveRoom.
//   teams  One screen, no 1:1 devices (Baamboozle/Factile-style): fixed teams
//          take TURNS on a shared question flow. Scored automatically
//          (scoreSubmission) OR by a TEACHER JUDGE — the host marks ✓/✗ — so ANY
//          content plays in teams, even templates without a machine scorer.
//   vs     1-vs-1 duel: two sides race through the SAME item sequence in
//          PARALLEL, each auto-scored on submit; standings() drives the central
//          "who's winning" animation. Needs a scorer and ≥2 items to be fair.
//   solo   Single self-paced participant (thin: a scored cursor over the items).
//
// Pure: no DOM, no network, JSON-serializable state → a whole session can be
// simulated and asserted in Node, and rebuilt from a snapshot (opts.state).
import { planTransition, PHASES } from '../../core/livePhases.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { getTemplate } from '../../core/registry.js';
import { canAutoScoreRound } from '../../core/templateCapability.js';

export const FORMATS = Object.freeze({ SOLO: 'solo', LIVE: 'live', TEAMS: 'teams', VS: 'vs' });

// The ordered list of "rounds" for a session, independent of content model.
// Each model names its list differently (quiz→items, ruleta→entries,
// match/memory→pairs, tildes/comas→passages); a session treats any of them as
// the sequence of rounds. Mirrors core/migrate.js activityItemCount.
export function sessionItems(activity) {
  const c = activity?.content || {};
  return c.items ?? c.entries ?? c.pairs ?? c.groups ?? c.words ?? c.passages ?? [];
}

// Payload de una ronda para el ítem `itemIndex`: lo que la plantilla expone al
// jugador (getRoundPayload, SIN las claves de respuesta), o `fallback` si no lo
// define. ÚNICA copia del `T.getRoundPayload ? … : fallback` que estaba repetido
// en vistas y kernel (una versión con try/catch, otras sin → asimetría: una
// plantilla con getRoundPayload que lanzara caía con gracia en el proyector del
// host pero crasheaba al alumno). El try/catch degrada igual en todos.
export function roundPayloadOf(T, activity, itemIndex, fallback = null) {
  try { return T?.getRoundPayload ? T.getRoundPayload(activity, { itemIndex }) : fallback; }
  catch { return fallback; }
}

/** VS pits two sides head-to-head with no host to judge, so it only works on
 *  templates that can both render a single round (renderRound) and self-score
 *  it (scoreSubmission), with enough items for a real race.
 *  EXCEPCIÓN: las plantillas "de tablero" (meta.liveBoard, p.ej. Ordena las
 *  Pelotas) son UN solo reto compartido — ambos lados resuelven el MISMO tablero
 *  y gana quien termina antes (raceToFinish). Ahí basta con 1 ítem. */
export function isVsCompatible(activity) {
  const T = getTemplate(activity?.template);
  const total = sessionItems(activity).length;
  const minItems = T?.meta?.liveBoard ? 1 : 2;
  return !!(T && typeof T.scoreSubmission === 'function'
            && typeof T.renderRound === 'function' && total >= minItems);
}

/** Single entry point. `opts.format` selects the flow; `opts.state` hydrates. */
export function createSession(activity, opts = {}) {
  const format = opts.format || FORMATS.LIVE;
  const T = getTemplate(activity?.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity?.template}`);
  switch (format) {
    case FORMATS.LIVE:  return createLiveSession(activity, T, opts);
    case FORMATS.TEAMS: return createTeamsSession(activity, T, opts);
    case FORMATS.VS:    return createVsSession(activity, T, opts);
    case FORMATS.SOLO:  return createSoloSession(activity, T, opts);
    default: throw new Error(`Formato de sesión desconocido: ${format}`);
  }
}

// Shared scorer call — identical contract across formats so the brain is one.
function autoScore(T, { value, item, msTaken, activity, mode }) {
  const r = T.scoreSubmission({ value, item, msTaken, activity, mode });
  return { correct: !!r.correct, points: r.points || 0 };
}

// ───────────────────────────── LIVE ─────────────────────────────
// Kept faithful to the original engine so the local driver, the Node tests and
// the Edge-Function mirror keep working unchanged. createLiveRoom delegates here.
function createLiveSession(activity, T, opts) {
  const items = sessionItems(activity);
  const total = items.length;
  const maxPlayers = activity?.live?.maxPlayers || 60;
  const allowLateJoin = activity?.live?.allowLateJoin !== false;

  const state = opts.state ? { players: [], answers: {}, _seq: 0, ...opts.state } : {
    format: FORMATS.LIVE,
    code: opts.code || 'LOCAL1',
    status: 'lobby',
    phase: PHASES.IDLE,
    currentItem: -1,
    players: [],          // { id, userId, name, score }
    answers: {},          // `${itemIndex}:${playerId}` → { playerId, value, msTaken, correct, points }
    _seq: 0,
  };

  const session = () => ({ phase: state.phase, current_item: state.currentItem, status: state.status });
  const answerKey = (i, pid) => `${i}:${pid}`;

  function join(userId, nickname) {
    const existing = state.players.find(p => p.userId === userId);
    if (existing) return existing; // reconnect — name unchanged
    const f = isAcceptableNickname(nickname);
    if (!f.ok) throw new Error('Apodo: ' + f.reason);
    if (state.status === 'ended') throw new Error('La sala ha terminado');
    if (state.status !== 'lobby' && !allowLateJoin) throw new Error('La partida ya empezó');
    if (state.players.length >= maxPlayers) throw new Error('La sala está llena');
    // Apodos únicos (P2-4): dos móviles distintos con "Juan" antes creaban dos
    // jugadores indistinguibles (al expulsar, en la clasificación y en el mapa
    // nombre→respuesta del reveal). Se auto-sufija ("Juan 2") en vez de rechazar.
    const p = { id: 'p' + (++state._seq), userId, name: uniqueNickname(f.value), score: 0 };
    state.players.push(p);
    return p;
  }

  function uniqueNickname(base) {
    const taken = new Set(state.players.map(p => (p.name || '').toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let n = 2; ; n++) {
      const cand = `${base} ${n}`;
      if (!taken.has(cand.toLowerCase())) return cand;
    }
  }

  function dispatch(action) {
    const plan = planTransition(session(), action, total);
    if (plan.type === 'invalid') throw new Error(plan.reason);
    if (plan.type === 'end') { state.status = 'ended'; state.phase = PHASES.ENDED; return plan; }
    if (plan.type === 'settle') { settle(plan.itemIndex); return plan; }
    const pa = plan.patch;
    if (pa.status) state.status = pa.status;
    if (pa.phase) state.phase = pa.phase;
    if ('current_item' in pa) state.currentItem = pa.current_item;
    return plan;
  }

  function submit(playerId, itemIndex, value, msTaken = 0) {
    const isRace = state.phase === 'race';
    if (!isRace && (state.phase !== PHASES.QUESTION || itemIndex !== state.currentItem)) {
      throw new Error('No se aceptan respuestas en esta fase');
    }
    const key = answerKey(itemIndex, playerId);
    const prev = state.answers[key];
    // Lock the first answer (Kahoot-style). In the standard question phase a
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
  function settle(itemIndex, { keepPhase = false } = {}) {
    const item = items[itemIndex];
    // Out-of-range index (e.g. a hydrated/corrupt state, or a race-mode client
    // that recorded an answer under an itemIndex past the end): there's nothing
    // valid to score, so degrade quietly instead of throwing in scoreSubmission.
    if (!item) return 0;
    let settled = 0;
    for (const [key, ans] of Object.entries(state.answers)) {
      if (!key.startsWith(itemIndex + ':')) continue;
      const r = autoScore(T, { value: ans.value, item, msTaken: ans.msTaken, activity, mode: 'live' });
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
  const settleAll = (opts) => {
    let n = 0;
    for (let i = 0; i < total; i++) n += settle(i, opts);
    return n;
  };

  const roundPayload = (itemIndex = state.currentItem) =>
    roundPayloadOf(T, activity, itemIndex);

  const leaderboard = (limit = 50) =>
    [...state.players].sort((a, b) => b.score - a.score).slice(0, limit)
      .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));

  return {
    state, join, dispatch, submit, settle, settleAll, roundPayload, leaderboard,
    get phase() { return state.phase; },
    get currentItem() { return state.currentItem; },
    get totalItems() { return total; },
  };
}

// ───────────────────────────── TEAMS ────────────────────────────
// Shared-screen, turn-based classroom play. One team answers per item; the turn
// rotates each time the host advances. Scoring is `auto` (machine scorer) or
// `judge` (the teacher marks the active team's answer right/wrong) — judge mode
// lets ANY content be played in teams, which is the whole point for a classroom.
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
    const f = isAcceptableNickname(nickname);
    if (!f.ok) throw new Error('Apodo: ' + f.reason);
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
    const pts = Number.isFinite(points) ? points : (correct ? (item?.points || 1) : 0);
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

  const roundPayload = (itemIndex = state.currentItem) =>
    roundPayloadOf(T, activity, itemIndex);

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

// ────────────────────────────── VS ──────────────────────────────
// Two sides race the SAME items in parallel. No host: each answer is auto-scored
// on submit and advances only that side's own cursor. standings() exposes the
// live gap so the UI can animate who's ahead. Each side plays at its own pace; a
// side that finishes stops there (shows its "done" card) while the other plays
// on, and the match ends only once BOTH sides have completed every item.
function createVsSession(activity, T, opts) {
  const items = sessionItems(activity);
  const total = items.length;
  if (!isVsCompatible(activity)) {
    throw new Error('VS requiere una plantilla con scoreSubmission y ≥2 ítems');
  }

  const side = (id, name) => ({ id, name, score: 0, cursor: 0, correct: 0, answers: [] });
  // Modo carrera (opt-in): el duelo termina en cuanto UN lado completa todos los
  // ítems (gana quien acaba primero). Por defecto sigue el modo "puntos": termina
  // cuando AMBOS lados acaban y gana quien sumó más. La vista VS activa carrera.
  const raceToFinish = !!opts.raceToFinish;
  const state = opts.state ? { ...opts.state } : {
    format: FORMATS.VS,
    code: opts.code || 'VS1',
    status: 'lobby',
    finishedBy: null,
    sides: {
      left: side('left', opts.left || 'Alumno 1'),
      right: side('right', opts.right || 'Alumno 2'),
    },
  };

  const getSide = (id) => state.sides[id] || null;

  function start() {
    if (state.status === 'ended') throw new Error('El duelo ya terminó');
    state.status = 'running';
    return state;
  }

  // Submit one answer for a side. Scored immediately; advances that side only.
  function answer(sideId, value, msTaken = 0) {
    if (state.status !== 'running') throw new Error('El duelo no está en curso');
    const s = getSide(sideId);
    if (!s) throw new Error('Lado desconocido');
    if (s.cursor >= total) throw new Error('Ese lado ya terminó');
    const item = items[s.cursor];
    const r = autoScore(T, { value, item, msTaken, activity, mode: 'vs' });
    s.answers.push({ index: s.cursor, value, msTaken, correct: r.correct, points: r.points });
    s.score += r.points;
    if (r.correct) s.correct += 1;
    s.cursor += 1;
    // Record the FIRST side to complete all items. In points mode this breaks a
    // score tie: Operaciones (math) with unlimited retries advances only on a
    // correct answer, so BOTH sides finish at 100% — a draw on points. The
    // faster finisher should win, not show "empate".
    if (s.cursor >= total && !state.finishedBy) state.finishedBy = sideId;
    if (raceToFinish) {
      // Carrera: el primero que completa todos los ítems gana y cierra el duelo.
      if (s.cursor >= total) state.status = 'ended';
    } else if (state.sides.left.cursor >= total && state.sides.right.cursor >= total) {
      // Puntos: cada lado va a su ritmo; termina cuando AMBOS acaban.
      state.status = 'ended';
    }
    return { correct: r.correct, points: r.points, cursor: s.cursor, done: s.cursor >= total };
  }

  // The central "who's winning" snapshot — score gap plus progress, with a
  // tie-break on items completed so an early lead still reads as "ahead".
  function standings() {
    const L = state.sides.left, R = state.sides.right;
    const diff = L.score - R.score;
    let leader = 'tie';
    if (diff > 0) leader = 'left';
    else if (diff < 0) leader = 'right';
    return {
      left: { name: L.name, score: L.score, cursor: L.cursor, correct: L.correct, done: L.cursor >= total },
      right: { name: R.name, score: R.score, cursor: R.cursor, correct: R.correct, done: R.cursor >= total },
      leader, diff: Math.abs(diff), total, finished: state.status === 'ended',
      finishedBy: state.finishedBy || null,
    };
  }

  const roundPayloadFor = (sideId) => {
    const s = getSide(sideId);
    if (!s || s.cursor >= total) return null;
    // Pass the side id (so templates can build a DIFFERENT board per side, e.g.
    // word search) and the values already answered (so a free-find board can
    // mark what's done across re-renders). Other templates ignore the extra ctx.
    return T.getRoundPayload
      ? T.getRoundPayload(activity, { itemIndex: s.cursor, side: sideId, found: s.answers.map(a => a.value).filter(Boolean) })
      : null;
  };

  return {
    state, start, answer, standings, roundPayloadFor,
    get status() { return state.status; },
    get totalItems() { return total; },
  };
}

// ───────────────────────────── SOLO ─────────────────────────────
// Thin single-participant tracker: a scored cursor over the items. Useful as a
// uniform wrapper for Solo/Tarea attempts on top of the per-template player.
function createSoloSession(activity, T, opts) {
  const items = sessionItems(activity);
  const total = items.length;
  const canAuto = typeof T.scoreSubmission === 'function';

  const state = opts.state ? { ...opts.state } : {
    format: FORMATS.SOLO,
    // A 0-item activity is done before it starts: answer() can never run, so
    // without this the status would stay 'running' forever (result().done=true).
    status: total ? 'running' : 'ended',
    score: 0, cursor: 0, correct: 0, answers: [],
  };

  function answer(value, msTaken = 0) {
    if (state.cursor >= total) throw new Error('La actividad ya terminó');
    const item = items[state.cursor];
    const r = canAuto
      ? autoScore(T, { value, item, msTaken, activity, mode: 'solo' })
      : { correct: false, points: 0 };
    state.answers.push({ index: state.cursor, value, correct: r.correct, points: r.points });
    state.score += r.points;
    if (r.correct) state.correct += 1;
    state.cursor += 1;
    if (state.cursor >= total) state.status = 'ended';
    return { correct: r.correct, points: r.points, cursor: state.cursor, done: state.cursor >= total };
  }

  const result = () => ({ score: state.score, correct: state.correct, total, done: state.cursor >= total });

  return {
    state, answer, result,
    get status() { return state.status; },
    get totalItems() { return total; },
  };
}
