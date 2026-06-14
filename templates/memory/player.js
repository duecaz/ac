// Memory player: grid of face-down cards. Each pair contributes two cards
// (one with .left text, one with .right text), sharing pair.id. Flip 2 → if
// ids match, both stay; else they flip back after revealMs.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { saveResult, applyPoints } from '../../core/results.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { shuffle } from '../../core/roundRender.js';

export async function renderMemoryPlayer(rootSel, activity, opts = {}) {
  const pairs = (activity.content?.pairs || []).filter(p => String(p.left||'').trim() && String(p.right||'').trim());
  if (!pairs.length) { mount(rootSel, html`<div class="alert alert-warning m-4">Sin pares.</div>`); return; }

  const ppc = activity.scoring?.pointsPerCorrect || 1;
  const maxScore = activity.scoring?.maxScore || ppc * pairs.length;
  const revealMs = activity.rules?.revealMs ?? 900;
  const columns = Math.max(2, Math.min(8, activity.rules?.columns || 4));

  // Build deck: 2 cards per pair.
  const deck = shuffle(pairs.flatMap(p => [
    { cardId: p.id + ':L', pairId: p.id, text: p.left },
    { cardId: p.id + ':R', pairId: p.id, text: p.right }
  ]));

  const state = {
    score: 0,
    matched: 0,
    mistakes: 0,
    flips: 0,
    startedAt: Date.now(),
    open: [],            // currently face-up (and not yet matched)
    locked: new Set(),   // matched cardIds (stay open)
    busy: false
  };

  function paint() {
    mount(rootSel, html`
      <div class="ww-memory">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="badge bg-secondary">${state.matched} / ${pairs.length}</span>
          <span class="badge bg-info text-dark">Flips: ${state.flips}</span>
          <span class="badge bg-primary">★ ${state.score}</span>
        </div>
        <h5 class="text-center mb-3">${escapeHtml(activity.title)}</h5>
        <div class="ww-memo-grid" style="grid-template-columns:repeat(${columns},1fr)">
          ${deck.map(c => {
            const isOpen = state.open.includes(c.cardId);
            const isLocked = state.locked.has(c.cardId);
            const showFace = isOpen || isLocked;
            const cls = isLocked ? 'mc-locked' : isOpen ? 'mc-open' : '';
            return `<button class="mc ${cls}" data-id="${escapeHtml(c.cardId)}" ${isLocked?'disabled':''}>
              ${showFace ? `<span class="mc-text">${escapeHtml(c.text)}</span>` : '<i class="bi bi-question-lg"></i>'}
            </button>`;
          }).join('')}
        </div>
      </div>
    `);
    on(rootSel, 'click', '.mc', (_, btn) => onFlip(btn.dataset.id));
  }

  function onFlip(cardId) {
    if (state.busy) return;
    if (state.locked.has(cardId)) return;
    if (state.open.includes(cardId)) return;
    state.open.push(cardId);
    state.flips += 1;
    paint();
    if (state.open.length === 2) {
      const [a, b] = state.open;
      const pa = a.split(':')[0], pb = b.split(':')[0];
      if (pa === pb && a !== b) {
        state.locked.add(a); state.locked.add(b);
        state.matched += 1;
        state.score = applyPoints(state.score, activity.scoring, true);
        state.open = [];
        paint();
        if (state.matched >= pairs.length) finish();
      } else {
        state.busy = true;
        state.score = applyPoints(state.score, activity.scoring, false);
        state.mistakes += 1;
        setTimeout(() => { state.open = []; state.busy = false; paint(); }, revealMs);
      }
    }
  }

  function finish() {
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    mount(rootSel, resultScreenHtml({ title: '¡Memorizado!', lead: `Puntos: <b>${state.score}</b> / ${maxScore}`, stats: `${pairs.length} pares · ${state.flips} flips · ${state.mistakes} fallos · ${timeUsed}s` }));
    if (opts.mode !== 'async-tracked') {
      saveResult({ activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore, timeUsed });
    }
    if (opts.onFinish) opts.onFinish({ score: state.score, startedAt: state.startedAt, mistakes: state.mistakes });
  }

  paint();
}
