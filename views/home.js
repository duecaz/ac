import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { list, remove, get, save } from '../core/storage.js';
import { navigate } from '../core/router.js';
import { listTemplates } from '../core/registry.js';
import { confirmModal, toast } from '../core/toast.js';
import { activityItemCount as itemCount } from '../core/migrate.js';
import { activityCardHtml } from '../core/activityCard.js';
import { buildSwitchOptions } from './switchTemplate.js';
import { getAuthUserId } from '../core/auth.js';
import { modeAuthHint } from '../core/modes.js';
import { openLoginModal } from './loginModal.js';

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
      <div class="home-wrap">
        <div class="home-head">
          <div>
            <h1>Mis actividades</h1>
            <p>Gestiona y comparte tus actividades con tus alumnos</p>
          </div>
          <!-- "+ Nueva" junto al título. Importar/Exportar/Admin viven en la barra
               superior (nav); "Nueva lista" en la página "Elige una plantilla". -->
          <a href="#/new" class="btn-primary-solid"><i class="bi bi-plus-lg"></i> Nueva</a>
        </div>
        ${all.length === 0 ? '' : `
          <div class="home-tools">
            <div class="home-search">
              <i class="bi bi-search"></i>
              <input id="h-q" placeholder="Buscar por título o tag…" value="${escapeHtml(_filter.q)}">
            </div>
            <details class="home-filter${_filter.template ? ' is-set' : ''}">
              <summary class="home-config" title="Filtrar por plantilla" aria-label="Filtrar por plantilla"><i class="bi bi-sliders2"></i></summary>
              <div class="home-filter-pop">
                <div class="home-filter-label">Filtrar por plantilla</div>
                <select id="h-tpl">
                  <option value="">Todas las plantillas</option>
                  ${templates.map(T => `<option value="${T.meta.name}" ${_filter.template===T.meta.name?'selected':''}>${escapeHtml(T.meta.label)}</option>`).join('')}
                </select>
              </div>
            </details>
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
    // paint() re-monta toda la vista → el <input> se reemplaza. Hay que re-enfocar
    // el input NUEVO (no el viejo, ya desprendido) y restaurar el cursor, o el
    // buscador pierde el foco a la primera tecla.
    if (qEl) qEl.oninput = e => {
      _filter.q = e.target.value;
      const caret = e.target.selectionStart;
      paint();
      const q = document.getElementById('h-q');
      if (q) { q.focus(); try { q.setSelectionRange(caret, caret); } catch {} }
    };
    const tEl = document.getElementById('h-tpl');
    if (tEl) tEl.onchange = e => { _filter.template = e.target.value; paint(); };
  }

  function card(a) {
    if (a.template === 'list') return listCard(a);
    const n = itemCount(a);
    // Esquina sup-der (dueño): publicar/despublicar + editar + borrar.
    const topRight = `<div class="acard-icons">
        ${a.visibility === 'public'
          ? `<button class="pub-toggle is-pub act-unpublish" data-id="${a.id}" title="Publicada — clic para pasar a borrador"><i class="bi bi-globe"></i> Pública</button>`
          : `<button class="pub-toggle act-publish" data-id="${a.id}" title="Borrador — clic para publicar en la biblioteca"><i class="bi bi-eye-slash"></i> Borrador</button>`}
        <button class="icon-btn edit act-edit" data-id="${a.id}" title="Editar"><i class="bi bi-pencil-fill"></i></button>
        <button class="icon-btn del act-del" data-id="${a.id}" title="Eliminar"><i class="bi bi-trash3"></i></button>
        ${a._unsynced ? '<i class="bi bi-cloud-slash acard-unsync" title="No sincronizada"></i>' : ''}
      </div>`;
    // El gesto Wordwall a la vista: cuántos formatos hermanos puede jugar este
    // MISMO contenido (clic → editor, donde vive el selector de formato).
    const sibs = buildSwitchOptions(a).filter(o => o.valid);
    const footer = `<div class="acard-foot">
        <span title="Elementos"><i class="bi bi-collection"></i> ${n} ${n === 1 ? 'ítem' : 'ítems'}</span>
        ${sibs.length ? `<button class="acard-switch act-edit" data-id="${a.id}"
          title="Este contenido también funciona como: ${sibs.map(o => o.template.meta.label).join(' · ')}">
          <i class="bi bi-arrow-left-right"></i> ${sibs.length + 1} formatos</button>` : ''}
        <span title="Me gusta (próximamente)"><i class="bi bi-heart-fill heart"></i> ${a.likes ?? 0}</span>
      </div>`;
    // 'all' = incluye Live/Tarea (son actividades del dueño).
    // `authed`: sin sesión, Live/Tarea salen con CANDADO y su frase — dirigir una
    // sala o crear una tarea son actos de profe (ley §22). Avisar aquí, no con un
    // 403 a mitad de clase.
    return activityCardHtml(a, { modes: 'all', authed: !!getAuthUserId(), pages: true, subtitle: true, tags: true, topRight, footer });
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

  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${b.dataset.id}`));
  // Modo host-only con candado: no navegues a una pantalla que va a rebotar —
  // di POR QUÉ y ofrece entrar ahí mismo. La frase sale de core/modes.js (una
  // sola redacción para botón, tooltip, modal y gate del router).
  const hostClick = (mode, go) => (_, b) => {
    if (b.dataset.locked) {
      const hint = modeAuthHint(mode);
      toast(hint + '. Los alumnos NO necesitan cuenta.', 'info', 5000);
      openLoginModal({ reason: hint });
      return;
    }
    go(b.dataset.id);
  };
  on(rootSel, 'click', '.act-pin', hostClick('live', id => navigate(`#/launch/${id}`)));
  on(rootSel, 'click', '.act-task', hostClick('task', id => navigate(`#/tasks/${id}`)));
  on(rootSel, 'click', '.act-list', (_, b) => navigate(`#/list/${b.dataset.id}`));
  on(rootSel, 'click', '.act-edit-list', (_, b) => navigate(`#/edit-list/${b.dataset.id}`));
  on(rootSel, 'click', '.act-edit', (_, b) => navigate(`#/edit/${b.dataset.id}`));
  // Publicar / despublicar (S2): alterna visibility unlisted↔public. Publicar la
  // mete en la biblioteca pública; borrador la saca. Guarda y re-pinta.
  const setVisibility = async (id, visibility, msg) => {
    const a = get(id);
    if (!a) return;
    a.visibility = visibility;
    const { remote } = save(a);
    remote.catch(() => {});
    toast(msg, 'success');
    renderHome(rootSel);
  };
  on(rootSel, 'click', '.act-publish', (_, b) => setVisibility(b.dataset.id, 'public', 'Publicada en la biblioteca.'));
  on(rootSel, 'click', '.act-unpublish', (_, b) => setVisibility(b.dataset.id, 'unlisted', 'Pasada a borrador (fuera de la biblioteca).'));
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
