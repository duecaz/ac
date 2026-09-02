// v1.51.629: adminView se partió POR PANEL. Esta sección agrupa
// «Mantenimiento» (borrar TODAS las actividades del profe, dispositivo+nube)
// y «Base de datos» (probar conexión/latencia/ciclo real) — dos h5 contiguas
// que no comparten estado, pero sí el mismo tono: operaciones de purga/diagnóstico
// que no encajan en ninguna otra sección y no merecen un módulo cada una.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { list, remove } from '../../core/storage.js';
import { confirmModal, toast, TOAST_ERROR } from '../../core/toast.js';
import { diagnoseDb } from '../../core/dbDiag.js';

// `rerender` = volver a pintar el panel entero (lo necesita el wipe: cambia
// el nº de actividades que muestran OTRAS secciones). La llama el ensamblador.
export function createMaintenanceSection({ rerender }) {
  return {
    html: () => `
      <h5 class="mt-4">Mantenimiento</h5>
      <button id="admin-wipe" class="btn btn-outline-danger"><i class="bi bi-trash"></i> Borrar TODAS mis actividades (este dispositivo + nube)</button>
      <p class="small text-muted mt-1">Empieza de cero. No se puede deshacer. Mantiene tu identidad (no hace falta borrar la caché).</p>

      <h5 class="mt-4">Base de datos <small class="text-muted">(conexión, latencia y ciclo lectura/escritura/borrado real)</small></h5>
      <button id="admin-db" class="btn btn-primary"><i class="bi bi-database-check"></i> Probar base de datos</button>
      <div id="admin-db-out" class="mt-2"></div>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#admin-wipe', async () => {
        const ok = await confirmModal('¿Borrar TODAS tus actividades de este dispositivo y de la nube? No se puede deshacer.', { okText: 'Borrar todo', danger: true });
        if (!ok) return;
        const ids = list().map(a => a.id);
        // R6 · fallar en silencio está prohibido: antes se tragaba cada error y
        // decía "Listo: N borradas" aunque hubieran fallado TODAS — el profe se
        // quedaba creyendo que su nube estaba limpia. Se cuentan y se dicen.
        const fallos = [];
        for (const id of ids) {
          try { await remove(id); }
          catch (e) { fallos.push(`${id}: ${e.message}`); console.warn('[admin] no se pudo borrar', id, e); }
        }
        const hechas = ids.length - fallos.length;
        if (fallos.length) {
          toast(`Se borraron ${hechas} de ${ids.length}. ${fallos.length} no se pudieron borrar (¿sin conexión?): ${fallos.slice(0, 2).join(' · ')}`, 'warning', TOAST_ERROR);
        } else {
          toast(`Listo: ${ids.length} actividades borradas.`, 'success');
        }
        rerender();
      });
      on(rootSel, 'click', '#admin-db', async () => {
        const box = document.getElementById('admin-db-out');
        const btn = document.getElementById('admin-db');
        btn.disabled = true;
        box.innerHTML = `
          <div class="d-flex align-items-center gap-2 mb-2 text-muted">
            <span class="spinner-border spinner-border-sm"></span><small>Probando conexión…</small>
          </div>
          <ul id="db-list" class="list-group list-group-flush" style="font-size:.875rem"></ul>`;
        const ul = document.getElementById('db-list');
        let failed = 0;

        const fmtMs = (ms) => ms == null ? '' :
          `<span class="badge ${ms < 300 ? 'bg-success' : ms < 1000 ? 'bg-warning text-dark' : 'bg-danger'}">${ms} ms</span>`;

        const results = await diagnoseDb((r) => {
          if (!r.pass) failed++;
          const li = document.createElement('li');
          li.className = 'list-group-item d-flex justify-content-between align-items-center py-1 px-2';
          li.innerHTML = `
            <span>
              ${r.pass ? '<span class="text-success fw-semibold me-1">✓</span>' : '<span class="text-danger fw-semibold me-1">✗</span>'}
              ${escapeHtml(r.name)}
              ${r.info ? `<small class="text-muted ms-1">${escapeHtml(r.info)}</small>` : ''}
            </span>
            <span class="ms-2 text-nowrap">${fmtMs(r.ms)}</span>`;
          ul.appendChild(li);
        });

        const okCount = results.filter(r => r.pass).length;
        const allOk = failed === 0;
        const banner = document.createElement('div');
        banner.className = `alert ${allOk ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-2 small`;
        banner.innerHTML = allOk
          ? `<b>Conexión OK</b> · ${okCount}/${results.length} chequeos pasaron`
          : `<b>${failed} fallo(s)</b> · ${okCount}/${results.length} pasaron — revisa los detalles`;
        box.querySelector('.d-flex')?.remove();
        box.insertBefore(banner, ul);
        btn.disabled = false;
      });
    },
  };
}
