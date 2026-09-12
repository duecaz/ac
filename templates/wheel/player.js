// SVG-based spinning wheel for solo/practice mode. No scoring; just lands on a random entry.
import { html, escapeHtml, mount, raizDe } from '../../core/html.js';
import { on } from '../../core/events.js';
import { wheelSvg } from '../../core/ruleta/render.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { girar, clampSpinDur } from '../../core/ruleta/spin.js';
import { cabeceraHtml } from '../../core/playerHud.js';
import { wheelRules } from './template.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../core/contentModels/items.js').ItemsContentLegado} ItemsContentLegado
 */

// Support both old flat-entries format and new items format.
/** @param {Activity} activity @returns {string[]} */
function getEntries(activity) {
  const c = /** @type {ItemsContentLegado} */ (activity.content || {});
  if (Array.isArray(c.items)) return c.items.map(i => (typeof i === 'string' ? i : (i.question ?? i.q)) || '(vacío)');
  if (Array.isArray(c.entries)) return c.entries.map(e => String(e)).filter(e => e.trim()) || ['(vacío)'];
  return ['(vacío)'];
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export async function renderWheelPlayer(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  let entries = getEntries(activity);
  if (!entries.length) entries = ['(vacío)'];
  const rules = wheelRules(activity);
  const dur = clampSpinDur(rules.spinDurationMs);
  const remove = !!rules.removeAfterSpin;
  /** @type {string[]} */
  let history = [];
  let rotation = 0;
  let spinning = false;

  const rootEl = () => raizDe(rootSel);

  /** @param {string|null} [winner] */
  function paint(winner = null) {
    // ctx.alive() y no "¿existe el selector?": el selector es GENÉRICO y existe
    // también en la página del SIGUIENTE juego — con solo rootEl(), el giro
    // pendiente pintaba la Ruleta encima del VS de Emparejar (§23).
    if (!ctx.alive() || !rootEl()) return;
    const exhausted = entries.length === 0;
    // Subsecciones nombradas (D8): «rueda» + «panel» (resultado · botones ·
    // historial). El reparto vive en styles/wheel.css: columna en hueco alto,
    // fila —panel al costado— en hueco cuadrado/ancho.
    mount(rootSel, html`
      <div class="ww-wheel wh-play">
        ${cabeceraHtml({
          pagina: history.length ? `Giros: ${history.length}` : undefined,
          // «sin salir» solo tiene sentido si la opción se RETIRA al salir; con
          // `removeAfterSpin` apagado (el defecto) el número no bajaría nunca y
          // diría «8 sin salir» junto a un historial de 5.
          extra: remove ? `${entries.length} sin salir` : undefined,
        })}
        <div class="wh-flow">
          <div class="edu-sec edu-sec--tablero ww-wheel-stage">
            ${wheelSvg(entries, { rotation, dur, spinning: false })}
            <div class="ww-wheel-pointer">▶</div>
          </div>
          <div class="edu-sec edu-sec--panel wh-side">
            <div class="wh-result">
              ${winner != null ? `<div class="alert alert-success d-inline-block mb-0 fs-5"><b>${escapeHtml(winner)}</b></div>`
                : exhausted ? `<div class="text-muted">Se acabaron las opciones.</div>` : ''}
            </div>
            <div class="wh-actions">
              ${!exhausted ? `<button class="btn btn-primary btn-lg" id="btn-spin" ${spinning ? 'disabled' : ''}><i class="bi bi-arrow-repeat"></i> Girar</button>` : ''}
              ${(history.length || exhausted) ? `<button class="btn btn-outline-secondary btn-lg" id="btn-end" ${spinning ? 'disabled' : ''}><i class="bi bi-house"></i> Terminar</button>` : ''}
            </div>
            ${history.length ? `<div class="wh-history">Historial: ${history.map(escapeHtml).join(' · ')}</div>` : ''}
          </div>
        </div>
      </div>
    `);

    on(rootSel, 'click', '#btn-spin', spin);
    on(rootSel, 'click', '#btn-end', () => {
      ctx.finish({ title: 'Listo', stats: `${history.length} giro(s).`, score: history.length, maxScore: history.length });
    });
  }

  function spin() {
    if (spinning || entries.length === 0) return;
    spinning = true;

    const btnSpin = /** @type {HTMLButtonElement|null|undefined} */ (rootEl()?.querySelector('#btn-spin'));
    const btnEnd = /** @type {HTMLButtonElement|null|undefined} */ (rootEl()?.querySelector('#btn-end'));
    if (btnSpin) btnSpin.disabled = true;
    if (btnEnd) btnEnd.disabled = true;

    // El giro entero (elegir · animar · esperar · guard de vida) es de
    // core/ruleta/spin.js: aquí solo lo que es de ESTA ruleta (historial y
    // «se retira al salir»).
    rotation = girar({
      svg: rootEl()?.querySelector('svg'), rotation, count: entries.length, dur,
      vivo: () => ctx.alive() && !!rootEl(),
      alParar: (target, normalizada) => {
        spinning = false;
        const winner = entries[target];
        history.push(winner);
        if (remove) {
          entries = entries.filter((_, i) => i !== target);
          rotation = normalizada;
        }
        paint(winner);
      },
    });
  }

  paint();
}
