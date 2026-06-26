// SOLO / async player for Operaciones: iterate items with a numeric keypad.
// Loop/score/finish are handled by the SequentialShell (core/soloPlayer.js);
// this core only renders each keypad round and scores the submission.
import { html, escapeHtml, mount } from '../../core/html.js';
import { renderKeypadRound } from '../../core/roundRender.js';
import { scoreMathSubmission } from './scorer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { runSequentialPlayer } from '../../core/soloPlayer.js';

export async function renderMathPlayer(rootSel, activity, opts = {}) {
  runSequentialPlayer(rootSel, activity, opts, {
    renderItem({ rootSel, activity, item, idx, total, score, submit }) {
      mount(rootSel, html`
        <div class="ww-player ww-math">
          <div class="ww-phead d-flex justify-content-between align-items-center">
            <span class="badge bg-secondary">${idx + 1} / ${total}</span>
            <span class="badge bg-primary">&#9733; ${score}</span>
          </div>
          <div id="ww-math-round" class="ww-math-round"></div>
        </div>`);
      const roundEl = document.getElementById('ww-math-round');
      const t0 = Date.now();
      renderKeypadRound(roundEl, { question: item.question }, { onSubmit: (value) => {
        const r = scoreMathSubmission({ value, item, activity });
        const disp = roundEl.querySelector('[data-display]');
        if (disp) disp.classList.add(r.correct ? 'is-ok' : 'is-no');
        if (!r.correct && item.answer != null) {
          const q = roundEl.querySelector('.ww-keypad-q');
          if (q) q.insertAdjacentHTML('beforeend', ` <b class="text-success">${escapeHtml(String(item.answer))}</b>`);
        }
        emitGame(r.correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, { idx });
        submit({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: Date.now() - t0 });
      } });
    },
  });
}
