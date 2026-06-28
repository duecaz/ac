import { BaseTemplate } from '../base.js';
import { escapeHtml } from '../../core/html.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { mountBallSort } from './play.js';
import { renderMini } from './render/mini.js';
import { renderBallsortEditor, ensureContent } from './editor.js';
import { scoreBallsort } from './scorer.js';
import { createBoard, randomBoard } from './game/board.js';
import { formatMs } from './timer.js';

const el = (sel) => (typeof sel === 'string' ? document.querySelector(sel) : sel);

export class BallsortTemplate extends BaseTemplate {
  static meta = {
    name:            'ballsort',
    label:           'Ordena las Pelotas',
    icon:            'bi-droplet-half',
    color:           'info',
    contentModel:    'ballsort',
    templateVersion: 1,
    aspectRatio:     '4/3',
    modes:           { solo: true, live: true, async: true, practice: false },
    // LIVE: this template runs as a single shared board where every student
    // solves the SAME puzzle at their own pace and the host watches each board
    // update move-by-move. It rides the existing 'race' phase (lobby/podium
    // unchanged) but the host + student PLAY views branch on this flag.
    liveBoard:       true,
    needsImageUpload: false,
    needsAudioUpload: false,
    defaultRules:   () => ({}),
    defaultScoring: () => ({ mode: 'flat', pointsPerCorrect: 1000 }),
    defaultLive:    () => ({ advanceMode: 'race' }),
    defaultContent: () => {
      const board = randomBoard('classic');
      return { level: 'classic', mode: 'moves', random: true,
               items: [{ id: 'bs1', board, mode: 'moves' }] };
    },
  };

  static renderEditor = renderBallsortEditor;
  static scoreSubmission = scoreBallsort;

  // The board carries no secret (it's fully public), so the "sanitized" payload
  // is just the board + mode for the round. itemIndex defaults to 0 (one board).
  static getRoundPayload(activity, ctx = {}) {
    ensureContent(activity);
    const i = ctx.itemIndex || 0;
    const item = activity.content.items[i] || activity.content.items[0];
    return { board: item.board, mode: item.mode || activity.content.mode || 'moves' };
  }

  // Interactive student round (LIVE/race). `onProgress` broadcasts the board on
  // every move; `onSubmit` fires once with the final result when solved.
  static renderRound(root, payload, { onSubmit, onProgress } = {}) {
    if (!payload?.board) return null;
    return mountBallSort(root, {
      board: payload.board,
      mode: payload.mode || 'moves',
      onProgress: (snap) => onProgress?.(snap),
      onSolve: (res) => onSubmit?.(res),
    });
  }

  // Host projector view (standard question phase). For the liveBoard race the
  // host renders its own grid of mini-boards; this is the fallback/standard view.
  static renderRoundHost(root, { payload, item } = {}) {
    const board = payload?.board || item?.board;
    root.innerHTML = `<div class="ww-bs text-center"><div id="bs-host-mini" class="d-inline-block"></div></div>`;
    const host = root.querySelector('#bs-host-mini');
    if (host && board) renderMini(host, board);
  }

  // One cell of the host's LIVE dashboard: a player's mini-board + stats.
  // `value` is the latest broadcast snapshot { tubes, tubeCapacity, moveCount, elapsedMs, solved }.
  static renderRaceCell(cellEl, { value, name, mode = 'moves' } = {}) {
    const v = value || {};
    const solved = !!v.solved;
    const stat = mode === 'time'
      ? formatMs(v.elapsedMs || 0)
      : `${v.moveCount || 0} mov`;
    cellEl.innerHTML = `
      <div class="bs-cell ${solved ? 'bs-cell-solved' : ''}">
        <div class="bs-cell-head">
          <span class="bs-cell-name">${escapeHtml(name || '—')}</span>
          <span class="bs-cell-stat">${solved ? '🏆 ' : ''}${escapeHtml(stat)}</span>
        </div>
        <div class="bs-cell-board"></div>
      </div>`;
    const boardEl = cellEl.querySelector('.bs-cell-board');
    if (boardEl && Array.isArray(v.tubes)) {
      renderMini(boardEl, { tubes: v.tubes, tubeCapacity: v.tubeCapacity || 7, colors: v.colors || [] });
    }
  }

  // SOLO / async player. Minimal but functional: solve the board, see your
  // moves/time. (Saving results / leaderboards comes in the "compatible with the
  // other modes" phase.)
  static renderPlayer(rootSel, activity, opts = {}) {
    ensureContent(activity);
    const root = el(rootSel);
    if (!root) return;
    const item = activity.content.items[0];
    const mode = item.mode || activity.content.mode || 'moves';
    // Fresh board each solo attempt if "random"; else the frozen one.
    const board = activity.content.random
      ? randomBoard(activity.content.level || 'classic')
      : (item.board || createBoard(activity.content.level || 'classic'));

    root.innerHTML = `<div class="ww-bs-solo"><div id="bs-solo-host"></div></div>`;
    const host = root.querySelector('#bs-solo-host');
    emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });

    mountBallSort(host, {
      board, mode,
      onSolve: (res) => {
        const r = scoreBallsort({ value: { ...res, solved: true, tubes: res.tubes }, item, activity });
        const lead = mode === 'time'
          ? `Tiempo: <b>${formatMs(res.elapsedMs)}</b>`
          : `Movimientos: <b>${res.moveCount}</b>`;
        emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: r.points }] });
        host.insertAdjacentHTML('beforeend', `
          <div class="text-center mt-3">
            <h3 class="text-success"><i class="bi bi-trophy-fill"></i> ¡Resuelto!</h3>
            <p class="lead mb-2">${lead} · Puntos: <b>${r.points}</b></p>
            <button type="button" class="btn btn-primary" id="bs-again"><i class="bi bi-arrow-repeat"></i> Jugar otra vez</button>
          </div>`);
        host.querySelector('#bs-again')?.addEventListener('click', () => this.renderPlayer(rootSel, activity, opts));
      },
    });
  }
}
