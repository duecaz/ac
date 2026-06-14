// Match player: two shuffled columns. Tap a left card, then a right card.
// Correct → both consumed (fade out) + points. Wrong → brief red flash, reset.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { trySaveResult, applyPoints } from '../../core/results.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { FEEDBACK_DELAY } from '../../core/constants.js';
import { shuffle } from '../../core/roundRender.js';

export async function renderMatchPlayer(rootSel, activity, opts = {}) {
  const all = (activity.content?.pairs || []).filter(p => String(p.left||'').trim() && String(p.right||'').trim());
  if (!all.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene pares.</div>`);
    return;
  }

  const ppc = activity.scoring?.pointsPerCorrect || 1;
  const maxScore = activity.scoring?.maxScore || ppc * all.length;

  const state = {
    score: 0,
    matched: 0,
    mistakes: 0,
    startedAt: Date.now(),
    selectedLeft: null,
    selectedRight: null,
    busy: false,
    consumed: new Set(),  // pair IDs already matched
    lefts: shuffle(all.map(p => ({ id: p.id, text: p.left }))),
    rights: shuffle(all.map(p => ({ id: p.id, text: p.right })))
  };

  function paint(flash) {
    mount(rootSel, html`
      <div class="ww-match">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="badge bg-secondary">${state.matched} / ${all.length}</span>
          <span class="badge bg-primary">★ ${state.score}</span>
        </div>
        <h4 class="text-center mb-4">${escapeHtml(activity.title)}</h4>
        <div class="row g-2">
          <div class="col-6">
            ${state.lefts.map(c => cardHtml('L', c, state, flash)).join('')}
          </div>
          <div class="col-6">
            ${state.rights.map(c => cardHtml('R', c, state, flash)).join('')}
          </div>
        </div>
      </div>
    `);

    on(rootSel, 'click', '.ww-card', (_, btn) => {
      if (state.busy) return;
      const side = btn.dataset.side;
      const id = btn.dataset.id;
      if (state.consumed.has(id) && wasFromMatched(side, id)) return;
      if (side === 'L') { state.selectedLeft = id; }
      else { state.selectedRight = id; }
      // Try resolve when both selected.
      if (state.selectedLeft && state.selectedRight) {
        state.busy = true;
        if (state.selectedLeft === state.selectedRight) {
          state.score = applyPoints(state.score, activity.scoring, true);
          state.matched += 1;
          state.consumed.add(state.selectedLeft);
          paint();
          state.selectedLeft = null; state.selectedRight = null; state.busy = false;
          if (state.matched >= all.length) finish();
        } else {
          state.score = applyPoints(state.score, activity.scoring, false);
          state.mistakes += 1;
          paint('wrong');
          setTimeout(() => {
            state.selectedLeft = null; state.selectedRight = null; state.busy = false;
            paint();
          }, FEEDBACK_DELAY);
        }
      } else {
        paint();
      }
    });
  }

  function wasFromMatched(side, id) {
    return state.consumed.has(id);
  }

  function finish() {
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    mount(rootSel, resultScreenHtml({ title: '¡Completado!', lead: `Puntos: <b>${state.score}</b> / ${maxScore}`, stats: `${all.length} pares · ${state.mistakes} fallos · ${timeUsed}s` }));
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore, timeUsed });
    if (opts.onFinish) opts.onFinish({ score: state.score, startedAt: state.startedAt, mistakes: state.mistakes });
  }

  paint();
}

function cardHtml(side, c, state, flash) {
  const consumed = state.consumed.has(c.id);
  const selected = (side === 'L' ? state.selectedLeft : state.selectedRight) === c.id;
  const wrong = flash === 'wrong' && selected;
  const cls = consumed ? 'ww-card-done' : wrong ? 'ww-card-wrong' : selected ? 'ww-card-sel' : '';
  return `<button type="button" class="ww-card btn w-100 mb-2 text-start ${cls}" data-side="${side}" data-id="${escapeHtml(c.id)}" ${consumed?'disabled':''}>
    ${escapeHtml(c.text)}
  </button>`;
}
