// Ball Sort — player Individual/Tarea sobre el SHELL libre (C1 de la
// consolidación). Antes vivía inline en template.js sin shell: no guardaba
// resultado (trySaveResult), no tenía pantalla de fin estándar y pintaba su
// propio HTML de victoria. Ahora el shell garantiza guardado + resultScreen +
// onFinish, y este core solo monta el tablero y puntúa con SU scorer.
//
// SIN reanudación F5 a propósito: los puntos premian pocos movimientos, y
// reanudar reinicia el contador de mountBallSort → recargar a mitad daría
// mejor puntaje (exploit). Recargar = tablero nuevo, como siempre.
import { html, mount } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { mountBallSort } from './play.js';
import { scoreBallsort } from './scorer.js';
import { createBoard, randomBoard } from './game/board.js';
import { formatMs } from './timer.js';
import { ensureContent } from './editor.js';

export function renderBallsortPlayer(rootSel, activity, opts = {}) {
  ensureContent(activity);
  const item = activity.content.items[0];
  const mode = item.mode || activity.content.mode || 'moves';
  // Tablero fresco en cada intento si "random"; si no, el congelado.
  const board = activity.content.random
    ? randomBoard(activity.content.level || 'classic')
    : (item.board || createBoard(activity.content.level || 'classic'));

  const ctx = runFreeformPlayer(rootSel, activity, opts);
  // Techo = lo que da el PROPIO scorer por la resolución perfecta (0 movimientos /
  // 0 segundos): la escala 0-1000 de ballsort, no una fórmula paralela.
  const maxScore = activity.scoring?.maxScore
    || scoreBallsort({ value: { solved: true, moveCount: 0, elapsedMs: 0 }, item, activity }).points;

  mount(rootSel, html`<div class="ww-bs-solo"><div id="bs-solo-host"></div></div>`);
  const host = document.querySelector(`${rootSel} #bs-solo-host`);
  emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });

  mountBallSort(host, {
    board, mode,
    onSolve: (res) => {
      const r = scoreBallsort({ value: { ...res, solved: true, tubes: res.tubes }, item, activity });
      ctx.finish({
        title: '¡Resuelto!', icon: 'bi-trophy-fill', iconColor: 'text-warning',
        lead: `Puntos: <b>${r.points}</b> / ${maxScore}`,
        stats: ({ timeUsed }) => (mode === 'time'
          ? `Tiempo: ${formatMs(res.elapsedMs)}`
          : `${res.moveCount} movimientos · ${timeUsed}s`),
        score: r.points, maxScore,
      });
    },
  });
}
