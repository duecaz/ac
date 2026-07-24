// Ball Sort scoring. The submitted `value` is a board snapshot
// ({ tubes, tubeCapacity, moveCount, elapsedMs, solved }). The `item` is the
// frozen puzzle config ({ board, mode, level }).
//
// Solved boards score high (less = better, per mode); unsolved boards get
// partial credit by how much of the board is sorted, so the host's ranking is
// still meaningful when nobody finishes (same spirit as race progress).
import { progress } from './game/rules.js';

const PARTIAL_MAX = 300;   // max points for an unsolved-but-progressed board
const SOLVE_BASE  = 1000;  // points for an instant/zero-cost solve (clamped)
const SOLVE_FLOOR = 200;   // minimum for any solve (so finishing always wins)

export function scoreBallsort({ value, item, activity } = {}) {
  const v = value || {};
  const mode = item?.mode || activity?.content?.mode || activity?.rules?.mode || 'moves';

  if (!v.solved) {
    // Partial credit from board completeness (0..1).
    let frac = 0;
    if (Array.isArray(v.tubes)) {
      frac = progress({ tubes: v.tubes, tubeCapacity: v.tubeCapacity || 7 });
    }
    return { correct: false, points: Math.round(frac * PARTIAL_MAX), hits: 0, total: 1 };
  }

  let points;
  if (mode === 'time') {
    const secs = Math.max(0, Math.round((v.elapsedMs || 0) / 1000));
    points = SOLVE_BASE - secs * 5;            // -5 pts/second
  } else {
    const moves = Math.max(0, v.moveCount || 0);
    points = SOLVE_BASE - moves * 8;           // -8 pts/move
  }
  return { correct: true, points: Math.max(SOLVE_FLOOR, points), hits: 1, total: 1 };
}
