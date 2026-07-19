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

    const countLabel = _filter.q || _filter.template
      ? `${acts.length} de ${all.length}`
      : `${all.length} ${all.length === 1 ? 'actividad' : 'actividades'}`;

    mount(rootSel, html`
      <div class="home-wrap">
        <div class="home-head">
          <div>
            <h1>Mis actividades</h1>
            <p>Gestiona y comparte tus actividades con tus alumnos</p>
          </div>
          <div class="home-actions">
            <button class="btn-ghost" id="h-import" title="Importar JSON"><i class="bi bi-file-earmark-arrow-up"></i> Importar</button>
            <button class="btn-ghost" id="h-export-all" title="Exportar todas a JSON" ${all.length===0?'disabled':''}><i class="bi bi-file-earmark-arrow-down"></i> Exportar</button>
            <a href="#/admin" class="btn-ghost" title="Panel de administración (modos, detalles, tests)"><i class="bi bi-shield-lock"></i> Admin</a>
            <a href="#/new-list" class="btn-ghost"><i class="bi bi-collection-play"></i> Nueva lista</a>
            <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Nueva</a>
          </div>
        </div>
        ${all.length === 0 ? '' : `
          <div class="home-tools">
            <div class="home-search">
              <i class="bi bi-search"></i>
              <input id="h-q" placeholder="Buscar por título o tag…" value="${escapeHtml(_filter.q)}">
            </div>
            <div class="home-select">
              <select id="h-tpl">
                <option value="">Todas las plantillas</option>
                ${templates.map(T => `<option value="${T.meta.name}" ${_filter.template===T.meta.name?'selected':''}>${escapeHtml(T.meta.label)}</option>`).join('')}
              </select>
              <i class="bi bi-chevron-down"></i>
            </div>
            <span class="home-count">${countLabel}</span>
          </div>
        `}
        ${acts.length === 0 ? (all.length === 0 ? `
          <div class="home-empty">
            <i class="bi bi-collection"></i>
            <p>Aún no hay actividades. Crea la primera.</p>
          </div>` : `<div class="home-empty"><p>Sin resultados con ese filtro.</p></div>`) : `
          <div class="home-grid">
            ${acts.map(card).join('')}
          </div>`}
      </div>
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
      m.solo             ? `<button class="act-play mode-solo"   data-id="${a.id}" title="Individual"><i class="bi bi-person-fill"></i></button>` : '',
      isVsCompatible(a)  ? `<button class="act-vs mode-vs"       data-id="${a.id}" title="VS"><i class="bi bi-fire"></i></button>` : '',
      canTeams           ? `<button class="act-teams mode-teams" data-id="${a.id}" data-tpl="${a.template}" title="Equipos"><i class="bi bi-people-fill"></i></button>` : '',
      m.live             ? `<button class="act-pin mode-live"    data-id="${a.id}" title="En vivo"><i class="bi bi-broadcast"></i></button>` : '',
      m.async            ? `<button class="act-task mode-task"   data-id="${a.id}" title="Tarea"><i class="bi bi-clipboard-check"></i></button>` : '',
    ].filter(Boolean).join('');

    return `
      <article class="acard">
        <div class="acard-preview">
          <div class="js-thumb" data-id="${escapeHtml(a.id)}"></div>
        </div>
        ${playBtns ? `<div class="acard-modes">${playBtns}</div>` : ''}
        <div class="acard-body">
          <div class="acard-toprow">
            <span class="tag tag--${color}"><i class="bi ${icon}"></i> ${escapeHtml(label)}</span>
            <div class="acard-icons">
              <button class="icon-btn edit act-edit" data-id="${a.id}" title="Editar"><i class="bi bi-pencil-fill"></i></button>
              <button class="icon-btn del act-del" data-id="${a.id}" title="Eliminar"><i class="bi bi-trash3"></i></button>
              ${a._unsynced ? '<i class="bi bi-cloud-slash acard-unsync" title="No sincronizada"></i>' : ''}
            </div>
          </div>
          <h3 class="acard-title">${escapeHtml(a.title)}</h3>
          ${a.subtitle ? `<p class="acard-sub">${escapeHtml(a.subtitle)}</p>` : ''}
          ${(a.tags||[]).length ? `<div class="acard-tags">${a.tags.slice(0,3).map(t=>`<span class="t">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          <div class="acard-foot">
            <span title="Elementos"><i class="bi bi-file-earmark-text"></i> ${itemCount(a)}</span>
            <span title="Me gusta (próximamente)"><i class="bi bi-heart-fill heart"></i> ${a.likes ?? 0}</span>
          </div>
        </div>
      </article>`;
  }

  function listCard(a) {
    const rounds = (a.content?.items || []).length;
    return `
      <article class="acard">
        <div class="acard-listhead">
          <i class="bi bi-collection-play-fill"></i>
          <div class="overflow-hidden">
            <div class="t text-truncate">${escapeHtml(a.title)}</div>
            ${a.subtitle ? `<div class="s text-truncate">${escapeHtml(a.subtitle)}</div>` : ''}
          </div>
        </div>
        <div class="acard-modes">
          <button class="mode-list act-list" data-id="${escapeHtml(a.id)}" title="Jugar lista">
            <i class="bi bi-play-fill"></i> Jugar
          </button>
        </div>
        <div class="acard-body">
          <div class="acard-toprow">
            <span class="tag tag--primary"><i class="bi bi-collection-play"></i> Lista</span>
            <div class="acard-icons">
              <button class="icon-btn edit act-edit-list" data-id="${escapeHtml(a.id)}" title="Editar lista"><i class="bi bi-pencil-fill"></i></button>
              <button class="icon-btn del act-del" data-id="${escapeHtml(a.id)}" title="Eliminar"><i class="bi bi-trash3"></i></button>
              ${a._unsynced ? '<i class="bi bi-cloud-slash acard-unsync" title="No sincronizada"></i>' : ''}
            </div>
          </div>
          <div class="acard-foot" style="margin-top:8px">
            <span><i class="bi bi-collection"></i> ${rounds} rondas</span>
          </div>
        </div>
      </article>`;
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
