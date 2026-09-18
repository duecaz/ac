// Solo player for "Abre Cajas". No scoring — teacher grades verbally outside the app.
// selector=boxes: tap a box → reveals the question. Tap "Listo" to mark done (turns green).
// selector=wheel: spin a wheel of question numbers → reveals the question card.
import { html, escapeHtml, mount, raizDe } from '../../core/html.js';
import { on } from '../../core/events.js';
import { sessionItems } from '../../kernel/content/sessionItems.js';
import { wheelSvg } from '../../core/ruleta/render.js';
import { girar, SPIN_DUR_PICK } from '../../core/ruleta/spin.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { QL_COLORS, qlBoxesHtml, qlCols } from '../../core/questionLive.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';


/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../core/contentModels/items.js').CardItemLegado} CardItemLegado
 * @typedef {import('../../core/soloPlayer.js').FreeformCtx} FreeformCtx
 * @typedef {{question: string, image: string|null}} Caja
 */

// `sessionItems` devuelve el ítem de CUALQUIER modelo (la unión): aquí solo se
// leen los dos campos de una tarjeta, así que se estrecha por forma.
/** @param {Activity} activity @returns {Caja[]} */
function getItems(activity) {
  return sessionItems(activity).map(i => {
    if (typeof i === 'string') return { question: i, image: null };
    const it = /** @type {CardItemLegado} */ (i);
    return { question: it.question ?? it.q ?? '', image: it.image || null };
  });
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export function renderQuestionLivePlayer(rootSel, activity, opts = {}) {
  const selector = activity.rules?.selector || 'boxes';
  if (selector === 'wheel') renderWheel(rootSel, activity, opts);
  else renderBoxes(rootSel, activity, opts);
}


// EL FINAL LO PONE EL SHELL (sin salida, como las otras 12): Abre Cajas no
// tiene acierto ni fallo —«6 de 6» es cuántas cajas se abrieron—, así que lo
// que se AÑADE es la verdad de eso, y la pantalla estándar pone el «otra vez».
// Tuvo un cierre propio («¡Todas las preguntas respondidas!») que se saltaba
// la estándar; el dueño lo cerró: todos a rajatabla.
/** @param {FreeformCtx} ctx @param {number} abiertas @param {number} total */
const terminarCajas = (ctx, abiertas, total) => ctx.finish({
  score: abiertas, maxScore: total,
  title: '¡Todas las cajas abiertas!',
  stats: `${abiertas} / ${total} cajas`,
});

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
function renderBoxes(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const items = getItems(activity);
  /** @type {number|null} */
  let openIdx = null;
  const done = new Set();
  const terminar = () => terminarCajas(ctx, done.size, items.length);

  // SE MONTA UNA VEZ. Antes cada clic volvía a montar el player entero —
  // cabecera incluida—, y el dueño lo vio: «parpadea el reloj cada que escojo
  // una caja» (2026-09-18). El reloj no parpadeaba por el reloj: su chip se
  // destruía y volvía a nacer VACÍO hasta el siguiente tic. La cabecera es de
  // la PLATAFORMA (§23: la vista posee su render, no el marco que la rodea);
  // abrir una caja cambia el tablero y el panel, y nada más.
  mount(rootSel, html`
    <div class="ab-play text-center py-3 px-2">
      ${cabeceraHtml({ pagina: `${done.size} / ${items.length}` })}
      <div class="edu-sec edu-sec--tablero ab-board"
           style="grid-template-columns:repeat(${qlCols(items.length)},1fr)"></div>
      <div data-ab-panel></div>
    </div>`);

  const root = raizDe(rootSel);
  const tableroOpt = root?.querySelector('.ab-board') ?? null;
  const panelOpt = root?.querySelector('[data-ab-panel]') ?? null;
  if (!tableroOpt || !panelOpt) return;   // el marco no llegó a montarse (§23)
  const tablero = tableroOpt, panel = panelOpt;

  /** La tarjeta de la caja abierta, o la pista de «toca una caja». */
  function panelHtml() {
    const item = openIdx !== null ? items[openIdx] : null;
    if (openIdx === null || !item) {
      return `<p class="ab-hint text-muted mt-4"><i class="bi bi-hand-index"></i> Toca una caja para ver la pregunta</p>`;
    }
    return `
      <div class="ab-open card border-2 mx-auto mt-4" style="max-width:480px;border-color:${QL_COLORS[openIdx % QL_COLORS.length]};border-width:2px">
        <div class="card-body">
          <small class="text-muted d-block mb-2">Caja ${openIdx + 1}</small>
          ${item.image ? `<img src="${escapeHtml(item.image)}" class="img-fluid rounded mb-3 d-block mx-auto" style="max-height:200px">` : ''}
          <h4 class="card-title text-center">${escapeHtml(item.question || '')}</h4>
          <div class="d-flex gap-2 justify-content-center mt-3">
            <button class="btn btn-success" id="ab-done"><i class="bi bi-check2-circle"></i> Listo</button>
            <button class="btn btn-outline-secondary" id="ab-close"><i class="bi bi-x-lg"></i> Cerrar</button>
          </div>
        </div>
      </div>`;
  }

  /** Lo ÚNICO que cambia al abrir o cerrar una caja: el tablero, el panel y el
   *  contador de la cabecera (por su dato, no rehaciéndola). */
  function refrescar() {
    // El tablero, de su dueño (core/questionLive.js). Aquí las cajas SÍ se tocan
    // (no hay sala: el que juega abre la que quiera) y una caja hecha muestra
    // un ✓, porque en Individual no hay puntos que dar.
    tablero.innerHTML = qlBoxesHtml(items.length, {
      done, open: openIdx, cls: 'ab-box',
      pickable: () => true,
      extraStyle: 'border-radius:8px;min-height:64px;font-size:1.4rem;font-weight:700',
    });
    panel.innerHTML = panelHtml();
    hudSet(root, 'pagina', `${done.size} / ${items.length}`);
  }

  // Los handlers se cablean UNA vez: son delegados sobre la raíz, que ya no se
  // reemplaza (`core/events.js` los sustituye por (evento, selector), así que
  // volver a registrarlos no acumulaba, pero sí escondía que el markup entero
  // se estaba rehaciendo debajo).
  on(rootSel, 'click', '.ab-box:not(.ab-done)', (_, b) => {
    const i = Number(b.dataset.i);
    openIdx = openIdx === i ? null : i;
    refrescar();
  });
  on(rootSel, 'click', '#ab-done', () => {
    if (openIdx !== null) { done.add(openIdx); openIdx = null; }
    if (done.size === items.length) { terminar(); return; }
    refrescar();
  });
  on(rootSel, 'click', '#ab-close', () => { openIdx = null; refrescar(); });

  refrescar();
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
function renderWheel(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const items = getItems(activity);
  /** @type {Set<number>} */
  const done = new Set();
  const terminar = () => terminarCajas(ctx, done.size, items.length);
  /** @type {number|null} */
  let openIdx = null;
  let rotation = 0;
  let spinning = false;

  const rootEl = () => raizDe(rootSel);

  function paint() {
    if (openIdx !== null) {
      const idx = openIdx;
      const item = items[idx];
      mount(rootSel, html`
        <div class="ab-play text-center py-3 px-2">
            <div class="ab-open card border-warning mx-auto" style="max-width:480px;border-width:2px">
            <div class="card-body">
              <small class="text-muted d-block mb-2">Pregunta ${idx + 1}</small>
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
      on(rootSel, 'click', '#ab-done', () => { done.add(idx); openIdx = null; paint(); });
      on(rootSel, 'click', '#ab-back', () => { openIdx = null; paint(); });
      return;
    }

    const available = items.map((_, i) => i).filter(i => !done.has(i));
    if (available.length === 0) {
      terminar();
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
          <button class="btn btn-warning btn-lg px-5" data-ab="spin" ${spinning ? 'disabled' : ''}>
            <i class="bi bi-arrow-repeat"></i> Girar
          </button>
        </div>
      </div>
    `);

    on(rootSel, 'click', '[data-ab="spin"]', () => {
      if (spinning || available.length === 0) return;
      spinning = true;

      const btn = /** @type {HTMLButtonElement|null} */ (rootEl()?.querySelector('[data-ab="spin"]') ?? null);
      if (btn) btn.disabled = true;
      // El giro entero es de core/ruleta/spin.js. Aquí vivía una COPIA a la que
      // le faltaba medio guard (solo `rootEl()`, sin `ctx.alive()`): el selector
      // del escenario es genérico, así que la ruleta pendiente podía revelar su
      // pregunta encima del juego montado DESPUÉS (§23).
      rotation = girar({
        svg: rootEl()?.querySelector('svg'), rotation, count: available.length,
        dur: SPIN_DUR_PICK,
        vivo: () => ctx.alive() && !!rootEl(),
        alParar: (target, normalizada) => {
          spinning = false;
          rotation = normalizada;
          openIdx = available[target];
          paint();
        },
      });
    });
  }

  paint();
}
