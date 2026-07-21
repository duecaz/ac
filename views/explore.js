// Public library. Browse activities with visibility=public. Fork to duplicate.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { newActivityId } from '../core/migrate.js';
import { save } from '../core/storage.js';
import { navigate } from '../core/router.js';
import { getTemplate } from '../core/registry.js';
import { PB_URL } from '../pocketbase.config.js';
import { pbEscape, pbFilterParam } from '../core/pbFilter.js';
import { isAdmin } from '../core/auth.js';
import { submitReport } from '../core/reports.js';
import { remove } from '../core/storage.js';
import { toast, confirmModal } from '../core/toast.js';

export async function renderExplore(rootSel) {
  mount(rootSel, html`
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h2 class="mb-0"><i class="bi bi-globe"></i> Explorar</h2>
      <div class="input-group" style="max-width:360px">
        <input id="exp-q" class="form-control" placeholder="Buscar por título o tag…">
        <select id="exp-lang" class="form-select" style="max-width:120px">
          <option value="">Todos</option>
          <option value="es" selected>Español</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="pt">Português</option>
        </select>
      </div>
    </div>
    <div id="exp-list">
      <div class="text-center py-5"><div class="spinner-border"></div></div>
    </div>
  `);

  let cache = [];
  async function load() {
    const lang = document.getElementById('exp-lang').value;
    // pbEscape/pbFilterParam (core/pbFilter.js): NUNCA encodeURIComponent a pelo
    // sobre el valor — no escapa la comilla simple del filtro `field='valor'`.
    const expr = `visibility='public'` + (lang ? ` && language='${pbEscape(lang)}'` : '');
    const url = `${PB_URL}/api/collections/activities/records?filter=${pbFilterParam(expr)}&sort=-updated&perPage=120`;
    try {
      const r = await fetch(url);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
      cache = (data.items || []).map(row => ({
        id: row.id,
        data: row.data || {},
        language: row.language || 'es',
        tags: row.tags || [],
        updated_at: row.updated,
      }));
    } catch (e) {
      document.getElementById('exp-list').innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message)}</div>`;
      return;
    }
    paint();
  }

  function paint() {
    const term = document.getElementById('exp-q').value.trim().toLowerCase();
    const filtered = cache.filter(r => {
      if (!term) return true;
      const a = r.data || {};
      return (a.title || '').toLowerCase().includes(term)
          || (a.subtitle || '').toLowerCase().includes(term)
          || (r.tags || []).some(t => String(t).toLowerCase().includes(term));
    });
    const list = document.getElementById('exp-list');
    if (!filtered.length) { list.innerHTML = `<p class="text-muted text-center py-5">Sin resultados.</p>`; return; }
    list.innerHTML = `<div class="row g-3">${filtered.map(r => card(r)).join('')}</div>`;
  }

  function card(r) {
    const a = r.data || {};
    const T = getTemplate(a.template);
    const tags = (r.tags || []).slice(0, 4);
    const dataId = a.id || r.id;
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || a.template)}</span>
              <small class="text-muted">${escapeHtml(r.language || 'es')}</small>
            </div>
            <h5 class="card-title mt-2">${escapeHtml(a.title || '')}</h5>
            <p class="card-text small text-muted">${escapeHtml(a.subtitle || '')}</p>
            <div>${tags.map(t => `<span class="badge bg-light text-dark border">${escapeHtml(t)}</span>`).join(' ')}</div>
          </div>
          <div class="card-footer d-flex gap-2 align-items-center">
            <button class="btn btn-success btn-sm flex-grow-1 exp-play" data-id="${escapeHtml(dataId)}"><i class="bi bi-play-fill"></i> Probar</button>
            <button class="btn btn-outline-primary btn-sm exp-fork" data-id="${escapeHtml(dataId)}"><i class="bi bi-files"></i> Duplicar</button>
            <button class="btn btn-link btn-sm text-muted exp-report" data-id="${escapeHtml(dataId)}" title="Reportar contenido"><i class="bi bi-flag"></i></button>
            ${isAdmin() ? `
              <button class="btn btn-outline-secondary btn-sm exp-admin-edit" data-id="${escapeHtml(dataId)}" title="Editar (admin)"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-outline-danger btn-sm exp-admin-del" data-id="${escapeHtml(dataId)}" title="Borrar (admin)"><i class="bi bi-trash3"></i></button>` : ''}
          </div>
        </div>
      </div>`;
  }

  on(rootSel, 'input', '#exp-q', () => paint());
  on(rootSel, 'change', '#exp-lang', () => load());
  on(rootSel, 'click', '.exp-play', async (_, b) => {
    const row = cache.find(r => (r.data?.id || r.id) === b.dataset.id);
    if (!row) return;
    const preview = { ...row.data, id: newActivityId(), forkOf: row.data.id, visibility: 'unlisted' };
    save(preview);
    navigate(`#/play/${preview.id}`);
  });
  on(rootSel, 'click', '.exp-fork', async (_, b) => {
    const row = cache.find(r => (r.data?.id || r.id) === b.dataset.id);
    if (!row) return;
    const fork = {
      ...row.data,
      id: newActivityId(),
      title: (row.data.title || '') + ' (copia)',
      forkOf: row.data.id,
      visibility: 'unlisted',
      author: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    save(fork);
    navigate(`#/edit/${fork.id}`);
  });
  on(rootSel, 'click', '.exp-report', async (_, b) => {
    try { await submitReport(b.dataset.id, 'Reportada desde Explorar'); toast('Gracias, lo revisaremos.', 'success'); }
    catch (e) { toast(e.message || 'Inicia sesión para reportar.', 'info', 4000); }
  });
  // Moderación admin: editar/borrar cualquier actividad pública (la regla PB lo respalda).
  on(rootSel, 'click', '.exp-admin-edit', (_, b) => navigate(`#/edit/${b.dataset.id}`));
  on(rootSel, 'click', '.exp-admin-del', async (_, b) => {
    const ok = await confirmModal('¿Borrar esta actividad de la biblioteca? (admin)', { okText: 'Borrar', danger: true });
    if (!ok) return;
    try { await remove(b.dataset.id); toast('Borrada.', 'success'); load(); }
    catch (e) { toast('No se pudo borrar: ' + e.message, 'danger', 5000); }
  });

  load();
}
