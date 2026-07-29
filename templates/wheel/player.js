// SVG-based spinning wheel for solo/practice mode. No scoring; just lands on a random entry.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { pickIndex } from './logic.js';
import { wheelSvg } from './render.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { spinTarget, normalizeRotation, animateSpin, clampSpinDur } from './spin.js';

// Support both old flat-entries format and new items format.
function getEntries(activity) {
  const c = activity.content || {};
  if (Array.isArray(c.items)) return c.items.map(i => (typeof i === 'string' ? i : (i.question ?? i.q)) || '(vacío)');
  if (Array.isArray(c.entries)) return c.entries.map(e => String(e)).filter(e => e.trim()) || ['(vacío)'];
  return ['(vacío)'];
}

export async function renderWheelPlayer(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  let entries = getEntries(activity);
  if (!entries.length) entries = ['(vacío)'];
  const dur = clampSpinDur(activity.rules?.spinDurationMs);
  const remove = !!activity.rules?.removeAfterSpin;
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
      ctx.finish({ title: 'Listo', stats: `${history.length} giro(s).`, score: history.length, maxScore: history.length });
    });
  }

  function spin() {
    if (spinning || entries.length === 0) return;
    spinning = true;
    const count = entries.length;
    const target = pickIndex(count);
    const winner = entries[target];
    rotation = spinTarget(rotation, count, target);

    const btnSpin = rootEl()?.querySelector('#btn-spin');
    const btnEnd = rootEl()?.querySelector('#btn-end');
    if (btnSpin) btnSpin.disabled = true;
    if (btnEnd) btnEnd.disabled = true;
    animateSpin(rootEl()?.querySelector('svg'), rotation, dur);

    setTimeout(() => {
      spinning = false;
      if (!rootEl()) return;
      history.push(winner);
      if (remove) {
        entries = entries.filter((_, i) => i !== target);
        rotation = normalizeRotation(rotation);
      }
      paint(winner);
    }, dur);
  }

  paint();
}
