// SOLO / async player for Operaciones: iterate items with a numeric keypad.
// Loop/score/finish are handled by the SequentialShell (core/soloPlayer.js);
// this core only renders each keypad round and scores the submission.
import { escapeHtml, $ } from '../../core/html.js';
import { renderKeypadRound } from '../../core/roundRender.js';
import { scoreMathSubmission } from './scorer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { runSequentialPlayer } from '../../core/soloPlayer.js';
import { clock } from '../../core/clock.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').QaItem} QaItem
 */

/**
 * @param {string|Element} rootSel
 * @param {import('../../kernel/contracts/activity.js').Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 * @returns {Promise<void>}
 */
export async function renderMathPlayer(rootSel, activity, opts = {}) {
  /** @type {import('../../core/soloPlayer.js').SequentialCallbacks<QaItem>} */
  const callbacks = {
    // La maquetación de Operaciones es una columna flex propia (`.ww-math`): se
    // DECLARA al shell, que la pone en el marco una sola vez. La cabecera y el
    // reloj ya no se rehacen al cambiar de operación.
    marco: { clase: 'ww-math' },
    renderItem({ activity, item, idx, submit, ronda, pintar }) {
      pintar('<div data-math="round" class="ww-math-round"></div>');
      // Acotado a la RONDA: un id global vale para todo el documento, y en el
      // duelo hay dos rondas montadas a la vez.
      const roundEl = $('[data-math="round"]', ronda);
      if (!roundEl) return;
      const t0 = clock.now();
      renderKeypadRound(roundEl, { question: item.question }, { onSubmit: (value) => {
        const r = scoreMathSubmission({ value, item, activity });
        const disp = roundEl.querySelector('[data-display]');
        if (disp) disp.classList.add(r.correct ? 'is-ok' : 'is-no');
        if (!r.correct && item.answer != null) {
          const q = roundEl.querySelector('.ww-keypad-q');
          if (q) q.insertAdjacentHTML('beforeend', ` <b class="text-success">${escapeHtml(String(item.answer))}</b>`);
        }
        emitGame(r.correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, { idx });
        submit({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: clock.now() - t0 });
      } });
    },
  };
  runSequentialPlayer(rootSel, activity, opts, callbacks);
}
