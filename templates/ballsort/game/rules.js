// Ball Sort rules — pure move legality + win check. No DOM, no deps.
export function canMove(board, from, to) {
  if (from === to) return false;
  const src = board.tubes[from];
  const dst = board.tubes[to];
  if (!src || !dst) return false;
  if (src.length === 0) return false;
  if (dst.length >= board.tubeCapacity) return false;
  return true;
}

export function applyMove(board, from, to) {
  if (!canMove(board, from, to)) return null;
  const tubes = board.tubes.map(tube => [...tube]);
  const ball = tubes[from].pop();
  tubes[to].push(ball);
  return { ...board, tubes };
}

export function isWin(board) {
  const cap = board.tubeCapacity;
  return board.tubes.every(tube => {
    if (tube.length === 0) return true;
    if (tube.length !== cap) return false;
    const first = tube[0];
    return tube.every(ball => ball === first);
  });
}

// Fraction [0..1] of the board that is "sorted": tubes that are empty or full of
// a single colour count as done. Used for partial-credit scoring + progress UI.
export function progress(board) {
  const total = board.tubes.length;
  if (!total) return 0;
  let done = 0;
  for (const tube of board.tubes) {
    if (tube.length === 0) { done++; continue; }
    const first = tube[0];
    if (tube.length === board.tubeCapacity && tube.every(b => b === first)) done++;
  }
  return done / total;
}
