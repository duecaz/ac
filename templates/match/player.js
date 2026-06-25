// Match player: drag a line from a left dot to the matching right dot.
// Supports text, images, or both per side.
import { html, mount, escapeHtml } from '../../core/html.js';
import { trySaveResult, applyPoints } from '../../core/results.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { FEEDBACK_DELAY } from '../../core/constants.js';
import { shuffle } from '../../core/roundRender.js';

export async function renderMatchPlayer(rootSel, activity, opts = {}) {
  const raw = (activity.content?.pairs || []).filter(p =>
    (String(p.left || '').trim() || p.leftImage || p.image) &&
    (String(p.right || '').trim() || p.rightImage)
  );
  if (!raw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene pares.</div>`);
    return;
  }

  const ppc = activity.scoring?.pointsPerCorrect || 1;
  const maxScore = activity.scoring?.maxScore || ppc * raw.length;
  const doShuffle = activity.rules?.randomize !== false;

  const lefts = (doShuffle ? shuffle : v => v)(
    raw.map(p => ({ id: p.id, text: p.left || '', image: p.leftImage || p.image || null }))
  );
  const rights = (doShuffle ? shuffle : v => v)(
    raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null }))
  );

  const state = {
    score: 0, mistakes: 0, startedAt: Date.now(),
    matched: new Set(), lines: [], dragging: null, wrongLine: null,
  };

  mount(rootSel, buildLayout(lefts, rights, activity, raw.length));

  const root = document.querySelector(rootSel);
  const arena = root.querySelector('.ww-match-arena');
  const svg   = root.querySelector('.ww-lines-svg');
  const scoreEl   = root.querySelector('.ww-score');
  const matchedEl = root.querySelector('.ww-matched');

  function updateHeader() {
    if (scoreEl)   scoreEl.textContent   = `★ ${state.score}`;
    if (matchedEl) matchedEl.textContent = `${state.matched.size} / ${raw.length}`;
  }

  function updateSvg() {
    let d = '';
    for (const line of state.lines) {
      const ld = root.querySelector(`.ww-dot[data-id="${line.id}"][data-side="L"]`);
      const rd = root.querySelector(`.ww-dot[data-id="${line.id}"][data-side="R"]`);
      if (!ld || !rd) continue;
      const p1 = dotSvgPos(ld, svg), p2 = dotSvgPos(rd, svg);
      const mx = (p1.x + p2.x) / 2;
      d += `<path d="M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}" stroke="#22c55e" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      d += `<circle cx="${p1.x}" cy="${p1.y}" r="6" fill="#22c55e"/><circle cx="${p2.x}" cy="${p2.y}" r="6" fill="#22c55e"/>`;
    }
    if (state.wrongLine) {
      const { x1, y1, x2, y2 } = state.wrongLine;
      const mx = (x1 + x2) / 2;
      d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="#ef4444" stroke-width="3" fill="none" stroke-dasharray="6 3"/>`;
      d += `<circle cx="${x1}" cy="${y1}" r="6" fill="#ef4444"/><circle cx="${x2}" cy="${y2}" r="6" fill="#ef4444"/>`;
    }
    if (state.dragging) {
      const { x1, y1, cx, cy } = state.dragging;
      const mx = (x1 + cx) / 2;
      d += `<circle cx="${x1}" cy="${y1}" r="8" fill="#6366f1" opacity="0.75"/>`;
      d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${cy} ${cx},${cy}" stroke="#6366f1" stroke-width="2.5" fill="none" stroke-dasharray="9 4"/>`;
    }
    svg.innerHTML = d;
  }

  function markMatched(id) {
    root.querySelectorAll(`.ww-card[data-id="${id}"]`).forEach(c => c.classList.add('ww-card-done'));
  }

  function flashWrong(fromId, toId) {
    [
      root.querySelector(`.ww-card[data-id="${fromId}"][data-side="L"]`),
      root.querySelector(`.ww-card[data-id="${toId}"][data-side="R"]`),
    ].filter(Boolean).forEach(c => {
      c.classList.add('ww-card-wrong');
      setTimeout(() => c.classList.remove('ww-card-wrong'), FEEDBACK_DELAY);
    });
  }

  // Drag: start on a left dot, release on a right dot.
  arena.addEventListener('pointerdown', e => {
    const dot = e.target.closest('.ww-dot');
    if (!dot || dot.dataset.side !== 'L' || state.matched.has(dot.dataset.id)) return;
    e.preventDefault();

    const pos = dotSvgPos(dot, svg);
    state.dragging = { fromId: dot.dataset.id, x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
    updateSvg();

    const onMove = ev => {
      if (!state.dragging) return;
      const p = clientToSvg(svg, ev.clientX, ev.clientY);
      state.dragging.cx = p.x; state.dragging.cy = p.y;
      updateSvg();
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', cleanup);
    };
    const onUp = ev => {
      const fromId = state.dragging?.fromId;
      const { x1, y1 } = state.dragging || {};
      state.dragging = null;
      cleanup();
      if (!fromId) { updateSvg(); return; }

      // Find the right-side dot at the drop position (traverse through SVG overlay).
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      const targetDot = els.find(el => el.classList?.contains('ww-dot') && el.dataset?.side === 'R');

      if (targetDot && !state.matched.has(targetDot.dataset.id)) {
        const toId  = targetDot.dataset.id;
        const pos2  = dotSvgPos(targetDot, svg);
        if (fromId === toId) {
          state.score = applyPoints(state.score, activity.scoring, true);
          state.matched.add(fromId);
          state.lines.push({ id: fromId });
          markMatched(fromId);
          updateSvg();
          updateHeader();
          if (state.matched.size >= raw.length) setTimeout(() => finish(), 700);
        } else {
          state.score   = applyPoints(state.score, activity.scoring, false);
          state.mistakes++;
          state.wrongLine = { x1, y1, x2: pos2.x, y2: pos2.y };
          flashWrong(fromId, toId);
          updateSvg();
          setTimeout(() => { state.wrongLine = null; updateSvg(); }, FEEDBACK_DELAY);
        }
      } else {
        updateSvg();
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', cleanup);
  });

  function finish() {
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    mount(rootSel, resultScreenHtml({
      title: '¡Completado!',
      lead: `Puntos: <b>${state.score}</b> / ${maxScore}`,
      stats: `${raw.length} pares · ${state.mistakes} fallos · ${timeUsed}s`,
    }));
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore, timeUsed });
    if (opts.onFinish) opts.onFinish({ score: state.score, startedAt: state.startedAt, mistakes: state.mistakes });
  }
}

