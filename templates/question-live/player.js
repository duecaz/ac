// Solo player for "Abre Cajas". No scoring — teacher grades verbally outside the app.
// selector=boxes: tap a box → reveals the question. Tap "Listo" to mark done (turns green).
// selector=wheel: spin a wheel of question numbers → reveals the question card.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { sessionItems } from '../../kernel/session/engine.js';
import { wheelSvg } from '../wheel/render.js';
import { pickIndex } from '../wheel/logic.js';

const COLORS = ['#e74c3c','#e67e22','#d4ac0d','#27ae60','#16a085','#2980b9','#8e44ad','#c0392b'];
const SPIN_TURNS = 5;
const SPIN_DUR = 3500;

function getItems(activity) {
  return sessionItems(activity).map(i =>
    typeof i === 'string' ? { q: i, image: null } : { q: i?.q || '', image: i?.image || null }
  );
}

export function renderQuestionLivePlayer(rootSel, activity) {
  const selector = activity.rules?.selector || 'boxes';
  if (selector === 'wheel') renderWheel(rootSel, activity);
  else renderBoxes(rootSel, activity);
}

function renderBoxes(rootSel, activity) {
  const items = getItems(activity);
  let openIdx = null;
  const done = new Set();

  function paint() {
    const cols = Math.min(4, Math.max(2, Math.ceil(items.length / 2)));
    const boxesHtml = items.map((_, i) => {
      const isDone = done.has(i);
      const isOpen = openIdx === i;
      const color = COLORS[i % COLORS.length];
      const style = isDone
        ? `background:#198754;color:#fff`
        : isOpen
          ? `background:#fff;border:3px solid ${color}!important;color:#1f2937`
          : `background:${color};color:#fff`;
      return `<button class="ab-box${isDone ? ' ab-done' : ''}" data-i="${i}"
          style="${style};border-radius:8px;min-height:64px;font-size:1.4rem;font-weight:700;border:none;cursor:${isDone?'default':'pointer'}">
        ${isDone ? '<i class="bi bi-check2"></i>' : i + 1}
      </button>`;
    }).join('');

    const openItem = openIdx !== null ? items[openIdx] : null;
    mount(rootSel, html`
      <div class="text-center py-3 px-2">
        <h3 class="mb-3">${escapeHtml(activity.title)}</h3>
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;max-width:460px;margin:0 auto">${boxesHtml}</div>
        ${openItem != null ? `
          <div class="card border-2 mx-auto mt-4" style="max-width:480px;border-color:${COLORS[openIdx % COLORS.length]};border-width:2px">
            <div class="card-body">
              <small class="text-muted d-block mb-2">Caja ${openIdx + 1}</small>
              ${openItem.image ? `<img src="${escapeHtml(openItem.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
              <h4 class="card-title text-center">${escapeHtml(openItem.q || '')}</h4>
              <div class="d-flex gap-2 justify-content-center mt-3">
                <button class="btn btn-success" id="ab-done"><i class="bi bi-check2-circle"></i> Listo</button>
                <button class="btn btn-outline-secondary" id="ab-close"><i class="bi bi-x-lg"></i> Cerrar</button>
              </div>
            </div>
          </div>`
        : `<p class="text-muted mt-4"><i class="bi bi-hand-index"></i> Toca una caja para ver la pregunta</p>
           ${done.size === items.length && items.length > 0 ? '<div class="alert alert-success d-inline-block mt-2"><i class="bi bi-check2-all"></i> ¡Todas respondidas!</div>' : ''}`}
      </div>
    `);

    on(rootSel, 'click', '.ab-box:not(.ab-done)', (_, b) => {
      const i = +b.dataset.i;
      openIdx = openIdx === i ? null : i;
      paint();
    });
    on(rootSel, 'click', '#ab-done', () => { if (openIdx !== null) { done.add(openIdx); openIdx = null; } paint(); });
    on(rootSel, 'click', '#ab-close', () => { openIdx = null; paint(); });
  }

  paint();
}

function renderWheel(rootSel, activity) {
  const items = getItems(activity);
  const done = new Set();
  let openIdx = null;
  let rotation = 0;
  let spinning = false;

  const rootEl = () => typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;

  function paint() {
    if (openIdx !== null) {
      const item = items[openIdx];
      mount(rootSel, html`
        <div class="text-center py-3 px-2">
          <h3 class="mb-3">${escapeHtml(activity.title)}</h3>
          <div class="card border-warning mx-auto" style="max-width:480px;border-width:2px">
            <div class="card-body">
              <small class="text-muted d-block mb-2">Pregunta ${openIdx + 1}</small>
              ${item.image ? `<img src="${escapeHtml(item.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
              <h4 class="card-title text-center">${escapeHtml(item.q || '')}</h4>
              <div class="d-flex gap-2 justify-content-center mt-3">
                <button class="btn btn-success" id="ab-done"><i class="bi bi-check2-circle"></i> Listo</button>
                <button class="btn btn-outline-secondary" id="ab-back"><i class="bi bi-arrow-repeat"></i> Volver</button>
              </div>
            </div>
          </div>
        </div>
      `);
      on(rootSel, 'click', '#ab-done', () => { done.add(openIdx); openIdx = null; paint(); });
      on(rootSel, 'click', '#ab-back', () => { openIdx = null; paint(); });
      return;
    }

    const available = items.map((_, i) => i).filter(i => !done.has(i));
    if (available.length === 0) {
      mount(rootSel, html`
        <div class="text-center py-5">
          <h3>${escapeHtml(activity.title)}</h3>
          <i class="bi bi-check2-all display-1 text-success mt-3"></i>
          <p class="lead mt-3">¡Todas las preguntas respondidas!</p>
        </div>
      `);
      return;
    }

    const entries = available.map(i => String(i + 1));
    mount(rootSel, html`
      <div class="text-center py-3">
        <h3 class="mb-3">${escapeHtml(activity.title)}</h3>
        <div style="position:relative;display:inline-block">
          ${wheelSvg(entries, { rotation, dur: 0, spinning: false })}
          <div style="position:absolute;top:50%;left:-18px;transform:translateY(-50%);font-size:36px;color:#e53935;line-height:1">▶</div>
        </div>
        <div class="mt-3">
          <button class="btn btn-warning btn-lg px-5" id="ab-spin" ${spinning ? 'disabled' : ''}>
            <i class="bi bi-arrow-repeat"></i> Girar
          </button>
        </div>
        ${done.size ? `<p class="text-muted small mt-2">${done.size} de ${items.length} respondida(s)</p>` : ''}
      </div>
    `);

    on(rootSel, 'click', '#ab-spin', () => {
      if (spinning || available.length === 0) return;
      spinning = true;
      const count = available.length;
      const target = pickIndex(count);
      const realIdx = available[target];
      const arc = 360 / count;
      const base = Math.ceil((rotation + 1) / 360) * 360;
      rotation = base + 360 * SPIN_TURNS + (360 - (target * arc + arc / 2)) - 90;

      const svg = rootEl()?.querySelector('svg');
      const btn = rootEl()?.querySelector('#ab-spin');
      if (btn) btn.disabled = true;
      if (svg) {
        svg.style.transition = `transform ${SPIN_DUR}ms cubic-bezier(.17,.67,.21,.99)`;
        svg.getBoundingClientRect?.();
        svg.style.transform = `rotate(${rotation}deg)`;
      }
      setTimeout(() => {
        spinning = false;
        rotation = ((rotation % 360) + 360) % 360;
        openIdx = realIdx;
        paint();
      }, SPIN_DUR);
    });
  }

  paint();
}
