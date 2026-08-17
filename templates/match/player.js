// Match player: arrastra una cuerda entre dos ítems para emparejarlos.
// EMPAREJADO LIBRE: conectar NO califica — el alumno une todos los pares (puede
// cambiar o quitar conexiones) y pulsa "Enviar"; recién ahí se corrige y puntúa.
// La zona de arrastre es TODA la tarjeta (no solo el punto), en cualquier lado.
import { html, mount, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GRADE_HOLD_MS } from '../../core/timings.js';
import { shuffle } from '../../core/roundRender.js';
import { scoreMatchSubmission } from './scorer.js';
import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, svgPt } from '../../core/connectRope.js';
import { observeResize } from '../../core/observeResize.js';
import { pairComplete } from '../../core/contentModels/pairs.js';
import { hudHtml, hudSet } from '../../core/playerHud.js';

export async function renderMatchPlayer(rootSel, activity, opts = {}) {
  // La regla la pone el modelo (core/contentModels/pairs.js), no esta copia:
  // es la misma con la que el editor decide si la actividad está lista.
  const raw = (activity.content?.pairs || []).filter(pairComplete);
  if (!raw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene pares.</div>`);
    return;
  }

  // El techo es, POR DEFINICIÓN, lo que da el propio scorer si aciertas todo —
  // así no hay una segunda fórmula que pueda desincronizarse.
  const byId = new Map(raw.map(p => [p.id, p]));
  const maxScore = activity.scoring?.maxScore
    || raw.reduce((s, p) => s + scoreMatchSubmission({ value: p.right, item: p, activity }).points, 0);
  const doShuffle = activity.rules?.randomize !== false;

  const lefts  = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
  const rights = (doShuffle ? shuffle : v => v)(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  let stopRo = null;   // disposer del observeResize del field (se suelta al terminar)
  const state = {
    links:    new Map(),  // leftId → rightId (emparejados por el alumno; cambiables)
    dragging: null,       // { fromSide, fromId, x1, y1, cx, cy }
    graded:   false,      // true tras pulsar Enviar
  };

  mount(rootSel, buildLayout(lefts, rights, activity, raw.length));

  const root       = document.querySelector(rootSel);
  const arena      = root.querySelector('.ww-field');
  const svg        = root.querySelector('.ww-lines-svg');
  const submitBtn  = root.querySelector('.ww-match-submit');

  // Capa de cuerdas — motor compartido core/connectRope.js.
  const { layer } = mountRopeLayer(svg);

  function updateProgress() {
    hudSet(root, 'pagina', `${state.links.size} / ${raw.length}`);
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
      d += ropeHtml(p1, p2, col);
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

  // Tarjeta destino al soltar — AGNÓSTICO a la orientación (columnas o filas) y a
  // prueba de geometría. La regla anterior "si el destino queda más cerca del
  // origen que del punto, cancela" era el bug del vertical: con un corredor alto,
  // medio arrastre legítimo cae más cerca del origen y se perdía la conexión.
  // Ahora, en cambio:
  //  1) si soltó DENTRO de una tarjeta del lado opuesto (o su punto), conecta con ESA;
  //  2) si soltó de vuelta sobre su PROPIA tarjeta (toque sin arrastrar / deshacer),
  //     devuelve null → desconecta;
  //  3) en cualquier otro sitio (hueco/corredor), la tarjeta opuesta MÁS cercana por
  //     centro — hay pocas y son grandes, así que "la más cercana" es siempre la
  //     intención. Un arrastre hacia el otro grupo NUNCA se queda sin conectar.
  function targetCard(x, y, fromSide, fromId) {
    const side = fromSide === 'L' ? 'R' : 'L';
    const cards = [...root.querySelectorAll(`.ww-card[data-side="${side}"]`)];
    const inRect = (r, m) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
    // 1a) ¿soltó sobre el PUNTO conector de una tarjeta opuesta? → esa tarjeta.
    for (const c of cards) {
      const dot = c.querySelector('.ww-dot');
      if (dot && inRect(dot.getBoundingClientRect(), 14)) return c;
    }
    // 1b) ¿soltó DENTRO de una tarjeta opuesta (margen pequeño)? → esa.
    for (const c of cards) if (inRect(c.getBoundingClientRect(), 8)) return c;
    // 2) ¿soltó de vuelta sobre su PROPIA tarjeta? → cancelar (toque sin arrastre / deshacer).
    const origin = root.querySelector(`.ww-card[data-side="${fromSide}"][data-id="${fromId}"]`);
    if (origin && inRect(origin.getBoundingClientRect(), 8)) return null;
    // 3) hueco/corredor: la tarjeta opuesta más cercana por centro (siempre hay una).
    const cen = el => { const r = el.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };
    let best = null, bestD = Infinity;
    for (const c of cards) { const [cx, cy] = cen(c); const d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bestD) { bestD = d; best = c; } }
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
    const hit = targetCard(e.clientX, e.clientY, drag.fromSide, drag.fromId);
    if (hit) {
      const leftId  = drag.fromSide === 'L' ? drag.fromId : hit.dataset.id;
      const rightId = drag.fromSide === 'L' ? hit.dataset.id : drag.fromId;
      setLink(leftId, rightId);
    } else {
      removeByCard(drag.fromSide, drag.fromId);   // soltar en su propia tarjeta: desconectar
    }
  }
  arena.addEventListener('pointerup', e => endDrag(e, true));
  arena.addEventListener('pointercancel', e => endDrag(e, false));

  // ── Enviar → corregir y puntuar ─────────────────────────────────────────────
  submitBtn?.addEventListener('click', () => {
    if (state.graded || state.links.size < raw.length) return;
    state.graded = true;
    // Cada cuerda se puntúa con el MISMO scorer que usan VS y Equipos: el modo
    // Individual no puede tener su propia aritmética (era la doble contabilidad).
    let correct = 0, score = 0;
    for (const [l, r] of state.links) {
      const res = scoreMatchSubmission({ value: byId.get(r)?.right ?? '', item: byId.get(l), activity });
      score += res.points;
      if (res.correct) correct++;
    }
    score = Math.max(0, score);
    const wrong = state.links.size - correct;
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
    stopRo?.();   // la pantalla de resultado desmonta el field: suelta el observer
    setTimeout(() => ctx.finish({
      title: correct === raw.length ? '¡Perfecto!' : 'Resultado',
      lead:  `${correct} de ${raw.length} correctas`,
      stats: ({ timeUsed }) => `${wrong} error${wrong !== 1 ? 'es' : ''} · ${timeUsed}s`,
      score, maxScore,
    }), GRADE_HOLD_MS);
  });

  // ── Maquetación: SIEMPRE dos columnas laterales (preguntas | respuestas) ─────
  // En ambas orientaciones los rieles son columnas y las cuerdas cruzan el pasillo
  // central en horizontal → nunca pisan otra tarjeta. Cambia el CÁLCULO de tamaño:
  //  · Ancho (landscape): muchas tarjetas caben por alto → se dimensionan por alto,
  //    con tope de ancho ~38% del field (deja pasillo).
  //  · Alto (portrait): pocas tarjetas, ancho por columna ~mitad del field y alto
  //    para apilar las N; con tope legible (nada de tarjetas altísimas casi vacías;
  //    el resto del alto lo reparte space-evenly). El tamaño se calcula del FIELD
  //    (no del riel, que se ciñe a las tarjetas → evita la dependencia circular).
  function fitLayout() {
    const field = root.querySelector('.ww-field');
    if (!field) return;
    const N = Math.max(lefts.length, rights.length);
    const GAP = 8;
    const fw = field.clientWidth, fh = field.clientHeight;
    if (!fw || !fh) return;
    const portrait = fh > fw;
    let cardW, cardH;
    if (!portrait) {
      cardH = Math.max(44, Math.floor(Math.min((fh - (N - 1) * GAP) / N, (fw * 0.38) * 10 / 16)));
      cardW = Math.round(cardH * 16 / 10);
    } else {
      // Dos columnas: ancho por columna ≈ mitad del field menos el pasillo central.
      cardW = Math.max(88, Math.floor((fw - 44) / 2));
      // Alto: que las N quepan apiladas, pero sin pasar de ~0.92·ancho (legible).
      cardH = Math.max(64, Math.floor(Math.min((fh - (N - 1) * GAP) / N, cardW * 0.92)));
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
  // El disposer se guarda y se suelta al terminar (§23): un RO sobre el DOM ya
  // desmontado no dispara, pero retiene el nodo — fuga de referencia.
  stopRo = observeResize(arena, fitLayout);

  updateProgress();
  updateSubmit();
}

// ── HTML builders ─────────────────────────────────────────────────────────────

function buildLayout(lefts, rights, activity, total) {
  // Andamio de regiones (styles/scaffold.css): dos rieles (start/end) con un
  // corredor central (ww-stage vacío) que las cuerdas cruzan. Emparejar mantiene los
  // rieles como DOS COLUMNAS laterales en ambas orientaciones (ver match.css portrait):
  // así las cuerdas cruzan el pasillo en horizontal y no se solapan con las tarjetas.
  return `<div class="ww-scaffold ww-match p-2">
  ${hudHtml({ pagina: `0 / ${total}` })}
  <div class="edu-sec edu-sec--campo ww-field ww-match-field">
    <div class="ww-rail ww-match-col" data-rail="start">${lefts.map(c => cardHtml(c, 'L')).join('')}</div>
    <div class="ww-stage ww-match-gap"></div>
    <div class="ww-rail ww-match-col" data-rail="end">${rights.map(c => cardHtml(c, 'R')).join('')}</div>
    <svg class="ww-lines-svg" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <div class="ww-bar ww-bar-actions edu-send">
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