function buildLayout(lefts, rights, activity, total) {
  return `<div class="ww-match p-3">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <span class="badge bg-secondary ww-matched">0 / ${total}</span>
    <span class="fw-bold text-truncate mx-2 small">${escapeHtml(activity.title || '')}</span>
    <span class="badge bg-primary ww-score">★ 0</span>
  </div>
  <div class="ww-match-arena">
    <div class="ww-col-left">${lefts.map(c => cardHtml(c, 'L')).join('')}</div>
    <svg class="ww-lines-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    <div class="ww-col-right">${rights.map(c => cardHtml(c, 'R')).join('')}</div>
  </div>
</div>`;
}

function cardHtml(c, side) {
  const img = c.image ? `<img src="${c.image}" alt="" loading="lazy">` : '';
  const lbl = c.text  ? `<span class="ww-card-label">${escapeHtml(c.text)}</span>` : '';
  return `<div class="ww-card" data-id="${escapeHtml(c.id)}" data-side="${side}">
  <span class="ww-dot" data-id="${escapeHtml(c.id)}" data-side="${side}"></span>
  ${img}${lbl}
</div>`;
}

function dotSvgPos(el, svg) {
  const er = el.getBoundingClientRect(), sr = svg.getBoundingClientRect();
  return { x: (er.left + er.right) / 2 - sr.left, y: (er.top + er.bottom) / 2 - sr.top };
}
function clientToSvg(svg, cx, cy) {
  const sr = svg.getBoundingClientRect();
  return { x: cx - sr.left, y: cy - sr.top };
}
