// Shared Ball Sort play core — used by both the SOLO player and the LIVE round.
// Mounts the interactive tubes, handles drag/tap/undo/letters, tracks moves +
// time, and reports via callbacks so the caller decides what to do with the
// result (solo: show result screen; live: broadcast progress + finish).
import { cloneBoard } from './game/board.js';
import { applyMove, canMove, isWin, progress } from './game/rules.js';
import { renderTubes } from './render/tubes.js';
import { attachDrag } from './render/drag.js';
import { createTimer, formatMs } from './timer.js';

/**
 * @param {HTMLElement} host
 * @param {object} opts
 *   board       initial board {levelId, colors, tubeCapacity, tubes}
 *   mode        'moves' | 'time'  (which metric the toolbar emphasises)
 *   onProgress  (snap) => void    called after every move/undo (throttle outside)
 *   onSolve     (result) => void  called once when the board is solved
 * @returns {{ unmount(): void, getState(): object }}
 */
export function mountBallSort(host, { board, mode = 'moves', onProgress, onSolve } = {}) {
  host.innerHTML = `
    <div class="ww-bs bs-player">
      <div class="bs-toolbar">
        <span>Movimientos: <strong data-bs="moves">0</strong></span>
        <span data-bs="time-box" class="${mode === 'time' ? '' : 'bs-hidden'}">Tiempo: <strong data-bs="time">0:00</strong></span>
        <button type="button" data-bs="letters" class="btn btn-outline-secondary btn-sm" title="Mostrar letras (modo daltónico)">Aa</button>
        <button type="button" data-bs="undo" class="btn btn-secondary btn-sm">Deshacer</button>
      </div>
      <div data-bs="tubes" class="tubes"></div>
      <p data-bs="winmsg" class="bs-hidden bs-win">¡Resuelto!</p>
    </div>
  `;

  const tubesEl   = host.querySelector('[data-bs="tubes"]');
  const movesEl   = host.querySelector('[data-bs="moves"]');
  const timeEl    = host.querySelector('[data-bs="time"]');
  const undoBtn   = host.querySelector('[data-bs="undo"]');
  const lettersBtn = host.querySelector('[data-bs="letters"]');
  const winMsg    = host.querySelector('[data-bs="winmsg"]');

  const state = {
    board: cloneBoard(board),
    moveCount: 0,
    history: [],
    selected: null,
    finished: false,
    lastMove: null,
    showLetters: false,
    timer: createTimer(),
    timerHandle: null
  };
  try { state.showLetters = localStorage.getItem('yu_show_letters') === '1'; } catch {}

  state.timer.start();
  state.timerHandle = setInterval(() => {
    if (timeEl) timeEl.textContent = formatMs(state.timer.elapsedMs());
  }, 250);

  function snapshot(solved = false) {
    return {
      tubes: state.board.tubes.map(t => [...t]),
      tubeCapacity: state.board.tubeCapacity,
      colors: state.board.colors,
      moveCount: state.moveCount,
      elapsedMs: state.timer.elapsedMs(),
      progress: progress(state.board),   // 0..1 sorted — drives the VS rope lead
      solved
    };
  }

  function paint() {
    renderTubes(tubesEl, state.board, {
      interactive: !state.finished,
      selectedTube: state.selected,
      lastMove: state.lastMove,
      showLetters: state.showLetters
    });
    state.lastMove = null;
    if (movesEl) movesEl.textContent = String(state.moveCount);
    if (undoBtn) undoBtn.disabled = state.history.length === 0 || state.finished;
    if (lettersBtn) {
      lettersBtn.classList.toggle('active', state.showLetters);
      lettersBtn.setAttribute('aria-pressed', String(state.showLetters));
    }
  }

  function report(solved = false) { try { onProgress?.(snapshot(solved)); } catch {} }

  function tryMove(from, to) {
    if (state.finished) return false;
    if (!canMove(state.board, from, to)) return false;
    const next = applyMove(state.board, from, to);
    if (!next) return false;
    state.history.push({ from, to });
    state.board = next;
    state.moveCount++;
    state.selected = null;
    state.lastMove = { from, to };
    paint();
    if (isWin(state.board)) finish();
    else report(false);
    return true;
  }

  function tap(index) {
    if (state.finished) return;
    if (state.selected === null) {
      if (state.board.tubes[index].length > 0) { state.selected = index; paint(); }
      return;
    }
    if (index === state.selected) { state.selected = null; paint(); return; }
    if (!canMove(state.board, state.selected, index)) { state.selected = index; paint(); return; }
    tryMove(state.selected, index);
  }

  function undo() {
    if (state.history.length === 0 || state.finished) return;
    const last = state.history.pop();
    const next = cloneBoard(state.board);
    const ball = next.tubes[last.to].pop();
    next.tubes[last.from].push(ball);
    state.board = next;
    state.moveCount--;
    state.selected = null;
    state.lastMove = { from: last.to, to: last.from };
    paint();
    report(false);
  }

  function toggleLetters() {
    state.showLetters = !state.showLetters;
    try { localStorage.setItem('yu_show_letters', state.showLetters ? '1' : '0'); } catch {}
    paint();
  }

  function finish() {
    if (state.finished) return;
    state.finished = true;
    if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
    state.timer.stop();
    if (winMsg) winMsg.classList.remove('bs-hidden');
    paint();
    report(true);
    try {
      onSolve?.({ finished: true, moveCount: state.moveCount, elapsedMs: state.timer.elapsedMs(), tubes: state.board.tubes });
    } catch {}
  }

  paint();
  const detachDrag = attachDrag(tubesEl, {
    getBoard: () => state.board,
    isInteractive: () => !state.finished,
    onMove: tryMove,
    onTap: tap
  });
  undoBtn?.addEventListener('click', undo);
  lettersBtn?.addEventListener('click', toggleLetters);

  return {
    getState: () => snapshot(state.finished),
    unmount() {
      detachDrag?.();
      if (state.timerHandle) clearInterval(state.timerHandle);
      host.replaceChildren();
    }
  };
}
