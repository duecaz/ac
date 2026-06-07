// SVG-based spinning wheel. No scoring; just lands on a random entry.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { normalizeEntries, pickIndex } from './logic.js';
import { wheelSvg } from './render.js';

const SPIN_TURNS = 5;
const MAX_DUR = 30000; // cap the spin so nobody sets a 5-minute wheel

function clampDur(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 4000;
  return Math.min(n, MAX_DUR);
}

export async function renderWheelPlayer(rootSel, activity, opts = {}) {
  // Snapshot so removeAfterSpin doesn't mutate the saved activity.
  let entries = normalizeEntries(activity.content?.entries);
  const dur = clampDur(activity.rules?.spinDurationMs);
  const remove = !!activity.rules?.removeAfterSpin;
  const startedAt = Date.now();
  let history = [];
  let rotation = 0;
  let spinning = false;

  const rootEl = () => (typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel);

  function paint(winner = null) {
    const exhausted = entries.length === 0; // all options drawn (removeAfterSpin)
    mount(rootSel, html`
      <div class="ww-wheel text-center py-3">
        <h3 class="mb-3">${escapeHtml(activity.title)}</h3>
        <div class="ww-wheel-stage" style="position:relative;display:inline-block">
          ${wheelSvg(entries, { rotation, dur, spinning: false })}
          <div class="ww-wheel-pointer" style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:36px;color:#000">▼</div>
        </div>
        <div class="mt-3" style="min-height:3.2rem">
          ${winner != null ? `<div class="alert alert-success d-inline-block mb-0 fs-5"><b>${escapeHtml(winner)}</b></div>`
            : exhausted ? `<div class="text-muted">Se acabaron las opciones.</div>` : ''}
        </div>
        <div class="mt-2">
          ${!exhausted ? `<button class="btn btn-primary btn-lg" id="btn-spin" ${spinning ? 'disabled' : ''}><i class="bi bi-arrow-repeat"></i> Girar</button>` : ''}
          ${(history.length || exhausted) ? `<button class="btn btn-outline-secondary btn-lg ${!exhausted ? 'ms-2' : ''}" id="btn-end" ${spinning ? 'disabled' : ''}><i class="bi bi-house"></i> Terminar</button>` : ''}
        </div>
        ${history.length ? `<div class="mt-3 small text-muted">Historial: ${history.map(escapeHtml).join(' · ')}</div>` : ''}
      </div>
    `);

    on(rootSel, 'click', '#btn-spin', spin);
    on(rootSel, 'click', '#btn-end', () => {
      mount(rootSel, html`<div class="text-center py-5"><i class="bi bi-trophy-fill display-1 text-warning"></i><h2 class="mt-3">Listo</h2>
        <p class="text-muted">${history.length} giro(s).</p>
        <a href="#/home" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a></div>`);
      if (opts.onFinish) opts.onFinish({ score: history.length, history, startedAt });
    });
  }

  function spin() {
    if (spinning || entries.length === 0) return;
    spinning = true;
    const count = entries.length;
    const target = pickIndex(count);
    const winner = entries[target]; // capture BEFORE any mutation
    const arc = 360 / count;
    // Always spin FORWARD from the current angle: round up to whole turns, add
    // the full spins, then the offset that centers `target` under the pointer.
    const base = Math.ceil((rotation + 1) / 360) * 360;
    rotation = base + 360 * SPIN_TURNS + (360 - (target * arc + arc / 2));

    // Animate the EXISTING svg (mount() creates it with transition:0 so the
    // first paint doesn't animate; here we turn the transition on and change
    // the transform, which is what actually makes it spin).
    const svg = rootEl()?.querySelector('svg');
    const btnSpin = rootEl()?.querySelector('#btn-spin');
    const btnEnd = rootEl()?.querySelector('#btn-end');
    if (btnSpin) btnSpin.disabled = true;
    if (btnEnd) btnEnd.disabled = true;
    if (svg) {
      svg.style.transition = `transform ${dur}ms cubic-bezier(.17,.67,.21,.99)`;
      svg.getBoundingClientRect?.(); // force reflow so the transition fires
      svg.style.transform = `rotate(${rotation}deg)`;
    }

    setTimeout(() => {
      spinning = false;
      history.push(winner);
      if (remove) {
        // Draw without replacement. Keep the wheel oriented where it landed
        // (mod 360) and drop the winner — when the last one is drawn the wheel
        // becomes empty: only the hub shows and "Girar" is hidden.
        entries = entries.filter((_, i) => i !== target);
        rotation = ((rotation % 360) + 360) % 360;
      }
      paint(winner);
    }, dur);
  }

  paint();
}
