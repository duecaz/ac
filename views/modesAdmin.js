// Panel de diagnóstico de MODOS (solo lectura). Vista delgada sobre los datos
// puros de core/modeMatrix.js (testeable). Muestra qué modos soporta cada
// plantilla y por qué, y qué modos están disponibles en cada actividad — para
// ver de un vistazo a qué está "suscrita" cada cosa y detectar huecos.
import { html, escapeHtml, mount } from '../core/html.js';
import { MODE_DEFS } from '../core/modes.js';
import { templateCapabilities, activityAvailability, CONTRACT_METHODS } from '../core/modeMatrix.js';
import { list } from '../core/storage.js';
import { activityItemCount } from '../core/migrate.js';

const yes = '<span class="text-success fw-bold">✓</span>';
const no = '<span class="text-muted">·</span>';
const mark = (b) => (b ? yes : no);

export function renderModesAdmin(rootSel) {
  const caps = templateCapabilities();
  const acts = list();
  const avail = activityAvailability(acts);
  const countById = Object.fromEntries(acts.map(a => [a.id, activityItemCount(a)]));

  const capRows = caps.map(c => `
    <tr>
      <td><span class="badge bg-${c.color || 'secondary'}"><i class="bi ${c.icon}"></i> ${escapeHtml(c.label)}</span>
        <div class="small text-muted">${escapeHtml(c.name)} · ${escapeHtml(c.contentModel || '—')}</div></td>
      ${c.modes.map(m => `<td class="text-center" title="${escapeHtml(m.reason)}">${mark(m.supported)}</td>`).join('')}
      ${CONTRACT_METHODS.map(me => `<td class="text-center">${mark(c.methods[me])}</td>`).join('')}
    </tr>`).join('');

  const actRows = avail.map(r => `
    <tr>
      <td>${escapeHtml(r.title)}<div class="small text-muted">${escapeHtml(r.template)} · ${countById[r.id] ?? 0} elementos</div></td>
      ${r.modes.map(m => `<td class="text-center">${mark(m.available)}</td>`).join('')}
      <td><a class="btn btn-sm btn-outline-primary" href="#/play/${r.id}">Abrir</a></td>
    </tr>`).join('');

  mount(rootSel, html`
    <div class="container py-3">
      <a href="#/home" class="btn btn-sm btn-link p-0 mb-2"><i class="bi bi-arrow-left"></i> Inicio</a>
      <h3><i class="bi bi-diagram-3"></i> Modos y compatibilidad</h3>
      <p class="text-muted">Derivado del registro único (<code>core/modes.js</code>) y de lo que cada plantilla implementa.
        Si aquí un modo sale ✓, debe ofrecerse en el selector, el editor y la actividad.</p>

      <h5 class="mt-4">Capacidad por plantilla <small class="text-muted">(¿qué modos puede ofrecer?)</small></h5>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th>Plantilla</th>
              ${MODE_DEFS.map(m => `<th class="text-center" title="${escapeHtml(m.label)}">${escapeHtml(m.short)}</th>`).join('')}
              ${CONTRACT_METHODS.map(me => `<th class="text-center small">${me.replace('render', 'r·').replace('Submission', '')}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${capRows}</tbody>
        </table>
      </div>
      <p class="small text-muted">Pasa el cursor sobre una celda de modo para ver el motivo. La derecha = métodos del contrato implementados.</p>

      <h5 class="mt-4">Tus actividades <small class="text-muted">(¿qué modos están disponibles ahora?)</small></h5>
      ${acts.length ? `
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light">
            <tr><th>Actividad</th>${MODE_DEFS.map(m => `<th class="text-center">${escapeHtml(m.short)}</th>`).join('')}<th></th></tr>
          </thead>
          <tbody>${actRows}</tbody>
        </table>
      </div>` : '<p class="text-muted">No hay actividades guardadas todavía.</p>'}
    </div>`);
}
