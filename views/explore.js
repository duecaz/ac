// Public library. Browse activities with visibility=public. Fork to duplicate.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { newActivityId } from '../core/migrate.js';
import { save } from '../core/storage.js';
import { navigate } from '../core/router.js';
import { activityCardHtml } from '../core/activityCard.js';
import { PB_URL } from '../pocketbase.config.js';
import { pbEscape, pbFilterParam } from '../core/pbFilter.js';
import { isAdmin } from '../core/auth.js';
import { submitReport } from '../core/reports.js';
import { remove } from '../core/storage.js';
import { toast, confirmModal } from '../core/toast.js';

export async function renderExplore(rootSel) {
  mount(rootSel, html`
    <div class="home-wrap">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
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
    </div>
  `);

  let cache = [];
  async function load() {
    const lang = document.getElementById('exp-lang').value;
    // pbEscape/pbFilterParam (core/pbFilter.js): NUNCA encodeURIComponent a pelo
    // sobre el valor — no escapa la comilla simple del filtro `field='valor'`.
    const expr = `visibility='public'` + (lang ? ` && language='${pbEscape(lang)}'` : '');
    // SIN `sort=-updated`: la colección `activities` puede no tener el campo PB
    // `updated` (algunos setups no lo crean) → ese sort rompía la consulta con
    // "Something went wrong". Ordenamos en el cliente por el updatedAt que vive
    // dentro de cada actividad (data.updatedAt), que siempre existe.
    const url = `${PB_URL}/api/collections/activities/records?filter=${pbFilterParam(expr)}&perPage=120`;
    try {
      const r = await fetch(url);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
      cache = (data.items || []).map(row => ({
        id: row.id,
        data: row.data || {},
        language: row.language || 'es',
        tags: row.tags || [],
        updated_at: row.data?.updatedAt || row.updated || '',
      }));
      cache.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))); // más nuevas primero
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
    list.innerHTML = `<div class="home-grid">${filtered.map(r => card(r)).join('')}</div>`;
  }

  function card(r) {
    // Los tags e id "reales" viven en la fila PB (r.tags / r.id), fuera del blob
    // data → los normalizamos DENTRO de la actividad para la tarjeta compartida.
    const a = { ...(r.data || {}), id: r.data?.id || r.id, tags: r.tags || [] };
    const idE = escapeHtml(a.id);
    const topRight = `<small class="text-muted">${escapeHtml(r.language || 'es')}</small>`;
    const footer = `<div class="acard-actions">
        <button class="btn-primary-solid exp-play" data-id="${idE}"><i class="bi bi-play-fill"></i> Probar</button>
        <button class="btn-ghost exp-fork" data-id="${idE}"><i class="bi bi-files"></i> Duplicar</button>
        <button class="icon-btn exp-report" data-id="${idE}" title="Reportar contenido"><i class="bi bi-flag"></i></button>
        ${isAdmin() ? `<button class="icon-btn exp-admin-edit" data-id="${idE}" title="Editar (admin)"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn del exp-admin-del" data-id="${idE}" title="Borrar (admin)"><i class="bi bi-trash3"></i></button>` : ''}
      </div>`;
    return activityCardHtml(a, {
      modes: 'play', playablePreview: true, author: true, subtitle: true, tags: true, topRight, footer,
    });
  }

  on(rootSel, 'input', '#exp-q', () => paint());
  on(rootSel, 'change', '#exp-lang', () => load());
  // Preview clicable + tira de modos (Individual/VS/Equipos) de la tarjeta compartida.
  on(rootSel, 'click', '[data-play]', (_, b) => navigate(`#/play/${b.dataset.play}`));
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${b.dataset.id}`));
  on(rootSel, 'click', '.exp-play', async (_, b) => {
    // Jugar la actividad PÚBLICA por su id real. El player hace fallback a
    // getRemote() si no está en local (playerView), así que NO clonamos a PB —
    // antes cada "Probar" de un anónimo creaba una copia unlisted en el servidor
    // (basura acumulándose). Para quedarse una copia editable está "Duplicar".
    navigate(`#/play/${b.dataset.id}`);
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
