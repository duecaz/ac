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
    kind:            'juego',   // familia (norte §4c): quién pone el contenido
    skill:           'Lógica y deducción',   // el eje del catálogo de juegos
    contentModel:    'ballsort',
    templateVersion: 1,
    instructions:    'Ordena las bolas: mueve la de arriba de un tubo a otro hasta que cada tubo quede de un solo color.',
    aspectRatio:     '4/3',
    // async:false — es un JUEGO (§4c): sin contenido del docente no hay nada que
    // evaluar en una Tarea, y mandarlo a casa empuja al uso sin profe (§4d).
    modes:           { solo: true, live: true, async: false, practice: false },
    // POLÍTICA DE JUEGO declarada (la leen el motor y las vistas, no la adivinan).
    play:            { vs: 'race', teams: 'board', live: ['board'], submit: 'gesto',
      // OPCIÓN DE PARTIDA (core/playOptions.js): el tablero se puede ganar de
      // DOS formas y quién elige es el docente, en el momento de lanzar. Estaba
      // solo en el editor: para cambiarla había que salir del juego con la clase
      // esperando. El scorer ya respetaba ambas (−8 pts/movimiento · −5 pts/s).
      options: [{
        id: 'mode', label: 'Cómo se gana',
        values: [
          { value: 'moves', label: 'Menos movimientos', icon: 'bi-arrow-left-right' },
          { value: 'time',  label: 'Menos tiempo',      icon: 'bi-stopwatch' },
        ],
        get: (a) => a?.content?.mode || 'moves',
        // El modo vive en DOS sitios (el contenido y el ítem del tablero, que es
        // lo que lee el scorer): se cambian los dos o la partida diría una cosa
        // y puntuaría otra. Copia, sin mutar la actividad guardada.
        set: (a, v) => ({
          ...a,
          content: {
            ...a.content, mode: v,
            items: (a.content?.items || []).map(it => ({ ...it, mode: v })),
          },
        }),
      }],
    },
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

}
