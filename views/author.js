// Perfil público de un autor (#/autor/:id). Muestra su nombre y sus actividades
// PUBLICADAS. Enlazado desde las tarjetas ("por X"). Estilo Wordwall.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { getTemplate } from '../core/registry.js';
import { PB_URL } from '../pocketbase.config.js';
import { pbEscape, pbFilterParam } from '../core/pbFilter.js';
import { homePreviewHtml, previewBgStyle } from '../core/homePreview.js';

export async function renderAuthor(rootSel, ownerId) {
  mount(rootSel, html`
    <div class="home-wrap">
      <a href="#/explore" class="btn-ghost mb-2 d-inline-flex" style="width:auto"><i class="bi bi-arrow-left"></i> Explorar</a>
      <div class="home-head"><div>
        <h1 id="au-name"><i class="bi bi-person-circle"></i> Perfil</h1>
        <p id="au-sub">Actividades publicadas</p>
      </div></div>
      <div id="au-grid" class="home-grid"><div class="text-center py-5 w-100"><div class="spinner-border"></div></div></div>
    </div>`);

  async function load() {
    let rows = [];
    try {
      const expr = `owner='${pbEscape(ownerId)}' && visibility='public'`;
      const r = await fetch(`${PB_URL}/api/collections/activities/records?filter=${pbFilterParam(expr)}&perPage=100`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `Error ${r.status}`);
      rows = (data.items || []).map(row => ({ ...(row.data || {}), id: row.data?.id || row.id }));
    } catch (e) {
      const g = document.getElementById('au-grid');
      if (g) g.innerHTML = `<p class="text-muted text-center py-4 w-100">No se pudo cargar el perfil.</p>`;
      return;
    }
    rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    const authorName = rows.find(a => a.author?.name)?.author?.name || 'Profesor';
    const nameEl = document.getElementById('au-name');
    const subEl = document.getElementById('au-sub');
    if (nameEl) nameEl.innerHTML = `<i class="bi bi-person-circle"></i> ${escapeHtml(authorName)}`;
    if (subEl) subEl.textContent = `${rows.length} ${rows.length === 1 ? 'actividad publicada' : 'actividades publicadas'}`;
    const grid = document.getElementById('au-grid');
    if (!grid) return;
    if (!rows.length) { grid.innerHTML = `<p class="text-muted text-center py-4 w-100">Este autor aún no ha publicado actividades.</p>`; return; }
    grid.innerHTML = rows.map(card).join('');
  }

  function card(a) {
    const T = getTemplate(a.template);
    const color = T?.meta?.color || 'info';
    const icon = T?.meta?.icon || 'bi-puzzle';
    const label = T?.meta?.label || a.template;
    const bg = previewBgStyle(a.presentation);
    return `
      <article class="acard">
        <div class="acard-preview lp-card__pv"${bg ? ` style="background:${bg}"` : ''} data-play="${escapeHtml(a.id)}" role="button" title="Jugar">
          ${homePreviewHtml(a)}
        </div>
        <div class="acard-body">
          <div class="acard-toprow">
            <span class="tag tag--${color}"><i class="bi ${icon}"></i> ${escapeHtml(label)}</span>
          </div>
          <h3 class="acard-title">${escapeHtml(a.title || 'Sin título')}</h3>
          <button class="btn-primary-solid w-100 lp-play" data-play="${escapeHtml(a.id)}"><i class="bi bi-play-fill"></i> Jugar</button>
        </div>
      </article>`;
  }

  on(rootSel, 'click', '[data-play]', (_, b) => navigate(`#/play/${b.dataset.play}`));
  load();
}
