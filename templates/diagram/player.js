// Diagram player: arrastra cada ETIQUETA a su PIN sobre la imagen (Wordwall
// "Etiqueta el diagrama"). Emparejado libre (no califica hasta pulsar Enviar);
// las etiquetas se reparten izq/der alrededor de la imagen; los pines viven a
// (x,y) sobre ella. Reutiliza el motor de cuerdas core/connectRope.js.
import { html, mount, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { shuffle } from '../../core/roundRender.js';
import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt } from '../../core/connectRope.js';

export async function renderDiagramPlayer(rootSel, activity, opts = {}) {
  const pins = (activity.content?.pins || []).filter(p => p && p.id && String(p.label || '').trim());
  const image = activity.content?.image || null;
  if (!image || !pins.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene imagen o pines.</div>`);
    return;
  }

  const ppc      = activity.scoring?.pointsPerCorrect ?? 1;
  const ppw      = activity.scoring?.pointsPerWrong   ?? 0;
  const maxScore = activity.scoring?.maxScore || ppc * pins.length;
  const doShuffle = activity.rules?.randomize !== false;

  // Etiquetas repartidas izquierda/derecha por orden (como Wordwall).
  const labels = (doShuffle ? shuffle([...pins]) : [...pins]).map(p => ({ id: p.id, text: p.label }));
  const half = Math.ceil(labels.length / 2);
  const leftLabels = labels.slice(0, half), rightLabels = labels.slice(half);

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  const state = { links: new Map(), dragging: null, graded: false };  // links: labelId → pinId

  mount(rootSel, buildLayout(leftLabels, rightLabels, pins, image, activity, pins.length));

  const root       = document.querySelector(rootSel);
  const arena      = root.querySelector('.dg-arena');
  const svg        = root.querySelector('.ww-lines-svg');
  const progressEl = root.querySelector('.dg-progress');
  const submitBtn  = root.querySelector('.dg-submit');
  const { layer, filterId } = mountRopeLayer(svg);

  const updateProgress = () => { if (progressEl) progressEl.textContent = `${state.links.size} / ${pins.length}`; };
  const updateSubmit   = () => { if (submitBtn) submitBtn.disabled = state.graded || state.links.size < pins.length; };

  function updateSvg() {
    let d = '', i = 0;
    for (const [labelId, pinId] of state.links) {
      const ld = root.querySelector(`.ww-dot[data-id="${labelId}"]`);
      const pd = root.querySelector(`.dg-pin[data-id="${pinId}"]`);
      if (ld && pd) {
        const col = state.graded ? (labelId === pinId ? OK_COL : NO_COL) : ROPES[i % ROPES.length];
        d += ropeHtml(dotPos(ld, svg), dotPos(pd, svg), col, filterId);
      }
      i++;
    }
    if (state.dragging) { const { x1, y1, cx, cy } = state.dragging; d += ghostHtml(x1, y1, cx, cy); }
    layer.innerHTML = d;
  }

  // Un enlace por etiqueta Y por pin: al conectar, se sueltan los previos que usen
  // ese mismo labelId o ese mismo pinId (reconexión libre, como Emparejar).
  function setLink(labelId, pinId) {
    state.links.delete(labelId);
    for (const [l, p] of [...state.links]) if (p === pinId) state.links.delete(l);
    state.links.set(labelId, pinId);
    refresh();
  }
  function removeByLabel(labelId) { state.links.delete(labelId); refresh(); }
  function removeByPin(pinId) { for (const [l, p] of [...state.links]) if (p === pinId) state.links.delete(l); refresh(); }
  function refresh() {
    const linkedLabels = new Set(state.links.keys());
    const linkedPins = new Set(state.links.values());
    root.querySelectorAll('.dg-label').forEach(c => c.classList.toggle('dg-linked', linkedLabels.has(c.dataset.id)));
    root.querySelectorAll('.dg-pin').forEach(c => c.classList.toggle('dg-linked', linkedPins.has(c.dataset.id)));
    updateSvg(); updateProgress(); updateSubmit();
  }

  // Destino al soltar: el elemento del TIPO OPUESTO más cercano en 2D, dentro de
  // un radio máximo (soltar lejos = desconectar). Robusto y directo.
  function nearest(sel, clientX, clientY, maxDist) {
    let best = null, bestD = Infinity;
    root.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.right) / 2 - clientX, dy = (r.top + r.bottom) / 2 - clientY;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = el; }
    });
    return (best && Math.sqrt(bestD) <= maxDist) ? best : null;
  }

  arena.addEventListener('pointerdown', e => {
    if (state.graded || state.dragging) return;
    const label = e.target.closest('.dg-label');
    const pin   = e.target.closest('.dg-pin');
    const from  = label || pin;
    if (!from) return;
    e.preventDefault();
    const dotEl = label ? label.querySelector('.ww-dot') : pin;
    const pos = dotPos(dotEl, svg);
    state.dragging = { pointerId: e.pointerId, kind: label ? 'label' : 'pin', fromId: from.dataset.id, x1: pos.x, y1: pos.y, cx: pos.x, cy: pos.y };
    try { arena.setPointerCapture(e.pointerId); } catch {}
    updateSvg();
  });
  arena.addEventListener('pointermove', e => {
    const drag = state.dragging;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = svgPt(svg, e.clientX, e.clientY);
    drag.cx = p.x; drag.cy = p.y; updateSvg();
  });
  function endDrag(e, connect) {
    const drag = state.dragging;
    if (!drag || e.pointerId !== drag.pointerId) return;
    state.dragging = null;
    try { arena.releasePointerCapture(e.pointerId); } catch {}
    if (!connect) return updateSvg();
    const radius = Math.max(48, arena.getBoundingClientRect().width * 0.12);
    if (drag.kind === 'label') {
      const hit = nearest('.dg-pin', e.clientX, e.clientY, radius);
      if (hit) setLink(drag.fromId, hit.dataset.id); else removeByLabel(drag.fromId);
    } else {
      const hit = nearest('.dg-label', e.clientX, e.clientY, radius);
      if (hit) setLink(hit.dataset.id, drag.fromId); else removeByPin(drag.fromId);
    }
  }
  arena.addEventListener('pointerup', e => endDrag(e, true));
  arena.addEventListener('pointercancel', e => endDrag(e, false));

  submitBtn?.addEventListener('click', () => {
    if (state.graded || state.links.size < pins.length) return;
    state.graded = true;
    let correct = 0;
    for (const [l, p] of state.links) if (l === p) correct++;
    const wrong = state.links.size - correct;
    const score = Math.max(0, ppc * correct - ppw * wrong);
    root.querySelectorAll('.dg-label, .dg-pin').forEach(c => {
      const ok = c.classList.contains('dg-label')
        ? state.links.get(c.dataset.id) === c.dataset.id
        : [...state.links].some(([l, p]) => p === c.dataset.id && l === c.dataset.id);
      c.classList.remove('dg-linked');
      c.classList.add(ok ? 'dg-correct' : 'dg-wrong');
    });
    updateSvg();
    submitBtn.disabled = true;
    setTimeout(() => ctx.finish({
      title: correct === pins.length ? '¡Perfecto!' : 'Resultado',
      lead:  `${correct} de ${pins.length} correctas`,
      stats: ({ timeUsed }) => `${wrong} error${wrong !== 1 ? 'es' : ''} · ${timeUsed}s`,
      score, maxScore,
    }), 1100);
  });

  // Ajusta la CAJA de la imagen a su tamaño CONTENIDO (preserva aspecto, sin
  // letterbox) → los pines, posicionados en %, caen exactos sobre la imagen.
  const imgEl = root.querySelector('.dg-img');
  const boxEl = root.querySelector('.dg-img-box');
  const stageEl = root.querySelector('.dg-stage');
  function fitImageBox() {
    if (!imgEl || !boxEl || !stageEl) return false;
    const nw = imgEl.naturalWidth || 4, nh = imgEl.naturalHeight || 3;
    const sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    if (!sw || !sh) return false;
    const scale = Math.min(sw / nw, sh / nh);
    const w = Math.max(1, Math.round(nw * scale)) + 'px', h = Math.max(1, Math.round(nh * scale)) + 'px';
    if (boxEl.style.width === w && boxEl.style.height === h) return false;  // guarda: no re-disparar el RO
    boxEl.style.width = w; boxEl.style.height = h;
    return true;
  }
  // rAF + guarda evitan el "ResizeObserver loop completed with undelivered
  // notifications" (redimensionar la caja dentro del callback lo re-disparaba).
  let raf = 0;
  const relayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { fitImageBox(); updateSvg(); }); };
  relayout();
  const ro = new ResizeObserver(relayout);
  ro.observe(stageEl);   // el stage no cambia de tamaño al redimensionar la caja (descendiente)
  if (imgEl && !imgEl.complete) imgEl.addEventListener('load', relayout);

  updateProgress(); updateSubmit();
}

// ── HTML ──────────────────────────────────────────────────────────────────────
function labelHtml(c, side) {
  // .ww-dot es el conector COMPARTIDO con Emparejar (styles/match.css): absoluto
  // en el borde de la tarjeta. side 'L' (columna izq) → punto en el borde DERECHO
  // (hacia la imagen); side 'R' → borde IZQUIERDO. Así apunta siempre al centro.
  return `<div class="dg-label" data-id="${escapeHtml(c.id)}">
    <span class="dg-label-text">${escapeHtml(c.text)}</span>
    <span class="ww-dot" data-side="${side}" data-id="${escapeHtml(c.id)}"></span>
  </div>`;
}
function pinHtml(p) {
  return `<span class="dg-pin" data-id="${escapeHtml(p.id)}" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%"></span>`;
}
function buildLayout(leftLabels, rightLabels, pins, image, activity, total) {
  return `<div class="dg-wrap p-3">
  <div class="d-flex align-items-center mb-2 gap-2">
    <span class="badge bg-secondary dg-progress flex-shrink-0">0 / ${total}</span>
    <span class="fw-bold text-truncate flex-grow-1 text-center small">${escapeHtml(activity.title || '')}</span>
    <span class="badge bg-secondary flex-shrink-0" style="visibility:hidden">0 / ${total}</span>
  </div>
  <div class="dg-arena">
    <div class="dg-col dg-left">${leftLabels.map(c => labelHtml(c, 'L')).join('')}</div>
    <div class="dg-stage">
      <div class="dg-img-box">
        <img class="dg-img" src="${escapeHtml(image)}" alt="" draggable="false">
        ${pins.map(pinHtml).join('')}
      </div>
    </div>
    <div class="dg-col dg-right">${rightLabels.map(c => labelHtml(c, 'R')).join('')}</div>
    <svg class="ww-lines-svg" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <div class="text-center mt-2">
    <button type="button" class="btn btn-success btn-lg px-5 dg-submit" disabled>
      <i class="bi bi-check2-circle"></i> Enviar respuestas
    </button>
  </div>
</div>`;
}
