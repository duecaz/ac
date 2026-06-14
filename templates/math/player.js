// SOLO / async player for Operaciones: iterate items with a numeric keypad.
import { html, escapeHtml, mount } from '../../core/html.js';
import { renderKeypadRound, shuffle } from '../../core/roundRender.js';
import { scoreMathSubmission } from './scorer.js';
import { trySaveResult } from '../../core/results.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { FEEDBACK_DELAY } from '../../core/constants.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';

export async function renderMathPlayer(rootSel, activity, opts = {}) {
  const items = (activity.rules?.randomize ? shuffle(activity.content.items.slice()) : activity.content.items).slice();
  const state = { idx: 0, score: 0, startedAt: Date.now(), answers: [] };
  const maxScore = () => activity.scoring?.maxScore || ((activity.scoring?.pointsPerCorrect || 1) * items.length);

  function renderItem() {
    if (state.idx >= items.length) return finish();
    const item = items[state.idx];
    emitGame(GameEvents.QUESTION_SHOWN, { idx: state.idx, total: items.length, item });
    mount(rootSel, html`
      <div class="ww-player ww-math">
        <div class="ww-phead d-flex justify-content-between align-items-center">
          <span class="badge bg-secondary">${state.idx + 1} / ${items.length}</span>
          <span class="badge bg-primary">&#9733; ${state.score}</span>
        </div>
        <div id="ww-math-round" class="ww-math-round"></div>
      </div>`);
    const roundEl = document.getElementById('ww-math-round');
    const t0 = Date.now();
    renderKeypadRound(roundEl, { question: item.question }, { onSubmit: (value) => {
      const r = scoreMathSubmission({ value, item, activity });
      state.score += r.points;
      state.answers.push({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: Date.now() - t0 });
      const disp = roundEl.querySelector('[data-display]');
      if (disp) disp.classList.add(r.correct ? 'is-ok' : 'is-no');
      if (!r.correct && item.answer != null) {
        const q = roundEl.querySelector('.ww-keypad-q');
        if (q) q.insertAdjacentHTML('beforeend', ` <b class="text-success">${escapeHtml(String(item.answer))}</b>`);
      }
      emitGame(r.correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, { idx: state.idx });
      setTimeout(() => { state.idx++; renderItem(); }, FEEDBACK_DELAY);
    } });
  }

  function finish() {
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    const max = maxScore();
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    mount(rootSel, resultScreenHtml({ title: '¡Terminado!', lead: `Puntos: <b>${state.score}</b> / ${max}`, stats: `Tiempo: ${timeUsed}s` }));
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore: max, timeUsed });
    if (opts.onFinish) opts.onFinish(state);
  }

  renderItem();
}
