// Solo player for "Abre Cajas". No scoring — teacher grades verbally outside the app.
// selector=boxes: tap a box → reveals the question. Tap "Listo" to mark done (turns green).
// selector=wheel: spin a wheel of question numbers → reveals the question card.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { sessionItems } from '../../kernel/content/sessionItems.js';
import { wheelSvg } from '../../core/ruleta/render.js';
import { pickIndex } from '../../core/ruleta/logic.js';
import { spinTarget, normalizeRotation, animateSpin, SPIN_DUR_PICK } from '../../core/ruleta/spin.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { QL_COLORS, qlBoxesHtml, qlCols } from '../../core/questionLive.js';
import { cabeceraHtml } from '../../core/playerHud.js';


function getItems(activity) {
  return sessionItems(activity).map(i =>
    typeof i === 'string' ? { question: i, image: null } : { question: i?.question ?? i?.q ?? '', image: i?.image || null }
  );
}

export function renderQuestionLivePlayer(rootSel, activity, opts = {}) {
  const selector = activity.rules?.selector || 'boxes';
  if (selector === 'wheel') renderWheel(rootSel, activity, opts);
  else renderBoxes(rootSel, activity, opts);
}

function renderBoxes(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const items = getItems(activity);
  let openIdx = null;
  const done = new Set();

  function paint() {
    const cols = qlCols(items.length);
    // El tablero, de su dueño (core/questionLive.js). Aquí las cajas SÍ se tocan
    // (no hay sala: el que juega abre la que quiera) y una caja hecha muestra
    // un ✓, porque en Individual no hay puntos que dar.
    const boxesHtml = qlBoxesHtml(items.length, {
      done, openIdx, open: openIdx, cls: 'ab-box',
      pickable: () => true,
      extraStyle: 'border-radius:8px;min-height:64px;font-size:1.4rem;font-weight:700',
    });

    const openItem = openIdx !== null ? items[openIdx] : null;
    mount(rootSel, html`
      <div class="ab-play text-center py-3 px-2">
        ${cabeceraHtml({ pagina: `${done.size} / ${items.length}` })}
        <div class="edu-sec edu-sec--tablero ab-board" style="grid-template-columns:repeat(${cols},1fr)">${boxesHtml}</div>
        ${openItem != null ? `
          <div class="ab-open card border-2 mx-auto mt-4" style="max-width:480px;border-color:${QL_COLORS[openIdx % QL_COLORS.length]};border-width:2px">
            <div class="card-body">
              <small class="text-muted d-block mb-2">Caja ${openIdx + 1}</small>
              ${openItem.image ? `<img src="${escapeHtml(openItem.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
              <h4 class="card-title text-center">${escapeHtml(openItem.question || '')}</h4>
              <div class="d-flex gap-2 justify-content-center mt-3">
                <button class="btn btn-success" id="ab-done"><i class="bi bi-check2-circle"></i> Listo</button>
                <button class="btn btn-outline-secondary" id="ab-close"><i class="bi bi-x-lg"></i> Cerrar</button>
              </div>
            </div>
          </div>`
        : `<p class="ab-hint text-muted mt-4"><i class="bi bi-hand-index"></i> Toca una caja para ver la pregunta</p>
           ${done.size === items.length && items.length > 0 ? '<div class="alert alert-success d-inline-block mt-2"><i class="bi bi-check2-all"></i> ¡Todas respondidas!</div>' : ''}`}
      </div>
    `);

    on(rootSel, 'click', '.ab-box:not(.ab-done)', (_, b) => {
      const i = +b.dataset.i;
      openIdx = openIdx === i ? null : i;
      paint();
    });
    on(rootSel, 'click', '#ab-done', () => {
      if (openIdx !== null) { done.add(openIdx); openIdx = null; }
      if (done.size === items.length) ctx.finish({ score: done.size, maxScore: items.length, skipResultScreen: true });
      paint();
    });
    on(rootSel, 'click', '#ab-close', () => { openIdx = null; paint(); });
  }

  paint();
}

function renderWheel(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
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
        <div class="ab-play text-center py-3 px-2">
            <div class="ab-open card border-warning mx-auto" style="max-width:480px;border-width:2px">
            <div class="card-body">
              <small class="text-muted d-block mb-2">Pregunta ${openIdx + 1}</small>
              ${item.image ? `<img src="${escapeHtml(item.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
              <h4 class="card-title text-center">${escapeHtml(item.question || '')}</h4>
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
      ctx.finish({ score: done.size, maxScore: items.length, skipResultScreen: true });
      mount(rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-check2-all display-1 text-success mt-3"></i>
          <p class="lead mt-3">¡Todas las preguntas respondidas!</p>
        </div>
      `);
      return;
    }

    const entries = available.map(i => String(i + 1));
    mount(rootSel, html`
      <div class="ab-play text-center py-3">
        ${cabeceraHtml({ pagina: `${done.size} / ${items.length}` })}
        <div class="edu-sec edu-sec--tablero ww-wheel-stage">
          ${wheelSvg(entries, { rotation, dur: 0, spinning: false })}
          <div class="ww-wheel-pointer">▶</div>
        </div>
        <div class="mt-3">
          <button class="btn btn-warning btn-lg px-5" id="ab-spin" ${spinning ? 'disabled' : ''}>
            <i class="bi bi-arrow-repeat"></i> Girar
          </button>
        </div>
      </div>
    `);

    on(rootSel, 'click', '#ab-spin', () => {
      if (spinning || available.length === 0) return;
      spinning = true;
      const count = available.length;
      const target = pickIndex(count);
      const realIdx = available[target];
      rotation = spinTarget(rotation, count, target);

      const btn = rootEl()?.querySelector('#ab-spin');
      if (btn) btn.disabled = true;
      animateSpin(rootEl()?.querySelector('svg'), rotation, SPIN_DUR_PICK);
      setTimeout(() => {
        if (!rootEl()) return;   // la ruta cambió a mitad del giro (ley de vista §23)
        spinning = false;
        rotation = normalizeRotation(rotation);
        openIdx = realIdx;
        paint();
      }, SPIN_DUR_PICK);
    });
  }

  paint();
}
