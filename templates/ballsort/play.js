// Shared Ball Sort play core — used by both the SOLO player and the LIVE round.
// Mounts the interactive tubes, handles drag/tap/undo/letters, tracks moves +
// time, and reports via callbacks so the caller decides what to do with the
// result (solo: show result screen; live: broadcast progress + finish).
import { cloneBoard } from './game/board.js';
import { applyMove, canMove, isWin, progress } from './game/rules.js';
import { renderTubes } from './render/tubes.js';
import { attachDrag } from './render/drag.js';
import { createTimer, formatMs } from './timer.js';
import { startElapsedTicker } from '../../core/deadlineTicker.js';
import { clock } from '../../core/clock.js';
import { lsGet, lsSet } from '../../core/ls.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';

const LETTERS_KEY = 'yu_show_letters';   // preferencia de accesibilidad (letras en las bolas)

/**
 * @typedef {import('../../kernel/contracts/activity.js').BallsortBoard} BallsortBoard
 */

/**
 * LA INSTANTÁNEA del tablero: lo que viaja al host en vivo y lo que puntúa el
 * scorer. Es el recorte del tablero más las dos métricas de la partida.
 * @typedef {Object} BallsortSnapshot
 * @property {string[][]} tubes
 * @property {number} tubeCapacity
 * @property {string[]} colors
 * @property {number} moveCount
 * @property {number} elapsedMs
 * @property {number} [progress]   Fracción 0..1 ya ordenada.
 * @property {boolean} solved
 */

/**
 * LO QUE SE ENTREGA AL RESOLVER (el `onSolve` del caller).
 * @typedef {Object} BallsortSolve
 * @property {boolean} finished
 * @property {number} moveCount
 * @property {number} elapsedMs
 * @property {string[][]} tubes
 */

/**
 * @param {HTMLElement} host
 * @param {{board: BallsortBoard, mode?: 'moves'|'time',
 *   onProgress?: (snap: BallsortSnapshot) => void,
 *   onSolve?: (res: BallsortSolve) => void}} opts
 *   board       initial board {levelId, colors, tubeCapacity, tubes}
 *   mode        'moves' | 'time'  (which metric the toolbar emphasises)
 *   onProgress  (snap) => void    called after every move/undo (throttle outside)
 *   onSolve     (result) => void  called once when the board is solved
 * @returns {{ unmount(): void, getState(): BallsortSnapshot }}
 */
export function mountBallSort(host, { board, mode = 'moves', onProgress, onSolve }) {
  host.innerHTML = `
    <div class="ww-bs bs-player">
      ${cabeceraHtml({
        pagina: 'Movs: 0',
        tiempo: mode === 'time' ? '0:00' : undefined,
        herramientas: `<button type="button" data-bs="letters" class="btn btn-outline-secondary btn-sm" title="Mostrar letras (modo daltónico)">Aa</button>
          <button type="button" data-bs="undo" class="btn btn-secondary btn-sm">Deshacer</button>`,
      })}
      <div data-bs="tubes" class="edu-sec edu-sec--tablero tubes"></div>
      <p data-bs="winmsg" class="bs-hidden bs-win">¡Resuelto!</p>
    </div>
  `;

  const tubesEl   = /** @type {HTMLElement} */ (host.querySelector('[data-bs="tubes"]'));
  const raizBs    = /** @type {HTMLElement} */ (host.querySelector('.ww-bs'));
  const undoBtn   = /** @type {HTMLButtonElement|null} */ (host.querySelector('[data-bs="undo"]'));
  const lettersBtn = /** @type {HTMLElement|null} */ (host.querySelector('[data-bs="letters"]'));
  const winMsg    = host.querySelector('[data-bs="winmsg"]');

  /** @type {{board: BallsortBoard, moveCount: number, history: Array<{from: number, to: number}>,
   *   selected: number|null, finished: boolean, lastMove: {from: number, to: number}|null,
   *   showLetters: boolean, timer: ReturnType<typeof createTimer>,
   *   timerHandle: {stop: () => void}|null}} */
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
  state.showLetters = lsGet(LETTERS_KEY, '') === '1';

  state.timer.start();
  // Latido del marcador de tiempo con el primitivo compartido. El guard `while`
  // corta solo si el nodo sale del DOM (navegar fuera a mitad de partida) o al
  // terminar — antes era un setInterval a pelo que quedaba vivo para siempre
  // (jank en pizarras de gama baja) hasta que se le parchó un auto-corte.
  const timeTicker = startElapsedTicker({
    since: clock.now(), everyMs: 250,
    while: () => !state.finished && raizBs.isConnected,
    onTick: () => { if (mode === 'time') hudSet(raizBs, 'tiempo', formatMs(state.timer.elapsedMs())); },
  });
  state.timerHandle = timeTicker;   // se detiene en finish()/unmount() vía .stop()

  /** @param {boolean} [solved] @returns {BallsortSnapshot} */
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
    hudSet(raizBs, 'pagina', `Movs: ${state.moveCount}`);
    if (undoBtn) undoBtn.disabled = state.history.length === 0 || state.finished;
    if (lettersBtn) {
      lettersBtn.classList.toggle('active', state.showLetters);
      lettersBtn.setAttribute('aria-pressed', String(state.showLetters));
    }
  }

  // AVISAR DEL AVANCE es cosa del modo que monta el juego (el duelo mueve su
  // cuerda con esto). Si ESE oyente revienta, el tablero no tiene por qué caerse
  // con él —el alumno está a mitad de partida—, pero tampoco se traga el fallo
  // en silencio (R6): se deja escrito en la consola con su origen.
  /** @param {boolean} [solved] */
  function report(solved = false) {
    try { onProgress?.(snapshot(solved)); }
    catch (e) { console.error('[ballsort] onProgress falló', e); }
  }

  /** @param {number} from @param {number} to @returns {boolean} */
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

  /** @param {number} index */
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
    if (!last) return;
    const next = cloneBoard(state.board);
    const ball = next.tubes[last.to].pop();
    if (ball != null) next.tubes[last.from].push(ball);
    state.board = next;
    state.moveCount--;
    state.selected = null;
    state.lastMove = { from: last.to, to: last.from };
    paint();
    report(false);
  }

  function toggleLetters() {
    state.showLetters = !state.showLetters;
    lsSet(LETTERS_KEY, state.showLetters ? '1' : '0');
    paint();
  }

  function finish() {
    if (state.finished) return;
    state.finished = true;
    if (state.timerHandle) { state.timerHandle.stop(); state.timerHandle = null; }
    state.timer.stop();
    if (winMsg) winMsg.classList.remove('bs-hidden');
    paint();
    report(true);
    // Ídem que `report`: quien escucha el final (el duelo, la ronda) puede
    // fallar, y el juego ya ha terminado bien — pero el fallo se DICE.
    try {
      onSolve?.({ finished: true, moveCount: state.moveCount, elapsedMs: state.timer.elapsedMs(), tubes: state.board.tubes });
    } catch (e) { console.error('[ballsort] onSolve falló', e); }
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
      state.timerHandle?.stop();
      host.replaceChildren();
    }
  };
}
