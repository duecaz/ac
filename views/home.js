import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list, remove } from '../core/storage.js';
import { navigate } from '../core/router.js';
import { getTemplate, listTemplates } from '../core/registry.js';
import { confirmModal, toast } from '../core/toast.js';
import { downloadActivitiesJson, pickAndImport } from '../core/io.js';

function itemCount(a) {
  const c = a.content || {};
  return (c.items?.length ?? c.entries?.length ?? c.pairs?.length ?? c.groups?.length ?? c.words?.length ?? 0);
}

let _filter = { q: '', template: '' };

export function renderHome(rootSel) {
  const all = list();
  const templates = listTemplates();

  function paint() {
    const term = _filter.q.toLowerCase();
    const acts = all.filter(a => {
      if (_filter.template && a.template !== _filter.template) return false;
      if (!term) return true;
      return (a.title || '').toLowerCase().includes(term)
          || (a.subtitle || '').toLowerCase().includes(term)
          || (a.tags || []).some(t => String(t).toLowerCase().includes(term));
    });

    mount(rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 class="mb-0">Mis actividades</h2>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-outline-secondary" id="h-import" title="Importar JSON"><i class="bi bi-upload"></i> Importar</button>
          <button class="btn btn-outline-secondary" id="h-export-all" title="Exportar todas a JSON" ${all.length===0?'disabled':''}><i class="bi bi-download"></i> Exportar</button>
          <a href="#/new" class="btn btn-primary"><i class="bi bi-plus-lg"></i> Nueva</a>
        </div>
      </div>
      ${all.length === 0 ? '' : `
        <div class="row g-2 mb-3">
          <div class="col-md-7"><input id="h-q" class="form-control" placeholder="Buscar por título o tag…" value="${escapeHtml(_filter.q)}"></div>
          <div class="col-md-3">
            <select id="h-tpl" class="form-select">
              <option value="">Todas las plantillas</option>
              ${templates.map(T => `<option value="${T.meta.name}" ${_filter.template===T.meta.name?'selected':''}>${escapeHtml(T.meta.label)}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-center"><small class="text-muted">${acts.length} / ${all.length}</small></div>
        </div>
      `}
      ${acts.length === 0 ? (all.length === 0 ? `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-collection display-1"></i>
          <p class="mt-3">Aún no hay actividades. Crea la primera.</p>
        </div>` : `<p class="text-muted text-center py-4">Sin resultados con ese filtro.</p>`) : `
        <div class="row g-3">
          ${acts.map(card).join('')}
        </div>`}
    `);

    const qEl = document.getElementById('h-q');
    if (qEl) qEl.oninput = e => { _filter.q = e.target.value; paint(); qEl.focus(); };
    const tEl = document.getElementById('h-tpl');
    if (tEl) tEl.onchange = e => { _filter.template = e.target.value; paint(); };
  }

  function card(a) {
    const T = getTemplate(a.template);
    const m = T?.meta?.modes || { solo: true, live: false, async: false };
    return `
      <div class="col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between">
              <span class="badge bg-${T?.meta?.color || 'info'}"><i class="bi ${T?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(T?.meta?.label || a.template)}</span>
              <small class="text-muted">${itemCount(a)} elem.</small>
            </div>
            <h5 class="card-title mt-2">${escapeHtml(a.title)}</h5>
            <p class="card-text small text-muted">${escapeHtml(a.subtitle || '')}</p>
            ${(a.tags || []).length ? `<div>${a.tags.slice(0,4).map(t => `<span class="badge bg-light text-dark border me-1">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="card-footer d-flex gap-1 flex-wrap">
            ${m.solo ? `<button class="btn btn-success btn-sm flex-grow-1 act-play" data-id="${a.id}"><i class="bi bi-play-fill"></i> Empezar</button>` : ''}
            ${m.live ? `<button class="btn btn-warning btn-sm flex-grow-1 act-pin" data-id="${a.id}"><i class="bi bi-broadcast"></i> PIN</button>` : ''}
            ${m.async ? `<button class="btn btn-info btn-sm flex-grow-1 act-task" data-id="${a.id}" title="Tareas"><i class="bi bi-clipboard-check"></i></button>` : ''}
            <button class="btn btn-outline-primary btn-sm act-edit" data-id="${a.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-secondary btn-sm act-export" data-id="${a.id}" title="Exportar JSON"><i class="bi bi-download"></i></button>
            <button class="btn btn-outline-danger btn-sm act-del" data-id="${a.id}"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`;
  }

  on(rootSel, 'click', '#h-export-all', () => downloadActivitiesJson());
  on(rootSel, 'click', '#h-import', () => {
    pickAndImport({ strategy: 'duplicate' }, (r) => {
      if (r.ok) toast(`Importadas ${r.count} actividades.`, 'success');
      else if (r.count) toast(`${r.count} importadas, ${r.errors.length} fallaron.`, 'warning', 6000);
      else toast('Error al importar: ' + r.errors.join('; '), 'danger', 6000);
      renderHome(rootSel);
    });
  });
  on(rootSel, 'click', '.act-export', (_, b) => downloadActivitiesJson([b.dataset.id]));
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-pin', (_, b) => navigate(`#/launch/${b.dataset.id}`));
  on(rootSel, 'click', '.act-task', (_, b) => navigate(`#/tasks/${b.dataset.id}`));
  on(rootSel, 'click', '.act-edit', (_, b) => navigate(`#/edit/${b.dataset.id}`));
  on(rootSel, 'click', '.act-del', async (_, b) => {
    const ok = await confirmModal('¿Eliminar esta actividad?', { okText: 'Eliminar', danger: true });
    if (!ok) return;
    try {
      await remove(b.dataset.id);
      toast('Eliminada.', 'success');
    } catch (e) {
      toast('Eliminada localmente; no se pudo borrar en el servidor: ' + e.message, 'warning', 5000);
    }
    renderHome(rootSel);
  });

  paint();
}
