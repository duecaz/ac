import { BaseTemplate } from '../base.js';
import { escapeHtml } from '../../core/html.js';
import { mountBallSort } from './play.js';
import { renderMini } from './render/mini.js';
import { renderBallsortEditor, ensureContent } from './editor.js';
import { renderBallsortPlayer } from './player.js';
import { scoreBallsort } from './scorer.js';
import { randomBoard } from './game/board.js';
import { formatMs } from './timer.js';

export class BallsortTemplate extends BaseTemplate {
  static meta = {
    name:            'ballsort',
    label:           'Ordena las Pelotas',
    icon:            'bi-droplet-half',
    color:           'info',
    contentModel:    'ballsort',
    templateVersion: 1,
    instructions:    'Ordena las bolas: mueve la de arriba de un tubo a otro hasta que cada tubo quede de un solo color.',
    aspectRatio:     '4/3',
    modes:           { solo: true, live: true, async: true, practice: false },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'race', teams: 'board', live: 'board' },
    // LIVE 'board' (declarado en play.live): tablero ÚNICO compartido — cada
    // alumno resuelve el MISMO puzle a su ritmo y el host ve cada tablero
    // avanzar movimiento a movimiento sobre la fase 'race'.
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

  // SOLO / Tarea: en player.js sobre el shell libre (guardado de resultado +
  // pantalla de fin estándar garantizados por core/soloPlayer.js).
  static renderPlayer = renderBallsortPlayer;

  // Preview de tarjeta: el tablero congelado — tubos con sus bolas de color, la
  // primera pantalla del juego. Estilos inline (sin depender del CSS scoped).
  static previewHtml(act) {
    const board = act.content?.items?.[0]?.board;
    if (!board?.tubes?.length) {
      return `<div class="ww-player" style="display:flex;align-items:center;justify-content:center">
        <h2 class="text-center">${escapeHtml(act.title || 'Ordena las Pelotas')}</h2></div>`;
    }
    const cap = board.tubeCapacity || 7;
    const TUBE = 68, BALL = 54, GAP = 4;
    const ball = (color) => {
      const base = `width:${BALL}px;height:${BALL}px;border-radius:50%;margin:0 auto;box-sizing:border-box;`;
      if (!color)            return `<div style="${base}background:transparent;border:1px dashed #3a4356"></div>`;
      if (color === 'white') return `<div style="${base}background:#fff;border:2px solid #000"></div>`;
      return `<div style="${base}background:${color}"></div>`;
    };
    const tubes = board.tubes.map(tube => {
      const slots = Array.from({ length: cap }, (_, i) => ball(tube[i])).join('');
      return `<div style="width:${TUBE}px;background:#2a3140;border:2px solid #3a4356;border-radius:0 0 24px 24px;display:flex;flex-direction:column-reverse;padding:4px;gap:${GAP}px;box-sizing:border-box">${slots}</div>`;
    }).join('');
    return `<div class="ww-player" style="display:flex;flex-direction:column;height:100%;align-items:center;justify-content:center;gap:1.4rem">
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:flex-end">${tubes}</div>
      <div class="fs-3 fw-semibold text-center">${escapeHtml(act.title || 'Ordena las Pelotas')}</div>
    </div>`;
  }
}
