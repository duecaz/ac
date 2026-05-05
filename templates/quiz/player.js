// SOLO + LIVE-student player UI for the quiz template.
// Mode is determined by opts.mode = 'solo' | 'live-student'.
// In live-student mode, opts handles network calls (submit). In solo, scoring is local.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { saveResult } from '../../core/results.js';
import { FEEDBACK_DELAY } from '../../core/constants.js';
import { scoreQuizSubmission } from './scorer.js';

export async function renderQuizPlayer(rootSel, activity, opts = {}) {
  const items = (activity.rules?.randomize ? shuffle(activity.content.items.slice()) : activity.content.items).slice();
  const state = { idx: 0, score: 0, startedAt: Date.now(), answers: [] };

  function maxScore() {
    if (activity.scoring?.maxScore) return activity.scoring.maxScore;
    return (activity.scoring?.pointsPerCorrect || 1) * items.length;
  }

  function renderItem() {
    if (state.idx >= items.length) return finish();
    const item = items[state.idx];
    const opts2 = (item.options || []).slice();
    if (activity.rules?.shuffleOptions) shuffle(opts2);
    mount(rootSel, html`
      <div class="ww-player">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="badge bg-secondary">${state.idx + 1} / ${items.length}</span>
          <span class="badge bg-primary">★ ${state.score}</span>
        </div>
        <h3 class="mb-3">${escapeHtml(item.question)}</h3>
        ${item.image ? `<div class="text-center mb-3"><img src="${escapeHtml(item.image)}" class="img-fluid" style="max-height:240px"></div>` : ''}
        <div class="row g-2 ww-options">
          ${opts2.map(o => `<div class="col-6"><button class="btn btn-lg w-100 ww-opt" data-value="${escapeHtml(o)}">${escapeHtml(o)}</button></div>`).join('')}
        </div>
      </div>
    `);

    const t0 = Date.now();
    on(rootSel, 'click', '.ww-opt', (_, btn) => {
      if (btn.disabled) return;
      const ms = Date.now() - t0;
      const value = btn.dataset.value;
      const r = scoreQuizSubmission({ value, item, msTaken: ms, activity });
      state.score += r.points;
      state.answers.push({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: ms });
      document.querySelectorAll('.ww-opt').forEach(b => b.disabled = true);
      btn.classList.add(r.correct ? 'btn-success' : 'btn-danger');
      if (!r.correct && item.answer != null) {
        document.querySelectorAll('.ww-opt').forEach(b => {
          if (b.dataset.value === String(item.answer)) b.classList.add('btn-success');
        });
      }
      setTimeout(() => { state.idx++; renderItem(); }, FEEDBACK_DELAY);
    });
  }

  function finish() {
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    const max = maxScore();
    mount(rootSel, html`
      <div class="text-center py-5">
        <i class="bi bi-trophy-fill display-1 text-warning"></i>
        <h2 class="mt-3">¡Terminado!</h2>
        <p class="lead">Puntos: <b>${state.score}</b> / ${max}</p>
        <p class="text-muted">Tiempo: ${timeUsed}s</p>
        <a href="#/home" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a>
      </div>
    `);
    if (opts.mode !== 'async-tracked') {
      saveResult({ activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore: max, timeUsed });
    }
    if (opts.onFinish) opts.onFinish(state);
  }

  renderItem();
}

function shuffle(a){ for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]; } return a; }
