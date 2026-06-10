// Panel de diagnóstico de MODOS (solo lectura). Muestra, derivado del registro
// (core/modes.js) y de las clases de plantilla, qué modos soporta cada plantilla
// y por qué — para ver de un vistazo a qué está "suscrita" cada actividad y
// detectar huecos (en vez de descubrirlos jugando). No modifica nada.
import { html, escapeHtml, mount } from '../core/html.js';
import { listTemplates, getTemplate } from '../core/registry.js';
import { MODE_DEFS, modesForTemplate, availableModes } from '../core/modes.js';
import { list } from '../core/storage.js';
import { activityItemCount } from '../core/migrate.js';

const yes = '<span class="text-success fw-bold">✓</span>';
const no = '<span class="text-muted">·</span>';

// Métodos del contrato que habilitan modos (para la fila "implementa").
const METHODS = ['renderPlayer', 'renderEditor', 'renderRound', 'getRoundPayload', 'scoreSubmission', 'renderRoundHost'];

function methodChip(T, m) {
  return `<td class="text-center" title="${m}">${typeof T[m] === 'function' ? yes : no}</td>`;
}

// Por qué un modo (no) está disponible para una plantilla — el mismo criterio
// que core/modes.js, explicado en texto.
function reason(modeId, T) {
  const has = (m) => typeof T[m] === 'function';
  switch (modeId) {
    case 'solo': return 'siempre (renderPlayer)';
    case 'vs': return has('scoreSubmission') && has('renderRound') ? 'scoreSubmission + renderRound ✓ (en actividad: ≥2 ítems)' : 'falta ' + ['scoreSubmission', 'renderRound'].filter(m => !has(m)).join(' + ');
    case 'teams': return has('renderRound') ? 'renderRound ✓ (auto) o juez' : (T.meta?.name === 'memory' ? 'mecánica nativa de Memoria' : 'sin renderRound → solo juez no ofrecido aquí');
    case 'live': return T.meta?.modes?.live ? 'meta.modes.live ✓' : 'meta.modes.live = false';
    case 'task': return T.meta?.modes?.async ? 'meta.modes.async ✓' : 'meta.modes.async = false';
    default: return '';
  }
}

export function renderModesAdmin(rootSel) {
  const templates = listTemplates();

  const capRows = templates.map(T => {
    const supported = new Set(modesForTemplate(T).map(m => m.id));
    return `
      <tr>
        <td><span class="badge bg-${T.meta.color || 'secondary'}"><i class="bi ${T.meta.icon}"></i> ${escapeHtml(T.meta.label)}</span>
          <div class="small text-muted">${escapeHtml(T.meta.name)} · ${escapeHtml(T.meta.contentModel || '—')}</div></td>
        ${MODE_DEFS.map(m => `<td class="text-center" title="${escapeHtml(reason(m.id, T))}">${supported.has(m.id) ? yes : no}</td>`).join('')}
        ${METHODS.map(me => methodChip(T, me)).join('')}
      </tr>`;
  }).join('');

  const acts = list();
  const actRows = acts.map(a => {
    const T = getTemplate(a.template);
    const avail = new Set(availableModes(a).filter(m => m.isAvailable(a)).map(m => m.id));
    return `
      <tr>
        <td>${escapeHtml(a.title || '(sin título)')}<div class="small text-muted">${escapeHtml(a.template)} · ${activityItemCount(a)} elementos</div></td>
        ${MODE_DEFS.map(m => `<td class="text-center">${avail.has(m.id) ? yes : no}</td>`).join('')}
        <td><a class="btn btn-sm btn-outline-primary" href="#/play/${a.id}">Abrir</a></td>
      </tr>`;
  }).join('');

  mount(rootSel, html`
    <div class="container py-3">
      <a href="#/home" class="btn btn-sm btn-link p-0 mb-2"><i class="bi bi-arrow-left"></i> Inicio</a>
      <h3><i class="bi bi-diagram-3"></i> Modos y compatibilidad</h3>
      <p class="text-muted">Derivado del registro único (<code>core/modes.js</code>) y de lo que cada plantilla implementa.
        Esta es la fuente de verdad: si aquí un modo sale ✓, debe ofrecerse en el selector, el editor y la actividad.</p>

      <h5 class="mt-4">Capacidad por plantilla <small class="text-muted">(¿qué modos puede ofrecer?)</small></h5>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th>Plantilla</th>
              ${MODE_DEFS.map(m => `<th class="text-center" title="${escapeHtml(m.label)}">${escapeHtml(m.short)}</th>`).join('')}
              ${METHODS.map(me => `<th class="text-center small">${me.replace('render', 'r·').replace('Submission', '')}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${capRows}</tbody>
        </table>
      </div>
      <p class="small text-muted">Pasa el cursor sobre una celda de modo para ver el motivo. Las columnas de la derecha son los métodos del contrato implementados.</p>

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
