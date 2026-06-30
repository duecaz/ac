// Tablas de diagnóstico del panel admin (construcción PURA de HTML, extraída de
// adminView.js para aligerarlo):
//   · capacidad por plantilla (qué modos puede ofrecer + métodos del contrato),
//   · modos disponibles ahora por cada actividad guardada,
//   · conversiones de formato posibles entre plantillas.
import { escapeHtml } from '../../core/html.js';
import { templateCapabilities, activityAvailability, CONTRACT_METHODS } from '../../core/modeMatrix.js';
import { list } from '../../core/storage.js';
import { activityItemCount } from '../../core/migrate.js';
import { canConvert } from '../../kernel/content/convert.js';

const yes = '<span class="text-success fw-bold">✓</span>';
const no  = '<span class="text-muted">·</span>';
const mark = (b) => (b ? yes : no);

// Devuelve los conteos y las filas HTML ya construidas para el panel.
export function buildAdminMatrix() {
  const caps = templateCapabilities();
  const acts = list();
  const avail = activityAvailability(acts);
  const countById = Object.fromEntries(acts.map(a => [a.id, activityItemCount(a)]));

  const conv = caps.map(src => ({
    label: src.label, color: src.color, icon: src.icon,
    targets: caps.filter(dst => dst.name !== src.name && canConvert(src.contentModel, dst.contentModel))
      .map(dst => ({ label: dst.label, kind: dst.contentModel === src.contentModel ? 'directo' : 'conversión' })),
  }));
  const convRows = conv.map(c => `<tr>
      <td><span class="badge bg-${c.color || 'secondary'}"><i class="bi ${c.icon}"></i> ${escapeHtml(c.label)}</span></td>
      <td>${c.targets.length ? c.targets.map(t => `<span class="badge ${t.kind === 'directo' ? 'bg-success' : 'bg-info'} me-1 mb-1">${escapeHtml(t.label)} · ${t.kind}</span>`).join('') : '<span class="text-muted">—</span>'}</td>
    </tr>`).join('');

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

  return { caps, acts, capRows, actRows, convRows };
}
