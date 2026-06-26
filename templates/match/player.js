// Match player: drag a rope from a left dot to the matching right dot.
// Results shown only at the end — no live score, like Wordwall.
import { html, mount, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { shuffle } from '../../core/roundRender.js';

// Rope color palette — one per matched pair
const ROPES = ['#f43f5e','#3b82f6','#f59e0b','#22c55e','#a855f7','#0891b2','#fb923c','#84cc16'];

export async function renderMatchPlayer(rootSel, activity, opts = {}) {
  const raw = (activity.content?.pairs || []).filter(p =>
    (String(p.left || '').trim() || p.leftImage || p.image) &&
    (String(p.right || '').trim() || p.rightImage)
  );
  if (!raw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene pares.</div>`);
    return;
  }

  const ppc    = activity.scoring?.pointsPerCorrect ?? 1;
  const ppw    = activity.scoring?.pointsPerWrong   ?? 0;
  const maxScore = activity.scoring?.maxScore || ppc * raw.length;
  const doShuffle = activity.rules?.randomize !== false;

  const lefts  = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
  const rights = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  const state = {
    mistakes: 0,
    matched:   new Set(),   // pair IDs confirmed
    lines:     [],          // { id, colorIdx } permanent ropes
    dragging:  null,        // { fromId, x1, y1, cx, cy }
    wrongLine: null,        // { x1,y1,x2,y2 } brief red flash
  };

  mount(rootSel, buildLayout(lefts, rights, activity, raw.length));

  const root       = document.querySelector(rootSel);
  const arena      = root.querySelector('.ww-match-arena');
  const svg        = root.querySelector('.ww-lines-svg');
  const progressEl = root.querySelector('.ww-matched');

  // Pre-paint the static SVG defs once.
  const filterId = 'rf' + Math.random().toString(36).slice(2, 6);
  svg.innerHTML = `<defs>
    <filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs><g class="ww-rope-layer"></g>`;
  const layer = svg.querySelector('.ww-rope-layer');

  function updateProgress() {
    if (progressEl) progressEl.textContent = `${state.matched.size} / ${raw.length}`;
  }

  function rope(curve, col) {
    // Two strokes: shadow behind + colour on top = rope depth effect
    return `<path d="${curve}" stroke="rgba(0,0,0,.22)" stroke-width="11" fill="none" stroke-linecap="round"/>`
         + `<path d="${curve}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }

  function updateSvg() {
    let d = '';

    // Permanent ropes
    for (const line of state.lines) {
      const ld = root.querySelector(`.ww-dot[data-id="${line.id}"][data-side="L"]`);
      const rd = root.querySelector(`.ww-dot[data-id="${line.id}"][data-side="R"]`);
      if (!ld || !rd) continue;
      const p1 = dotPos(ld, svg), p2 = dotPos(rd, svg);
      const mx = (p1.x + p2.x) / 2;
      const col = ROPES[line.colorIdx % ROPES.length];
      const curve = `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
      d += `<g filter="url(#${filterId})">${rope(curve, col)}</g>`;
      d += `<circle cx="${p1.x}" cy="${p1.y}" r="8" fill="${col}"/>`;
      d += `<circle cx="${p2.x}" cy="${p2.y}" r="8" fill="${col}"/>`;
    }

    // Wrong flash (red dashed, fades out via JS timeout)
    if (state.wrongLine) {
      const { x1, y1, x2, y2 } = state.wrongLine;
      const mx = (x1 + x2) / 2;
      d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" stroke="#ef4444" stroke-width="4" fill="none" stroke-dasharray="9 5" stroke-linecap="round" opacity=".9"/>`;
    }

    // Active drag rope (dashed, follows pointer)
    if (state.dragging) {
      const { x1, y1, cx, cy } = state.dragging;
      const mx = (x1 + cx) / 2;
      d += `<circle cx="${x1}" cy="${y1}" r="10" fill="#6366f1" opacity=".6"/>`;
      d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${cy} ${cx},${cy}" stroke="#6366f1" stroke-width="4.5" fill="none" stroke-dasharray="11 6" stroke-linecap="round" opacity=".75"/>`;
    }

    layer.innerHTML = d;
  }

  function markDone(id) {
    root.querySelectorAll(`.ww-card[data-id="${id}"]`).forEach(c => c.classList.add('ww-card-done'));
  }

  // ── Drag interaction ──────────────────────────────────────────────────────
  arena.addEventListener('pointerdown', e => {
    const dot = e.target.closest('.ww-dot');
    if (!dot || dot.dataset.side !== 'L' || state.matched.has(dot.dataset.id)) return;
    e.preventDefault();

    const pos = dotPos(dot, svg);
    state.dragging = { fromId: dot.dataset.id, x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
    updateSvg();

    const onMove = ev => {
      if (!state.dragging) return;
      const p = svgPt(svg, ev.clientX, ev.clientY);
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

      // elementsFromPoint skips SVG (pointer-events:none) and finds the dot beneath.
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      const hit = els.find(el => el.classList?.contains('ww-dot') && el.dataset?.side === 'R');

      if (hit && !state.matched.has(hit.dataset.id)) {
        const toId = hit.dataset.id;
        if (fromId === toId) {
          // ✓ Correct
          const colorIdx = state.lines.length;
          state.matched.add(fromId);
          state.lines.push({ id: fromId, colorIdx });
          markDone(fromId);
          updateSvg();
          updateProgress();
          if (state.matched.size >= raw.length) setTimeout(() => finish(), 750);
        } else {
          // ✗ Wrong — brief red line only, no card shake
          state.mistakes++;
          const p2 = dotPos(hit, svg);
          state.wrongLine = { x1, y1, x2: p2.x, y2: p2.y };
          updateSvg();
          setTimeout(() => { state.wrongLine = null; updateSvg(); }, 650);
        }
      } else {
        updateSvg();
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', cleanup);
  });

  // ── End screen ────────────────────────────────────────────────────────────
  function finish() {
    const score = Math.max(0, ppc * raw.length - ppw * state.mistakes);
    ctx.finish({
      title: '¡Completado!',
      lead:  `${raw.length} de ${raw.length} pares`,
      stats: ({ timeUsed }) => `${state.mistakes} error${state.mistakes !== 1 ? 'es' : ''} · ${timeUsed}s`,
      score,
      maxScore,
    });
  }
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildLayout(lefts, rights, activity, total) {
  return `<div class="ww-match p-3">
  <div class="d-flex align-items-center mb-3 gap-2">
    <span class="badge bg-secondary ww-matched flex-shrink-0">0 / ${total}</span>
    <span class="fw-bold text-truncate flex-grow-1 text-center small">${escapeHtml(activity.title || '')}</span>
    <span class="badge bg-secondary flex-shrink-0" style="visibility:hidden">0 / ${total}</span>
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

// ── SVG coordinate helpers ────────────────────────────────────────────────────

function dotPos(el, svg) {
  const er = el.getBoundingClientRect(), sr = svg.getBoundingClientRect();
  return { x: (er.left + er.right) / 2 - sr.left, y: (er.top + er.bottom) / 2 - sr.top };
}
function svgPt(svg, cx, cy) {
  const sr = svg.getBoundingClientRect();
  return { x: cx - sr.left, y: cy - sr.top };
}
