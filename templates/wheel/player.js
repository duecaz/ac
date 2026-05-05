// SVG-based spinning wheel. No scoring; just lands on a random entry.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';

export async function renderWheelPlayer(rootSel, activity, opts = {}) {
  // Snapshot to avoid mutating activity.content.entries when removeAfterSpin
  // is enabled (otherwise re-entering the player keeps the trimmed list).
  let entries = (activity.content?.entries || []).slice().filter(e => String(e).trim());
  if (!entries.length) entries = ['(vacío)'];
  const dur = activity.rules?.spinDurationMs ?? 4000;
  const remove = !!activity.rules?.removeAfterSpin;
  const startedAt = Date.now();
  let history = [];

  function paint(rotation = 0, landedIdx = null, spinning = false) {
    const r = 180, cx = 200, cy = 200;
    const arc = (2 * Math.PI) / entries.length;
    const palette = ['#ef4444','#f59e0b','#10b981','#3b82f6','#a855f7','#ec4899','#14b8a6','#eab308'];
    const slices = entries.map((e, i) => {
      const a0 = -Math.PI/2 + i * arc;
      const a1 = a0 + arc;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const large = arc > Math.PI ? 1 : 0;
      const labelA = a0 + arc / 2;
      const lx = cx + (r * 0.65) * Math.cos(labelA);
      const ly = cy + (r * 0.65) * Math.sin(labelA);
      const deg = (labelA * 180 / Math.PI);
      return `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${palette[i % palette.length]}" stroke="#fff" stroke-width="2"/>
              <text x="${lx}" y="${ly}" fill="#fff" font-weight="700" font-size="14" text-anchor="middle" transform="rotate(${deg + 90} ${lx} ${ly})">${escapeHtml(String(e).slice(0,16))}</text>`;
    }).join('');

    mount(rootSel, html`
      <div class="text-center py-3">
        <h3 class="mb-3">${escapeHtml(activity.title)}</h3>
        <div style="position:relative;display:inline-block">
          <svg width="400" height="400" style="transform:rotate(${rotation}deg);transition:transform ${spinning ? dur : 0}ms cubic-bezier(.17,.67,.21,.99)">
            ${slices}
            <circle cx="${cx}" cy="${cy}" r="20" fill="#fff" stroke="#000" stroke-width="2"/>
          </svg>
          <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:36px;color:#000">▼</div>
        </div>
        <div class="mt-3">
          ${landedIdx != null ? `<div class="alert alert-success d-inline-block"><b>${escapeHtml(entries[landedIdx])}</b></div>` : ''}
        </div>
        <div class="mt-2">
          <button class="btn btn-primary btn-lg" id="btn-spin" ${spinning?'disabled':''}><i class="bi bi-arrow-repeat"></i> Girar</button>
          ${history.length ? `<button class="btn btn-outline-secondary btn-lg ms-2" id="btn-end"><i class="bi bi-house"></i> Terminar</button>` : ''}
        </div>
        ${history.length ? `<div class="mt-3 small text-muted">Historial: ${history.map(escapeHtml).join(' · ')}</div>` : ''}
      </div>
    `);

    on(rootSel, 'click', '#btn-spin', () => spin());
    on(rootSel, 'click', '#btn-end', () => {
      mount(rootSel, html`<div class="text-center py-5"><i class="bi bi-trophy-fill display-1 text-warning"></i><h2 class="mt-3">Listo</h2>
        <p class="text-muted">${history.length} giro(s).</p>
        <a href="#/home" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a></div>`);
      if (opts.onFinish) opts.onFinish({ score: history.length, history, startedAt });
    });
  }

  let rotation = 0;
  function spin() {
    const target = Math.floor(Math.random() * entries.length);
    const arc = 360 / entries.length;
    // Spin at least 5 full turns + land at target's center on top.
    const final = 360 * 5 + (360 - (target * arc + arc / 2));
    rotation = final;
    paint(rotation, null, true);
    setTimeout(() => {
      history.push(entries[target]);
      if (remove) entries = entries.filter((_, i) => i !== target);
      if (!entries.length) entries = ['(vacío)'];
      paint(rotation % 360, target, false);
    }, dur);
  }

  paint(0, null, false);
}
