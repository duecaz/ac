// Perfil público de un autor (#/autor/:id). Muestra su avatar (de Google si lo
// tiene), nombre, colegio, una frase y sus actividades PUBLICADAS. Si el que mira
// es el propio profe, puede editar colegio y frase. Estilo Wordwall.
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { getTemplate } from '../core/registry.js';
import { PB_URL } from '../pocketbase.config.js';
import { pbEscape, pbFilterParam } from '../core/pbFilter.js';
import { homePreviewHtml, previewBgStyle } from '../core/homePreview.js';
import { getAuthUserId, getAuthName } from '../core/auth.js';
import { getProfile, setProfile } from '../core/profile.js';
import { list, save } from '../core/storage.js';
import { toast } from '../core/toast.js';

export async function renderAuthor(rootSel, ownerId) {
  const isOwner = getAuthUserId() && getAuthUserId() === ownerId;

  mount(rootSel, html`
    <div class="home-wrap">
      <a href="#/explore" class="btn-ghost mb-2 d-inline-flex" style="width:auto"><i class="bi bi-arrow-left"></i> Explorar</a>
      <div id="au-head" class="author-head"></div>
      <div id="au-grid" class="home-grid"><div class="text-center py-5 w-100"><div class="spinner-border"></div></div></div>
    </div>`);

  // Perfil mostrado: para el dueño, su propio perfil local (fuente de verdad);
  // para un visitante, lo denormalizado dentro de las actividades del autor.
  let profile = { name: 'Profesor', school: '', bio: '', avatar: '' };

  function paintHead() {
    const head = document.getElementById('au-head');
    if (!head) return;
    const av = profile.avatar
      ? `<img class="author-avatar" src="${escapeHtml(profile.avatar)}" alt="" referrerpolicy="no-referrer">`
      : `<div class="author-avatar author-avatar--ph"><i class="bi bi-person-circle"></i></div>`;
    head.innerHTML = `
      <div class="author-id">
        ${av}
        <div class="author-meta">
          <h1 class="author-name">${escapeHtml(profile.name || 'Profesor')}</h1>
          ${profile.school ? `<div class="author-school"><i class="bi bi-building"></i> ${escapeHtml(profile.school)}</div>` : ''}
          ${profile.bio ? `<p class="author-bio">${escapeHtml(profile.bio)}</p>` : (isOwner ? `<p class="author-bio text-muted">Añade tu colegio y una frase para tu perfil.</p>` : '')}
        </div>
        ${isOwner ? `<button class="btn-ghost author-edit" id="au-edit" style="width:auto"><i class="bi bi-pencil"></i> Editar perfil</button>` : ''}
      </div>
      <div id="au-editform"></div>`;
  }

  function paintEditForm(open) {
    const box = document.getElementById('au-editform');
    if (!box) return;
    if (!open) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="author-editcard">
        <label class="small text-muted">Colegio / centro</label>
        <input id="au-school" class="login-modal__inp" maxlength="80" placeholder="Colegio, ciudad…" value="${escapeHtml(profile.school || '')}">
        <label class="small text-muted mt-2">Frase / sobre ti</label>
        <textarea id="au-bio" class="login-modal__inp" maxlength="240" rows="2" placeholder="Una frase que te describa (máx 240)">${escapeHtml(profile.bio || '')}</textarea>
        <div class="d-flex gap-2 mt-2">
          <button class="btn-primary-solid" id="au-save" style="width:auto">Guardar perfil</button>
          <button class="btn-ghost" id="au-cancel" style="width:auto">Cancelar</button>
        </div>
        <p class="small text-muted mt-2 mb-0">Se actualizará en todas tus actividades publicadas.</p>
      </div>`;
  }

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

    // Deriva el perfil mostrado.
    const fromRows = rows.find(a => a.author && (a.author.school || a.author.bio || a.author.avatar || a.author.name))?.author || {};
    if (isOwner) {
      const p = getProfile(ownerId);
      profile = { name: getAuthName() || fromRows.name || 'Profesor', school: p.school ?? fromRows.school ?? '', bio: p.bio ?? fromRows.bio ?? '', avatar: p.avatar || fromRows.avatar || '' };
    } else {
      profile = { name: fromRows.name || 'Profesor', school: fromRows.school || '', bio: fromRows.bio || '', avatar: fromRows.avatar || '' };
    }
    paintHead();

    const grid = document.getElementById('au-grid');
    if (!grid) return;
    if (!rows.length) {
      grid.innerHTML = `<p class="text-muted text-center py-4 w-100">${isOwner ? 'Aún no has publicado actividades. Publica una y aparecerá aquí.' : 'Este autor aún no ha publicado actividades.'}</p>`;
      return;
    }
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
  on(rootSel, 'click', '#au-edit', () => paintEditForm(true));
  on(rootSel, 'click', '#au-cancel', () => paintEditForm(false));
  on(rootSel, 'click', '#au-save', async (_, b) => {
    const school = (document.getElementById('au-school')?.value || '').trim();
    const bio = (document.getElementById('au-bio')?.value || '').trim();
    b.disabled = true;
    setProfile(ownerId, { school, bio });
    profile = { ...profile, school, bio };
    // Re-sella author en TODAS mis actividades (save re-denormaliza el perfil) para
    // que las públicas muestren el dato nuevo. Best-effort; local siempre queda.
    try {
      for (const a of list()) { if (a.author?.id === ownerId || !a.author?.id) save(a, { keepUpdatedAt: true }); }
      toast('Perfil actualizado.', 'success');
    } catch (e) { toast('Perfil guardado localmente; algunas actividades no se sincronizaron.', 'warning', 5000); }
    paintHead();
    paintEditForm(false);
  });

  load();
}
