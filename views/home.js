import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list, remove } from '../core/storage.js';
import { mountThumb } from '../core/activityThumb.js';
import { navigate } from '../core/router.js';
import { getTemplate, listTemplates } from '../core/registry.js';
import { confirmModal, toast } from '../core/toast.js';
import { downloadActivitiesJson, pickAndImport } from '../core/io.js';
import { activityItemCount as itemCount } from '../core/migrate.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { getMode } from '../core/modes.js';

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
          <a href="#/admin" class="btn btn-outline-secondary" title="Panel de administración (modos, detalles, tests)"><i class="bi bi-shield-lock"></i> Admin</a>
          <a href="#/new-list" class="btn btn-outline-primary"><i class="bi bi-collection-play"></i> Nueva lista</a>
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

    // Mount a faithful 16:9 preview into each card.
    acts.forEach(a => {
      const el = document.querySelector(`.js-thumb[data-id="${a.id}"]`);
      if (el) mountThumb(el, a);
    });
  }

  function card(a) {
    if (a.template === 'list') return listCard(a);
    const T = getTemplate(a.template);
    const m = T?.meta?.modes || { solo: true, live: false, async: false };
    const color = T?.meta?.color || 'info';
    const icon  = T?.meta?.icon  || 'bi-puzzle';
    const label = T?.meta?.label || a.template;

    // Equipos solo si la plantilla lo soporta (renderRound o Memoria) y la
    // actividad tiene ítems suficientes — misma regla que la barra de modos.
    // Sin esto el botón salía hasta en Ruleta/Pregunta Live, que no lo admiten.
    const teamsMode = getMode('teams');
    const canTeams = teamsMode.supportsTemplate(T) && teamsMode.isAvailable(a);

    const playBtns = [
      m.solo             ? `<button class="btn btn-success act-play"  data-id="${a.id}" title="Individual"><i class="bi bi-person-fill"></i></button>` : '',
      isVsCompatible(a)  ? `<button class="btn btn-danger  act-vs"   data-id="${a.id}" title="VS"><i class="bi bi-fire"></i></button>` : '',
      canTeams           ? `<button class="btn btn-primary act-teams" data-id="${a.id}" data-tpl="${a.template}" title="Equipos"><i class="bi bi-people-fill"></i></button>` : '',
      m.live             ? `<button class="btn btn-warning  act-pin"  data-id="${a.id}" title="En vivo"><i class="bi bi-broadcast"></i></button>` : '',
      m.async            ? `<button class="btn btn-info     act-task" data-id="${a.id}" title="Tarea"><i class="bi bi-clipboard-check"></i></button>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="col-sm-6 col-xl-4">
        <div class="card h-100 border-0 rounded-4 shadow-sm overflow-hidden">
          <div class="js-thumb" data-id="${escapeHtml(a.id)}"></div>
          <div class="btn-group btn-group-sm w-100 card-modes" role="group">
            ${playBtns}
          </div>
          <div class="card-body pt-2 pb-3 px-3">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-${color}"><i class="bi ${icon}"></i> ${escapeHtml(label)}</span>
              <button class="card-icon-btn text-primary act-edit" data-id="${a.id}" title="Editar"><i class="bi bi-pencil-fill"></i></button>
              <button class="card-icon-btn text-danger act-del" data-id="${a.id}" title="Eliminar"><i class="bi bi-trash3"></i></button>
              ${a._unsynced ? '<i class="bi bi-cloud-slash text-warning" title="No sincronizada"></i>' : ''}
              <span class="ms-auto d-flex align-items-center gap-3 text-muted small">
                <span title="Elementos"><i class="bi bi-file-earmark-text"></i> ${itemCount(a)}</span>
                <span title="Me gusta (próximamente)"><i class="bi bi-heart-fill text-danger"></i> ${a.likes ?? 0}</span>
              </span>
            </div>
            <h6 class="card-title mb-0 fw-semibold">${escapeHtml(a.title)}</h6>
            ${a.subtitle ? `<p class="small text-muted mb-0 mt-1">${escapeHtml(a.subtitle)}</p>` : ''}
            ${(a.tags||[]).length ? `<div class="mt-1">${a.tags.slice(0,3).map(t=>`<span class="badge bg-light text-dark border me-1">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>`;
  }

  function listCard(a) {
    const rounds = (a.content?.items || []).length;
    return `
      <div class="col-sm-6 col-xl-4">
        <div class="card h-100 border-0 rounded-4 shadow-sm overflow-hidden">
          <div class="p-3 d-flex align-items-center gap-3" style="background:var(--bs-primary);color:#fff;min-height:72px">
            <i class="bi bi-collection-play-fill fs-2 opacity-75"></i>
            <div class="overflow-hidden">
              <div class="fw-semibold text-truncate">${escapeHtml(a.title)}</div>
              ${a.subtitle ? `<small class="opacity-75 text-truncate d-block">${escapeHtml(a.subtitle)}</small>` : ''}
            </div>
          </div>
          <div class="btn-group btn-group-sm w-100 card-modes" role="group">
            <button class="btn btn-primary act-list" data-id="${escapeHtml(a.id)}" title="Jugar lista">
              <i class="bi bi-play-fill"></i> Jugar
            </button>
          </div>
          <div class="card-body pt-2 pb-3 px-3">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-primary"><i class="bi bi-collection-play"></i> Lista</span>
              <button class="card-icon-btn text-primary act-edit-list" data-id="${escapeHtml(a.id)}" title="Editar lista"><i class="bi bi-pencil-fill"></i></button>
              <button class="card-icon-btn text-danger act-del" data-id="${escapeHtml(a.id)}" title="Eliminar"><i class="bi bi-trash3"></i></button>
              ${a._unsynced ? '<i class="bi bi-cloud-slash text-warning" title="No sincronizada"></i>' : ''}
              <span class="ms-auto text-muted small"><i class="bi bi-collection"></i> ${rounds} rondas</span>
            </div>
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
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${b.dataset.id}`));
  on(rootSel, 'click', '.act-pin', (_, b) => navigate(`#/launch/${b.dataset.id}`));
  on(rootSel, 'click', '.act-task', (_, b) => navigate(`#/tasks/${b.dataset.id}`));
  on(rootSel, 'click', '.act-list', (_, b) => navigate(`#/list/${b.dataset.id}`));
  on(rootSel, 'click', '.act-edit-list', (_, b) => navigate(`#/edit-list/${b.dataset.id}`));
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
