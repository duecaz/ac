// Pointer drag + tap interaction for the tubes. No deps.
import { ballStyle } from './tubes.js';

const TAP_THRESHOLD = 10;

/**
 * @typedef {import('../../../kernel/contracts/activity.js').BallsortBoard} BallsortBoard
 */

/** @param {BallsortBoard} board @param {number} tubeIdx @returns {string|null} */
function topBallColor(board, tubeIdx) {
  const tube = board.tubes[tubeIdx];
  if (!tube || tube.length === 0) return null;
  return tube[tube.length - 1];
}

/**
 * @param {HTMLElement} container
 * @param {{getBoard: () => BallsortBoard, isInteractive: () => boolean,
 *   onMove?: (from: number, to: number) => void, onTap?: (index: number) => void}} opts
 * @returns {() => void} desenganchar
 */
export function attachDrag(container, { getBoard, isInteractive, onMove, onTap }) {
  /** @type {{pointerId: number|null, sourceIndex: number|null, startX: number,
   *   startY: number, moved: boolean, ghost: HTMLElement|null, overIndex: number|null}} */
  const state = {
    pointerId: null,
    sourceIndex: null,
    startX: 0,
    startY: 0,
    moved: false,
    ghost: null,
    overIndex: null
  };

  /** @param {number} x @param {number} y @returns {number} */
  function findTubeAt(x, y) {
    if (state.ghost) state.ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (state.ghost) state.ghost.style.display = '';
    if (!el) return -1;
    const tube = /** @type {HTMLElement|null} */ (el.closest('.tube'));
    if (!tube || !container.contains(tube)) return -1;
    const idx = parseInt(tube.dataset.index ?? '', 10);
    return Number.isNaN(idx) ? -1 : idx;
  }

  /** @param {string} color @returns {HTMLElement} */
  function createGhost(color) {
    const el = document.createElement('div');
    el.className = 'ball ball--ghost';
    el.setAttribute('style', ballStyle(color));
    document.body.appendChild(el);
    return el;
  }

  /** @param {number} x @param {number} y */
  function moveGhost(x, y) {
    if (!state.ghost) return;
    state.ghost.style.left = `${x}px`;
    state.ghost.style.top  = `${y}px`;
  }

  function clearTargetHighlight() {
    container.querySelectorAll('.tube--target-ok, .tube--target-bad')
      .forEach(t => t.classList.remove('tube--target-ok', 'tube--target-bad'));
  }

  /** @param {number|null} idx */
  function highlightTarget(idx) {
    if (state.overIndex === idx) return;
    clearTargetHighlight();
    state.overIndex = idx;
    if (idx == null || idx < 0) return;
    const tube = container.querySelector(`.tube[data-index="${idx}"]`);
    if (!tube) return;
    const board = getBoard();
    const dst = board.tubes[idx];
    const valid = idx !== state.sourceIndex && dst.length < board.tubeCapacity;
    tube.classList.add(valid ? 'tube--target-ok' : 'tube--target-bad');
  }

  function reset() {
    if (state.ghost) { state.ghost.remove(); state.ghost = null; }
    clearTargetHighlight();
    state.pointerId = null;
    state.sourceIndex = null;
    state.moved = false;
    state.overIndex = null;
  }

  /** @param {PointerEvent} e */
  function onDown(e) {
    if (!isInteractive()) return;
    if (state.pointerId != null) return;
    const destino = /** @type {HTMLElement|null} */ (e.target);
    const tube = /** @type {HTMLElement|null} */ (destino?.closest?.('.tube') ?? null);
    if (!tube || !container.contains(tube)) return;
    const idx = parseInt(tube.dataset.index ?? '', 10);
    if (Number.isNaN(idx)) return;
    state.pointerId = e.pointerId;
    state.sourceIndex = idx;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.moved = false;
    try { container.setPointerCapture?.(e.pointerId); } catch {}
  }

  /** @param {PointerEvent} e */
  function onMoveEv(e) {
    if (state.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.moved) {
      if (Math.hypot(dx, dy) < TAP_THRESHOLD) return;
      const board = getBoard();
      const color = state.sourceIndex == null ? null : topBallColor(board, state.sourceIndex);
      if (!color) {
        state.pointerId = null;
        state.sourceIndex = null;
        return;
      }
      state.moved = true;
      state.ghost = createGhost(color);
    }
    moveGhost(e.clientX, e.clientY);
    const overIdx = findTubeAt(e.clientX, e.clientY);
    highlightTarget(overIdx >= 0 ? overIdx : null);
    if (e.cancelable) e.preventDefault();
  }

  /** @param {PointerEvent} e */
  function onUp(e) {
    if (state.pointerId !== e.pointerId) return;
    if (state.moved) {
      const overIdx = findTubeAt(e.clientX, e.clientY);
      const src = state.sourceIndex;
      reset();
      if (src != null && overIdx >= 0 && overIdx !== src) onMove?.(src, overIdx);
    } else {
      const idx = state.sourceIndex;
      reset();
      if (idx != null) onTap?.(idx);
    }
  }

  /** @param {PointerEvent} e */
  function onCancel(e) {
    if (state.pointerId !== e.pointerId) return;
    reset();
  }

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMoveEv);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onCancel);
  container.addEventListener('lostpointercapture', onCancel);

  return () => {
    reset();
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMoveEv);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onCancel);
    container.removeEventListener('lostpointercapture', onCancel);
  };
}
