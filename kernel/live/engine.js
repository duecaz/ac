// Backend-agnostic LIVE engine — a full Kahoot-style match in memory, with no
// network or DOM. It is the single source of truth for the LIVE *flow* and is
// reused by the local driver (cross-tab, no backend) and mirrored by the
// Supabase Edge Functions. Being pure, a whole match can be simulated and
// asserted in Node — so LIVE is testable locally before any Supabase.
//
// Anti-cheat parity with the server: scoring happens in settle() (not when a
// client submits); submitted answers carry correct=null/points=0 until settled.
import { planTransition, PHASES } from '../../core/livePhases.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { getTemplate } from '../../core/registry.js';

export function createLiveRoom(activity, opts = {}) {
  const items = activity?.content?.items || [];
  const total = items.length;
  const maxPlayers = activity?.live?.maxPlayers || 60;
  const allowLateJoin = activity?.live?.allowLateJoin !== false;
  const T = getTemplate(activity?.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity?.template}`);

  let seq = 0;
  const state = {
    code: opts.code || 'LOCAL1',
    status: 'lobby',
    phase: PHASES.IDLE,
    currentItem: -1,
    players: [],          // { id, userId, name, score }
    answers: new Map(),   // `${itemIndex}:${playerId}` → { playerId, value, msTaken, correct, points }
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
    const p = { id: 'p' + (++seq), userId, name: f.value, score: 0 };
    state.players.push(p);
    return p;
  }

  // Host action. Returns the executed plan; throws on an illegal transition.
  function dispatch(action) {
    const plan = planTransition(session(), action, total);
    if (plan.type === 'invalid') throw new Error(plan.reason);
    if (plan.type === 'end') { state.status = 'ended'; state.phase = PHASES.ENDED; return plan; }
    if (plan.type === 'settle') { settle(plan.itemIndex); return plan; }
    const pa = plan.patch; // type === 'patch'
    if (pa.status) state.status = pa.status;
    if (pa.phase) state.phase = pa.phase;
    if ('current_item' in pa) state.currentItem = pa.current_item;
    return plan;
  }

  function submit(playerId, itemIndex, value, msTaken = 0) {
    if (state.phase !== PHASES.QUESTION || itemIndex !== state.currentItem) {
      throw new Error('No se aceptan respuestas en esta fase');
    }
    // Upsert (a player may change their answer before settle). Never scored here.
    state.answers.set(answerKey(itemIndex, playerId), { playerId, value, msTaken, correct: null, points: 0 });
  }

  // Server-side scoring (anti-cheat). Idempotent per item.
  function settle(itemIndex) {
    const item = items[itemIndex];
    let settled = 0;
    for (const [key, ans] of state.answers) {
      if (!key.startsWith(itemIndex + ':')) continue;
      const r = T.scoreSubmission({ value: ans.value, item, msTaken: ans.msTaken, activity, mode: 'live' });
      const wasUnscored = ans.correct === null;
      ans.correct = r.correct;
      ans.points = r.points || 0;
      if (wasUnscored) {
        const p = state.players.find(pl => pl.id === ans.playerId);
        if (p) p.score += ans.points; // single-process → inherently atomic, no race
      }
      settled++;
    }
    state.phase = PHASES.REVEAL;
    return settled;
  }

  // Per-round payload sent to clients (answer stripped) — same contract as server.
  function roundPayload(itemIndex = state.currentItem) {
    return T.getRoundPayload ? T.getRoundPayload(activity, { itemIndex }) : null;
  }

  function leaderboard(limit = 50) {
    return [...state.players]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
  }

  return {
    state,
    join, dispatch, submit, settle, roundPayload, leaderboard,
    get phase() { return state.phase; },
    get currentItem() { return state.currentItem; },
    get totalItems() { return total; },
  };
}
