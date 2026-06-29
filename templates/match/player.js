// Match player: arrastra una cuerda entre dos ítems para emparejarlos.
// EMPAREJADO LIBRE: conectar NO califica — el alumno une todos los pares (puede
// cambiar o quitar conexiones) y pulsa "Enviar"; recién ahí se corrige y puntúa.
// La zona de arrastre es TODA la tarjeta (no solo el punto), en cualquier lado.
import { html, mount, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { shuffle } from '../../core/roundRender.js';

// Paleta neutra para las cuerdas mientras se empareja (antes de corregir).
const ROPES = ['#6366f1','#0891b2','#a855f7','#f59e0b','#0ea5e9','#ec4899','#14b8a6','#8b5cf6'];
const OK_COL = '#16a34a', NO_COL = '#ef4444';
const SAG = 16;   // px que "cuelga" la cuerda (evita bbox de alto 0 → filtro/línea visible)

export async function renderMatchPlayer(rootSel, activity, opts = {}) {
  const raw = (activity.content?.pairs || []).filter(p =>
    (String(p.left || '').trim() || p.leftImage || p.image) &&
    (String(p.right || '').trim() || p.rightImage)
  );
  if (!raw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene pares.</div>`);
    return;
  }

  const ppc      = activity.scoring?.pointsPerCorrect ?? 1;
  const ppw      = activity.scoring?.pointsPerWrong   ?? 0;
  const maxScore = activity.scoring?.maxScore || ppc * raw.length;
  const doShuffle = activity.rules?.randomize !== false;

  const lefts  = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
  const rights = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  const state = {
    links:    new Map(),  // leftId → rightId (emparejados por el alumno; cambiables)
    dragging: null,       // { fromSide, fromId, x1, y1, cx, cy }
    graded:   false,      // true tras pulsar Enviar
  };

  mount(rootSel, buildLayout(lefts, rights, activity, raw.length));

  const root       = document.querySelector(rootSel);
  const arena      = root.querySelector('.ww-match-arena');
  const svg        = root.querySelector('.ww-lines-svg');
  const progressEl = root.querySelector('.ww-matched');
  const submitBtn  = root.querySelector('.ww-match-submit');

  // Defs (sombra de cuerda) una sola vez.
  const filterId = 'rf' + Math.random().toString(36).slice(2, 6);
  svg.innerHTML = `<defs>
    <filter id="${filterId}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs><g class="ww-rope-layer"></g>`;
  const layer = svg.querySelector('.ww-rope-layer');

  function updateProgress() {
    if (progressEl) progressEl.textContent = `${state.links.size} / ${raw.length}`;
  }
  function updateSubmit() {
    if (submitBtn) submitBtn.disabled = state.graded || state.links.size < raw.length;
  }

  function rope(curve, col) {
    return `<path d="${curve}" stroke="rgba(0,0,0,.22)" stroke-width="11" fill="none" stroke-linecap="round"/>`
         + `<path d="${curve}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }

  function updateSvg() {
    let d = '';
    let i = 0;
    for (const [leftId, rightId] of state.links) {
      const ld = root.querySelector(`.ww-dot[data-id="${leftId}"][data-side="L"]`);
      const rd = root.querySelector(`.ww-dot[data-id="${rightId}"][data-side="R"]`);
      if (!ld || !rd) { i++; continue; }
      const p1 = dotPos(ld, svg), p2 = dotPos(rd, svg);
      const mx = (p1.x + p2.x) / 2;
      const col = state.graded ? (leftId === rightId ? OK_COL : NO_COL) : ROPES[i % ROPES.length];
      // La cuerda CUELGA un poco (sag): así una unión horizontal NO tiene bounding
      // box de altura 0 — el filtro de sombra (región en % del bbox) colapsaría a
      // cero y la línea quedaría INVISIBLE. Además se ve más natural (cuerda real).
      const curve = `M${p1.x},${p1.y} C${mx},${p1.y + SAG} ${mx},${p2.y + SAG} ${p2.x},${p2.y}`;
      d += `<g filter="url(#${filterId})">${rope(curve, col)}</g>`;
      d += `<circle cx="${p1.x}" cy="${p1.y}" r="8" fill="${col}"/>`;
      d += `<circle cx="${p2.x}" cy="${p2.y}" r="8" fill="${col}"/>`;
      i++;
    }
    if (state.dragging) {
      const { x1, y1, cx, cy } = state.dragging;
      const mx = (x1 + cx) / 2;
      d += `<circle cx="${x1}" cy="${y1}" r="10" fill="#6366f1" opacity=".6"/>`;
      d += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${cy} ${cx},${cy}" stroke="#6366f1" stroke-width="4.5" fill="none" stroke-dasharray="11 6" stroke-linecap="round" opacity=".75"/>`;
    }
    layer.innerHTML = d;
  }

  // Conecta (o reconecta) un par. Cada tarjeta participa en UNA sola cuerda:
  // se elimina cualquier enlace previo que use ese mismo left o ese mismo right.
  function setLink(leftId, rightId) {
    state.links.delete(leftId);
    for (const [l, r] of [...state.links]) if (r === rightId) state.links.delete(l);
    state.links.set(leftId, rightId);
    refreshCards();
    updateSvg(); updateProgress(); updateSubmit();
  }
  function removeByCard(side, id) {
    if (side === 'L') state.links.delete(id);
    else for (const [l, r] of [...state.links]) if (r === id) state.links.delete(l);
    refreshCards();
    updateSvg(); updateProgress(); updateSubmit();
  }
  // Marca visualmente qué tarjetas están conectadas (sin decir si es correcto).
  function refreshCards() {
    const linkedL = new Set(state.links.keys());
    const linkedR = new Set(state.links.values());
    root.querySelectorAll('.ww-card').forEach(c => {
      const on = c.dataset.side === 'L' ? linkedL.has(c.dataset.id) : linkedR.has(c.dataset.id);
      c.classList.toggle('ww-card-linked', on);
    });
  }

  // Tarjeta destino al soltar. Lógica por COLUMNA + altura (robusta, sin depender
  // de acertar el rectángulo exacto): si el punto cayó del lado de la columna
  // OPUESTA, conecta con la tarjeta de esa columna más cercana por ALTURA (siempre
  // hay una → de frente u horizontal NUNCA falla). Si soltó de vuelta hacia el
  // origen (cruzó menos del medio), devuelve null → desconecta.
  function targetCard(x, y, fromSide) {
    const side = fromSide === 'L' ? 'R' : 'L';
    const cards = [...root.querySelectorAll(`.ww-card[data-side="${side}"]`)];
    if (!cards.length) return null;
    const colL = root.querySelector('.ww-col-left').getBoundingClientRect();
    const colR = root.querySelector('.ww-col-right').getBoundingClientRect();
    const mid = (colL.right + colR.left) / 2;            // centro del corredor
    const onTargetSide = side === 'R' ? x >= mid : x <= mid;
    if (!onTargetSide) return null;                       // soltó hacia el origen → desconectar
    let best = null, bestD = Infinity;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // ── Arrastre desde TODA la tarjeta (cualquier lado → el opuesto) ────────────
  // Con setPointerCapture: todos los pointermove/up van a la arena aunque el dedo
  // cruce el corredor o salga de la tarjeta, y el navegador NO roba el gesto como
  // scroll (clave en tablets/pizarra). touch-action:none lo refuerza desde CSS.
  arena.addEventListener('pointerdown', e => {
    if (state.graded || state.dragging) return;
    if (e.target.closest('.ww-match-submit')) return;
    const card = e.target.closest('.ww-card');
    if (!card) return;
    e.preventDefault();
    const dot = card.querySelector('.ww-dot');
    const pos = dotPos(dot, svg);
    state.dragging = { pointerId: e.pointerId, fromSide: card.dataset.side, fromId: card.dataset.id,
                       x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
    try { arena.setPointerCapture(e.pointerId); } catch {}
    updateSvg();
  });

  arena.addEventListener('pointermove', e => {
    const drag = state.dragging;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = svgPt(svg, e.clientX, e.clientY);
    drag.cx = p.x; drag.cy = p.y;
    updateSvg();
  });

  function endDrag(e, connect) {
    const drag = state.dragging;
    if (!drag || e.pointerId !== drag.pointerId) return;
    state.dragging = null;
    try { arena.releasePointerCapture(e.pointerId); } catch {}
    if (!connect) { updateSvg(); return; }
    const hit = targetCard(e.clientX, e.clientY, drag.fromSide);
    if (hit) {
      const leftId  = drag.fromSide === 'L' ? drag.fromId : hit.dataset.id;
      const rightId = drag.fromSide === 'L' ? hit.dataset.id : drag.fromId;
      setLink(leftId, rightId);
    } else {
      removeByCard(drag.fromSide, drag.fromId);   // soltar en vacío: desconectar
    }
  }
  arena.addEventListener('pointerup', e => endDrag(e, true));
  arena.addEventListener('pointercancel', e => endDrag(e, false));

  // ── Enviar → corregir y puntuar ─────────────────────────────────────────────
  submitBtn?.addEventListener('click', () => {
    if (state.graded || state.links.size < raw.length) return;
    state.graded = true;
    let correct = 0;
    for (const [l, r] of state.links) if (l === r) correct++;
    const wrong = state.links.size - correct;
    const score = Math.max(0, ppc * correct - ppw * wrong);
    // Pintar cuerdas + tarjetas según corrección.
    root.querySelectorAll('.ww-card').forEach(c => {
      const id = c.dataset.id, side = c.dataset.side;
      const linkOk = side === 'L'
        ? state.links.get(id) === id
        : [...state.links].some(([l, r]) => r === id && l === id);
      c.classList.remove('ww-card-linked');
      c.classList.add(linkOk ? 'ww-card-correct' : 'ww-card-wrong');
    });
    updateSvg();
    submitBtn.disabled = true;
    setTimeout(() => ctx.finish({
      title: correct === raw.length ? '¡Perfecto!' : 'Resultado',
      lead:  `${correct} de ${raw.length} correctas`,
      stats: ({ timeUsed }) => `${wrong} error${wrong !== 1 ? 'es' : ''} · ${timeUsed}s`,
      score, maxScore,
    }), 1100);
  });

  updateProgress();
  updateSubmit();
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
  <div class="text-center mt-3">
    <button type="button" class="btn btn-success btn-lg px-5 ww-match-submit" disabled>
      <i class="bi bi-check2-circle"></i> Enviar
    </button>
  </div>
</div>`;
}

function cardHtml(c, side) {
  const hasImg = !!c.image;
  const img = hasImg ? `<img src="${c.image}" alt="" loading="lazy">` : '';
  const lbl = c.text ? `<span class="ww-card-label">${escapeHtml(c.text)}</span>` : '';
  return `<div class="ww-card${hasImg ? ' ww-card-img' : ''}" data-id="${escapeHtml(c.id)}" data-side="${side}">
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
