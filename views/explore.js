// Biblioteca pública. Explora actividades con visibility=public. Se juegan por la
// tira de modos; editar/borrar viven en "Mis actividades", moderar en #/moderar.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { activityCardHtml } from '../core/activityCard.js';
import { PB_URL } from '../pocketbase.config.js';
import { pbEscape, pbFilterParam } from '../core/pbFilter.js';

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
    const topRight = `<small class="text-muted">${escapeHtml(r.language || 'es')}</small>`;
    // Sin pie de acciones: jugar se hace por la tira de modos (Individual/VS/
    // Equipos) o clic en el preview. Editar/borrar viven SOLO en "Mis
    // actividades" (son tuyas); para moderar como admin está la vista #/moderar.
    return activityCardHtml(a, {
      modes: 'play', playablePreview: true, author: true, subtitle: true, tags: true, topRight,
    });
  }

  on(rootSel, 'input', '#exp-q', () => paint());
  on(rootSel, 'change', '#exp-lang', () => load());
  // Jugar: preview clicable + tira de modos (Individual/VS/Equipos).
  on(rootSel, 'click', '[data-play]', (_, b) => navigate(`#/play/${b.dataset.play}`));
  on(rootSel, 'click', '.act-play', (_, b) => navigate(`#/play/${b.dataset.id}`));
  on(rootSel, 'click', '.act-vs', (_, b) => navigate(`#/vs/${b.dataset.id}`));
  on(rootSel, 'click', '.act-teams', (_, b) => navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${b.dataset.id}`));

  load();
}
