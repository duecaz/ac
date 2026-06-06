// Pure LIVE phase machine — the Kahoot-style host flow, extracted from the DOM
// of views/hostLive.js so the legal transitions are explicit and testable.
// Backend-agnostic: it computes WHAT should happen (a state patch or an intent);
// the view/transport layer carries it out (setSessionState / settleItem / endSession).
//
// Flow:  idle/lobby ──start──▶ question ──reveal──▶ reveal ──leaderboard──▶ leaderboard
//                                  ▲                   │                        │
//                                  └────────── next ───┴──────── next ──────────┘
//                                       (current_item+1, or → ended if last)
// `end` from anywhere → ended.

export const PHASES = Object.freeze({
  IDLE: 'idle', LOBBY: 'lobby', QUESTION: 'question',
  REVEAL: 'reveal', LEADERBOARD: 'leaderboard', ENDED: 'ended',
});

/** Last item reached? `total` is the number of items in the activity. */
export function isLastItem(session, total) {
  return (session?.current_item ?? -1) >= total - 1;
}

/**
 * Plan the next step for a host action against the current session.
 * @param {{phase:string, current_item:number, status?:string}} session
 * @param {'start'|'reveal'|'leaderboard'|'next'|'end'} action
 * @param {number} total  number of items
 * @returns {{type:'patch', patch:Object}
 *         | {type:'settle', itemIndex:number}
 *         | {type:'end'}
 *         | {type:'invalid', reason:string}}
 */
export function planTransition(session, action, total) {
  const phase = session?.phase;
  const idx = session?.current_item ?? -1;

  switch (action) {
    case 'start':
      if (phase !== PHASES.IDLE && phase !== PHASES.LOBBY) return invalid('start solo desde lobby');
      if (!total) return invalid('la actividad no tiene ítems');
      return { type: 'patch', patch: { status: 'running', phase: PHASES.QUESTION, current_item: 0 } };

    case 'reveal':
      if (phase !== PHASES.QUESTION) return invalid('reveal solo desde question');
      // Scoring is server-side (anti-cheat); the EF flips phase → reveal.
      return { type: 'settle', itemIndex: idx };

    case 'leaderboard':
      if (phase !== PHASES.REVEAL) return invalid('leaderboard solo desde reveal');
      return { type: 'patch', patch: { phase: PHASES.LEADERBOARD } };

    case 'next':
      if (phase !== PHASES.REVEAL && phase !== PHASES.LEADERBOARD) return invalid('next solo desde reveal/leaderboard');
      if (isLastItem(session, total)) return { type: 'end' };
      return { type: 'patch', patch: { phase: PHASES.QUESTION, current_item: idx + 1 } };

    case 'end':
      return { type: 'end' };

    default:
      return invalid(`acción desconocida: ${action}`);
  }
}

function invalid(reason) { return { type: 'invalid', reason }; }

/** Stable key for a session's visible phase (used to dedupe host effects). */
export function sessionPhaseKey(session) {
  return `${session?.status}-${session?.phase}-${session?.current_item}-${session?.deadline || ''}`;
}

/**
 * Decide how the host should react to a state change.
 * - `phaseChanged`: did the visible phase change? (gate sounds/effects on this)
 * - `skip`: don't repaint at all. Only true for non-phase-changing updates while
 *   a question is live, so heartbeats/answers don't reset the timer. Lobby player
 *   joins (session key unchanged) are NOT skipped → the roster refreshes live.
 * @param {string} prevKey  the last applied phase key
 * @param {{status:string, phase:string, current_item:number, deadline?:any}} session
 * @returns {{ key:string, phaseChanged:boolean, skip:boolean }}
 */
export function hostPaintDecision(prevKey, session) {
  const key = sessionPhaseKey(session);
  const phaseChanged = key !== prevKey;
  const skip = !phaseChanged && session?.phase === PHASES.QUESTION;
  return { key, phaseChanged, skip };
}
