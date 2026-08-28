// v1.51.629: adminView se partió POR PANEL. Esta sección es «Errores
// recientes»: el anillo local (core/errorLog.js, sin red) — últimos N en
// este dispositivo, con botón para limpiarlo.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { toast } from '../../core/toast.js';
import { recentErrors, clearErrors } from '../../core/errorLog.js';

// `rerender` = volver a pintar el panel entero (limpiar el registro cambia lo
// que esta MISMA sección muestra, y solo el ensamblador sabe repintarse).
export function createErrorLogSection({ rerender }) {
  const errLog = recentErrors();
  return {
    html: () => `
      <h5 class="mt-4">Errores recientes <small class="text-muted">(últimos ${errLog.length} en este dispositivo · anillo local, sin red)</small></h5>
      ${errLog.length ? `
        <button id="admin-err-clear" class="btn btn-sm btn-outline-secondary mb-2"><i class="bi bi-x-circle"></i> Limpiar registro</button>
        <div class="table-responsive"><table class="table table-sm table-bordered align-middle small">
          <thead class="table-light"><tr><th style="width:11rem">Cuándo</th><th>Mensaje</th><th style="width:5rem">Página</th></tr></thead>
          <tbody>${errLog.slice().reverse().map(e => `<tr>
            <td class="text-nowrap text-muted">${escapeHtml((e.at || '').replace('T', ' ').replace(/\.\d+Z$/, ''))}</td>
            <td><code class="text-danger">${escapeHtml(e.message || '')}</code>${e.stack ? `<details><summary class="small text-muted" style="cursor:pointer">stack</summary><pre class="small mb-0" style="white-space:pre-wrap">${escapeHtml(e.stack)}</pre></details>` : ''}</td>
            <td>${escapeHtml(e.page || '')}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
        : '<p class="text-muted">Sin errores registrados. 🎉</p>'}`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#admin-err-clear', () => { clearErrors(); toast('Registro de errores limpiado.', 'success'); rerender(); });
    },
  };
}
