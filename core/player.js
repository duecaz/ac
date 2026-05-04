// SOLO-mode Player: drives a single-device run of an activity.
import { getTemplate } from './registry.js';
import { html, escapeHtml, mount } from './html.js';
import { on } from './events.js';
import { saveResult } from './results.js';
import { FEEDBACK_DELAY } from './constants.js';

export async function runPlayer(rootSel, activity, opts = {}) {
  const tpl = getTemplate(activity.template);
  if (!tpl) throw new Error(`Plantilla desconocida: ${activity.template}`);
  const items = (activity.rules?.randomize ? shuffle(activity.content.items) : activity.content.items).slice();
  const state = { idx: 0, score: 0, startedAt: Date.now(), answers: [] };

  function maxScore() {
    if (activity.scoring?.maxScore) return activity.scoring.maxScore;
    return (activity.scoring?.pointsPerCorrect || 1) * items.length;
  }

  async function renderItem() {
    if (state.idx >= items.length) return finish();
    const item = items[state.idx];
    const payload = tpl.getItemPayload(item, activity.rules);
    mount(rootSel, html`
      <div class="ww-player">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <div><span class="badge bg-secondary">${state.idx + 1} / ${items.length}</span></div>
          <div><span class="badge bg-primary">★ ${state.score}</span></div>
        </div>
        <h3 class="mb-3">${escapeHtml(payload.question)}</h3>
        ${payload.image ? `<img src="${escapeHtml(payload.image)}" class="img-fluid mb-3" alt="">` : ''}
        <div class="row g-2 ww-options">
          ${payload.options.map((o, i) => `
            <div class="col-6"><button class="btn btn-lg w-100 ww-opt" data-value="${escapeHtml(o)}" data-i="${i}">${escapeHtml(o)}</button></div>
          `).join('')}
        </div>
      </div>
    `);

    const t0 = Date.now();
    on(rootSel, 'click', '.ww-opt', (e, btn) => {
      if (btn.disabled) return;
      const ms = Date.now() - t0;
      const value = btn.dataset.value;
      const r = tpl.scoreAnswer(value, item, ms, null);
      state.score += r.points;
      state.answers.push({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: ms });
      // Visual feedback.
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

  async function finish() {
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
    saveResult({
      activityId: activity.id,
      scoreAuto: state.score, scoreFinal: state.score,
      maxScore: max, timeUsed
    });
    if (opts.onFinish) opts.onFinish(state);
  }

  renderItem();
}

function shuffle(a) { const x = a.slice(); for (let i = x.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); [x[i],x[j]] = [x[j],x[i]]; } return x; }
