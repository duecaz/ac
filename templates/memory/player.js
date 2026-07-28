// Memory player: grid of face-down cards. Each pair contributes two cards
// (one with .left text, one with .right text), sharing pair.id. Flip 2 → if
// ids match, both stay; else they flip back after revealMs.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { applyPoints } from '../../core/results.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { shuffle } from '../../core/roundRender.js';

export async function renderMemoryPlayer(rootSel, activity, opts = {}) {
  const pairs = (activity.content?.pairs || []).filter(p => String(p.left||'').trim() && String(p.right||'').trim());
  if (!pairs.length) { mount(rootSel, html`<div class="alert alert-warning m-4">Sin pares.</div>`); return; }

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  const ppc = activity.scoring?.pointsPerCorrect || 1;
  const maxScore = activity.scoring?.maxScore || ppc * pairs.length;
  const revealMs = activity.rules?.revealMs ?? 900;
  const columns = Math.max(2, Math.min(8, activity.rules?.columns || 4));

  // Todas las cartas (2 por par), en orden canónico. El mazo se baraja al montar,
  // salvo que haya progreso guardado (F5): entonces se recompone ese mismo orden.
  const allCards = pairs.flatMap(p => [
    { cardId: p.id + ':L', pairId: p.id, text: p.left },
    { cardId: p.id + ':R', pairId: p.id, text: p.right }
  ]);
  const saved = ctx.loadProgress();
  let deck = null, restored = false;
  if (saved && Array.isArray(saved.deckIds) && saved.deckIds.length === allCards.length && Array.isArray(saved.locked)) {
    const byId = new Map(allCards.map(c => [c.cardId, c]));
    const ordered = saved.deckIds.map(id => byId.get(id));
    if (ordered.every(Boolean)) { deck = ordered; restored = true; } // orden y cartas coherentes
  }
  if (!deck) deck = shuffle(allCards.slice());

  const state = {
    score: 0, matched: 0, mistakes: 0, flips: 0,
    open: [],            // currently face-up (and not yet matched)
    locked: new Set(),   // matched cardIds (stay open)
    busy: false
  };
  if (restored) {
    state.score = saved.score || 0;
    state.matched = saved.matched || 0;
    state.mistakes = saved.mistakes || 0;
    state.flips = saved.flips || 0;
    state.locked = new Set(saved.locked);
  }

  const snapshot = () => ({
    deckIds: deck.map(c => c.cardId), locked: [...state.locked],
    score: state.score, matched: state.matched, flips: state.flips, mistakes: state.mistakes,
  });

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
        else ctx.saveProgress(snapshot()); // estado estable → reanudable
      } else {
        state.busy = true;
        state.score = applyPoints(state.score, activity.scoring, false);
        state.mistakes += 1;
        setTimeout(() => { state.open = []; state.busy = false; paint(); ctx.saveProgress(snapshot()); }, revealMs);
      }
    }
  }

  function finish() {
    ctx.finish({
      title: '¡Memorizado!',
      lead: `Puntos: <b>${state.score}</b> / ${maxScore}`,
      stats: ({ timeUsed }) => `${pairs.length} pares · ${state.flips} flips · ${state.mistakes} fallos · ${timeUsed}s`,
      score: state.score,
      maxScore,
    });
  }

  paint();
}
