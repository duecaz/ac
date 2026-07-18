// Match player: arrastra una cuerda entre dos ítems para emparejarlos.
// EMPAREJADO LIBRE: conectar NO califica — el alumno une todos los pares (puede
// cambiar o quitar conexiones) y pulsa "Enviar"; recién ahí se corrige y puntúa.
// La zona de arrastre es TODA la tarjeta (no solo el punto), en cualquier lado.
import { html, mount, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { shuffle } from '../../core/roundRender.js';
import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt } from '../../core/connectRope.js';
import { observeResize } from '../../core/observeResize.js';

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
  const arena      = root.querySelector('.ww-field');
  const svg        = root.querySelector('.ww-lines-svg');
  const progressEl = root.querySelector('.ww-matched');
  const submitBtn  = root.querySelector('.ww-match-submit');

  // Capa de cuerdas (defs + sombra) — motor compartido core/connectRope.js.
  const { layer, filterId } = mountRopeLayer(svg);

  function updateProgress() {
    if (progressEl) progressEl.textContent = `${state.links.size} / ${raw.length}`;
  }
  function updateSubmit() {
    if (submitBtn) submitBtn.disabled = state.graded || state.links.size < raw.length;
  }

  function updateSvg() {
    let d = '';
    let i = 0;
    for (const [leftId, rightId] of state.links) {
      const ld = root.querySelector(`.ww-dot[data-id="${leftId}"][data-side="L"]`);
      const rd = root.querySelector(`.ww-dot[data-id="${rightId}"][data-side="R"]`);
      if (!ld || !rd) { i++; continue; }
      const p1 = dotPos(ld, svg), p2 = dotPos(rd, svg);
      const col = state.graded ? (leftId === rightId ? OK_COL : NO_COL) : ROPES[i % ROPES.length];
      d += ropeHtml(p1, p2, col, filterId);
      i++;
    }
    if (state.dragging) {
      const { x1, y1, cx, cy } = state.dragging;
      d += ghostHtml(x1, y1, cx, cy);
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
  // Tarjeta destino al soltar — 2D AGNÓSTICO a la orientación (mismo criterio que
  // Etiqueta el diagrama): la tarjeta del lado OPUESTO más cercana en 2D. Así
  // funciona igual con columnas laterales (ancho) o filas arriba/abajo (alto), sin
  // asumir un "corredor" por X. Dos guardas para desconectar: soltar MÁS cerca del
  // origen que del destino (tirar de vuelta), o soltar lejos (fuera del radio).
  function targetCard(x, y, fromSide, fromId) {
    const side = fromSide === 'L' ? 'R' : 'L';
    const cen = el => { const r = el.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };
    let best = null, bestD = Infinity;
    for (const c of root.querySelectorAll(`.ww-card[data-side="${side}"]`)) {
      const [cx, cy] = cen(c); const dx = cx - x, dy = cy - y, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) return null;
    const origin = root.querySelector(`.ww-card[data-side="${fromSide}"][data-id="${fromId}"]`);
    if (origin) { const [ox, oy] = cen(origin); if ((ox - x) ** 2 + (oy - y) ** 2 < bestD) return null; }
    const radius = Math.max(70, arena.getBoundingClientRect().width * 0.16);
    return Math.sqrt(bestD) <= radius ? best : null;
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
    const hit = targetCard(e.clientX, e.clientY, drag.fromSide, drag.fromId);
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

  // ── Maquetación 16/10, CONSCIENTE de la orientación del andamio ─────────────
  // Ancho (rieles = columnas): N tarjetas apiladas en el ALTO, ancho ≤ ~38% del
  // field (dos columnas + corredor). Alto (rieles = filas envueltas): 2 tarjetas
  // por fila, más grandes. El tamaño se calcula del FIELD (no del riel, que se
  // ciñe a las tarjetas → evita la dependencia circular).
  function fitLayout() {
    const field = root.querySelector('.ww-field');
    if (!field) return;
    const N = Math.max(lefts.length, rights.length);
    const GAP = 8;
    const fw = field.clientWidth, fh = field.clientHeight;
    if (!fw || !fh) return;
    const horizontal = getComputedStyle(field).flexDirection === 'row';   // landscape
    let cardW, cardH;
    if (horizontal) {
      cardH = Math.max(44, Math.floor(Math.min((fh - (N - 1) * GAP) / N, (fw * 0.38) * 10 / 16)));
      cardW = Math.round(cardH * 16 / 10);
    } else {
      cardW = Math.max(90, Math.floor((fw - GAP) / 2));
      cardH = Math.round(cardW * 10 / 16);
    }
    root.querySelectorAll('.ww-card').forEach(c => {
      c.style.flex = '0 0 auto'; c.style.width = cardW + 'px'; c.style.height = cardH + 'px';
    });
    updateSvg();                                       // recolocar cuerdas
  }
  requestAnimationFrame(fitLayout);
  // rAF-debounced (observeResize): fitLayout MUTA el tamaño de las tarjetas; un RO
  // directo dispararía el aviso "ResizeObserver loop…" al salir de fullscreen. Se
  // observa el field (al reflujo/redimensión → recalcular tamaños y cuerdas).
  observeResize(arena, fitLayout);

  updateProgress();
  updateSubmit();
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildLayout(lefts, rights, activity, total) {
  // Andamio de regiones (styles/scaffold.css): dos rieles (start/end) con un
  // corredor central (ww-stage vacío) que las cuerdas cruzan. Refluye de columnas
  // laterales (ancho) a filas arriba/abajo (alto) → tarjetas grandes en móvil.
  return `<div class="ww-scaffold ww-match p-2">
  <div class="ww-bar d-flex align-items-center gap-2 px-1">
    <span class="badge bg-secondary ww-matched flex-shrink-0">0 / ${total}</span>
    <span class="fw-bold text-truncate flex-grow-1 text-center small">${escapeHtml(activity.title || '')}</span>
    <span class="badge bg-secondary flex-shrink-0" style="visibility:hidden">0 / ${total}</span>
  </div>
  <div class="ww-field ww-match-field">
    <div class="ww-rail ww-match-col" data-rail="start">${lefts.map(c => cardHtml(c, 'L')).join('')}</div>
    <div class="ww-stage ww-match-gap"></div>
    <div class="ww-rail ww-match-col" data-rail="end">${rights.map(c => cardHtml(c, 'R')).join('')}</div>
    <svg class="ww-lines-svg" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <div class="ww-bar ww-bar-actions">
    <button type="button" class="btn btn-success ww-match-submit" disabled>
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


