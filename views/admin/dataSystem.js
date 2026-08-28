// v1.51.629: adminView se partió POR PANEL. Esta sección agrupa «Datos»
// (exportar/importar todas las actividades) y «Sistema» (versión, backend,
// recargar/borrar caché) — dos h5 contiguas que comparten el mismo tipo de
// acción (mantenimiento del propio dispositivo), sin estado propio.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { VERSION } from '../../core/constants.js';
import { backendName } from '../../adapters/index.js';
import { downloadActivitiesJson, pickAndImport } from '../../core/io.js';
import { toast } from '../../core/toast.js';

export function createDataSystemSection({ caps, acts }) {
  return {
    html: () => `
      <h5 class="mt-3">Datos</h5>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button id="admin-import" class="btn btn-outline-secondary btn-sm"><i class="bi bi-file-earmark-arrow-up"></i> Importar actividades</button>
        <button id="admin-export" class="btn btn-outline-secondary btn-sm"><i class="bi bi-file-earmark-arrow-down"></i> Exportar todas</button>
      </div>

      <h5 class="mt-3">Sistema</h5>
      <table class="table table-sm w-auto">
        <tbody>
          <tr><th class="pe-3">Versión</th><td>v${escapeHtml(VERSION)}</td></tr>
          <tr><th class="pe-3">Backend</th><td>${escapeHtml(backendName())}</td></tr>
          <tr><th class="pe-3">Plantillas</th><td>${caps.length}</td></tr>
          <tr><th class="pe-3">Actividades (locales)</th><td>${acts.length}</td></tr>
        </tbody>
      </table>
      <div class="d-flex gap-2 flex-wrap mb-1">
        <button id="admin-refresh" class="btn btn-sm btn-outline-primary"><i class="bi bi-arrow-clockwise"></i> Borrar caché y recargar</button>
        <button id="admin-nuke-sw" class="btn btn-sm btn-outline-danger"><i class="bi bi-radioactive"></i> Eliminar Service Worker (agresivo)</button>
      </div>
      <p class="small text-muted">Si tras actualizar sigues viendo la versión vieja, usa el botón rojo: desregistra el SW, borra toda la caché y recarga. Mantiene tus datos.</p>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#admin-export', () => downloadActivitiesJson());
      on(rootSel, 'click', '#admin-import', () => {
        pickAndImport({ strategy: 'duplicate' }, (r) => {
          if (r.ok) toast(`Importadas ${r.count} actividades.`, 'success');
          else if (r.count) toast(`${r.count} importadas, ${r.errors.length} fallaron.`, 'warning', 6000);
          else toast('Error al importar: ' + r.errors.join('; '), 'danger', 6000);
        });
      });
      on(rootSel, 'click', '#admin-refresh', () => { (window.__wwRefresh || (() => location.reload()))(); });
      on(rootSel, 'click', '#admin-nuke-sw', () => { (window.__wwNukeSW || (() => location.reload()))(); });
    },
  };
}
