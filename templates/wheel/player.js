// SVG-based spinning wheel for solo/practice mode. No scoring; just lands on a random entry.
import { html, escapeHtml, mount } from '../../core/html.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { on } from '../../core/events.js';
import { pickIndex } from './logic.js';
import { wheelSvg } from './render.js';

const SPIN_TURNS = 5;
const MAX_DUR = 30000;

function clampDur(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 4000;
  return Math.min(n, MAX_DUR);
}

// Support both old flat-entries format and new items format.
function getEntries(activity) {
  const c = activity.content || {};
  if (Array.isArray(c.items)) return c.items.map(i => (typeof i === 'string' ? i : i.q) || '(vacío)');
  if (Array.isArray(c.entries)) return c.entries.map(e => String(e)).filter(e => e.trim()) || ['(vacío)'];
  return ['(vacío)'];
}

export async function renderWheelPlayer(rootSel, activity, opts = {}) {
  let entries = getEntries(activity);
  if (!entries.length) entries = ['(vacío)'];
  const dur = clampDur(activity.rules?.spinDurationMs);
  const remove = !!activity.rules?.removeAfterSpin;
  const startedAt = Date.now();
  let history = [];
  let rotation = 0;
  let spinning = false;

  const rootEl = () => (typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel);

  function paint(winner = null) {
    if (!rootEl()) return;
    const exhausted = entries.length === 0;
    mount(rootSel, html`
      <div class="ww-wheel text-center py-3">
        <h3 class="mb-3">${escapeHtml(activity.title)}</h3>
        <div class="ww-wheel-stage" style="position:relative;display:inline-block">
          ${wheelSvg(entries, { rotation, dur, spinning: false })}
          <div class="ww-wheel-pointer" style="position:absolute;top:50%;left:-18px;transform:translateY(-50%);font-size:36px;color:#e53935;line-height:1">▶</div>
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
      mount(rootSel, resultScreenHtml({ title: 'Listo', stats: `${history.length} giro(s).` }));
      if (opts.onFinish) opts.onFinish({ score: history.length, history, startedAt });
    });
  }

  function spin() {
    if (spinning || entries.length === 0) return;
    spinning = true;
    const count = entries.length;
    const target = pickIndex(count);
    const winner = entries[target];
    const arc = 360 / count;
    const base = Math.ceil((rotation + 1) / 360) * 360;
    rotation = base + 360 * SPIN_TURNS + (360 - (target * arc + arc / 2)) - 90;

    const svg = rootEl()?.querySelector('svg');
    const btnSpin = rootEl()?.querySelector('#btn-spin');
    const btnEnd = rootEl()?.querySelector('#btn-end');
    if (btnSpin) btnSpin.disabled = true;
    if (btnEnd) btnEnd.disabled = true;
    if (svg) {
      svg.style.transition = `transform ${dur}ms cubic-bezier(.17,.67,.21,.99)`;
      svg.getBoundingClientRect?.();
      svg.style.transform = `rotate(${rotation}deg)`;
    }

    setTimeout(() => {
      spinning = false;
      if (!rootEl()) return;
      history.push(winner);
      if (remove) {
        entries = entries.filter((_, i) => i !== target);
        rotation = ((rotation % 360) + 360) % 360;
      }
      paint(winner);
    }, dur);
  }

  paint();
}
