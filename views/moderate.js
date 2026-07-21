// Moderación (S3) — solo para profes con role='admin' (Google). Lista los reportes
// de contenido y permite borrar el reporte o la actividad reportada. Ruta #/moderar.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { isAdmin } from '../core/auth.js';
import { listReports, deleteReport } from '../core/reports.js';
import { remove } from '../core/storage.js';
import { toast, confirmModal } from '../core/toast.js';

export async function renderModerate(rootSel) {
  if (!isAdmin()) {
    mount(rootSel, html`
      <div class="auth-gate"><div class="auth-gate__card">
        <div class="auth-gate__icon"><i class="bi bi-shield-lock"></i></div>
        <h1 class="auth-gate__title">Solo administradores</h1>
        <p class="auth-gate__sub">Esta sección es para moderadores. Si deberías tener acceso, pide que te asignen el rol admin.</p>
        <a href="#/" class="auth-gate__back"><i class="bi bi-arrow-left"></i> Volver a la portada</a>
      </div></div>`);
    return;
  }

  mount(rootSel, html`
    <div class="home-wrap">
      <div class="home-head"><div><h1><i class="bi bi-flag"></i> Moderación</h1>
        <p>Reportes de contenido de la biblioteca pública</p></div></div>
      <div id="mod-list"><div class="text-center py-5"><div class="spinner-border"></div></div></div>
    </div>`);

  async function load() {
    const reports = await listReports();
    const el = document.getElementById('mod-list');
    if (!el) return;
    if (!reports.length) { el.innerHTML = `<p class="text-muted text-center py-5">No hay reportes. 🎉</p>`; return; }
    el.innerHTML = `<div class="mod-reports">${reports.map(r => `
      <div class="mod-report" data-report="${escapeHtml(r.id)}" data-activity="${escapeHtml(r.activity)}">
        <div class="mod-report__main">
          <div class="mod-report__act"><i class="bi bi-puzzle"></i> ${escapeHtml(r.activity)}</div>
          ${r.reason ? `<div class="mod-report__reason">${escapeHtml(r.reason)}</div>` : ''}
          <div class="mod-report__meta">Por: ${escapeHtml(r.by || '—')} · ${escapeHtml((r.created || '').slice(0,10))}</div>
        </div>
        <div class="mod-report__actions">
          <button class="btn btn-sm btn-outline-primary mod-play"><i class="bi bi-play-fill"></i> Ver</button>
          <button class="btn btn-sm btn-outline-secondary mod-dismiss" title="Descartar reporte"><i class="bi bi-check2"></i> Descartar</button>
          <button class="btn btn-sm btn-outline-danger mod-delact" title="Borrar la actividad"><i class="bi bi-trash3"></i> Borrar actividad</button>
        </div>
      </div>`).join('')}</div>`;
  }

  const rowOf = (b) => b.closest('.mod-report');
  on(rootSel, 'click', '.mod-play', (_, b) => navigate(`#/play/${rowOf(b).dataset.activity}`));
  on(rootSel, 'click', '.mod-dismiss', async (_, b) => {
    try { await deleteReport(rowOf(b).dataset.report); toast('Reporte descartado.', 'success'); load(); }
    catch (e) { toast('No se pudo: ' + e.message, 'danger', 5000); }
  });
  on(rootSel, 'click', '.mod-delact', async (_, b) => {
    const ok = await confirmModal('¿Borrar la actividad reportada? (no se puede deshacer)', { okText: 'Borrar', danger: true });
    if (!ok) return;
    const row = rowOf(b);
    try {
      await remove(row.dataset.activity);
      await deleteReport(row.dataset.report).catch(() => {});
      toast('Actividad borrada.', 'success'); load();
    } catch (e) { toast('No se pudo borrar: ' + e.message, 'danger', 5000); }
  });

  load();
}
