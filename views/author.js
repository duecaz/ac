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
import { getAuthUserId, getAuthName, changePassword, linkGoogle } from '../core/auth.js';
import { fetchProfile, getLocalProfile, saveProfile } from '../core/profile.js';
import { uploadMedia } from '../core/upload.js';
import { toast, confirmModal } from '../core/toast.js';

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
  let profile = { name: 'Profesor', school: '', bio: '', avatar: '', banner: '' };

  function paintHead() {
    const head = document.getElementById('au-head');
    if (!head) return;
    const av = profile.avatar
      ? `<img class="author-avatar" src="${escapeHtml(profile.avatar)}" alt="" referrerpolicy="no-referrer">`
      : `<div class="author-avatar author-avatar--ph"><i class="bi bi-person-circle"></i></div>`;
    const coverStyle = profile.banner ? ` style="background-image:url('${escapeHtml(profile.banner)}')"` : '';
    head.innerHTML = `
      <div class="author-cover${profile.banner ? ' has-img' : ''}"${coverStyle}>
        ${isOwner ? `<button class="author-cover__btn" id="au-cam-banner" title="Cambiar portada"><i class="bi bi-camera"></i> Portada</button>` : ''}
      </div>
      <div class="author-id">
        <div class="author-avatar-wrap">
          ${av}
          ${isOwner ? `<button class="author-avatar__btn" id="au-cam-avatar" title="Cambiar foto"><i class="bi bi-camera"></i></button>` : ''}
        </div>
        <div class="author-meta">
          <h1 class="author-name">${escapeHtml(profile.name || 'Profesor')}</h1>
          ${profile.school ? `<div class="author-school"><i class="bi bi-building"></i> ${escapeHtml(profile.school)}</div>` : ''}
          ${profile.bio ? `<p class="author-bio">${escapeHtml(profile.bio)}</p>` : (isOwner ? `<p class="author-bio text-muted">Añade tu colegio y una frase para tu perfil.</p>` : '')}
        </div>
        ${isOwner ? `<div class="author-actions">
          <button class="btn-ghost author-edit" id="au-edit" style="width:auto"><i class="bi bi-pencil"></i> Editar perfil</button>
          <button class="btn-ghost" id="au-account" style="width:auto"><i class="bi bi-shield-lock"></i> Cuenta</button>
        </div>` : ''}
      </div>
      <input type="file" id="au-file-avatar" accept="image/*" hidden>
      <input type="file" id="au-file-banner" accept="image/*" hidden>
      <div id="au-editform"></div>`;
  }

  function paintEditForm(open) {
    const box = document.getElementById('au-editform');
    if (!box) return;
    if (!open) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="author-editcard">
        <label class="small text-muted">Nombre visible</label>
        <input id="au-name" class="login-modal__inp" maxlength="60" placeholder="Tu nombre" value="${escapeHtml(profile.name || '')}">
        <label class="small text-muted mt-2">Colegio / centro</label>
        <input id="au-school" class="login-modal__inp" maxlength="80" placeholder="Colegio, ciudad…" value="${escapeHtml(profile.school || '')}">
        <label class="small text-muted mt-2">Frase / sobre ti</label>
        <textarea id="au-bio" class="login-modal__inp" maxlength="240" rows="2" placeholder="Una frase que te describa (máx 240)">${escapeHtml(profile.bio || '')}</textarea>
        <div class="d-flex gap-2 mt-2">
          <button class="btn-primary-solid" id="au-save" style="width:auto">Guardar perfil</button>
          <button class="btn-ghost" id="au-cancel" style="width:auto">Cancelar</button>
        </div>
        <p class="small text-muted mt-2 mb-0">Foto y portada: usa los botones de cámara arriba (máx 200 KB c/u).</p>
      </div>`;
  }

  // Cuenta (solo el dueño): cambiar contraseña + vincular Google.
  function paintAccount(open) {
    const box = document.getElementById('au-editform');
    if (!box) return;
    if (!open) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <div class="author-editcard">
        <h3 class="h6 mb-2"><i class="bi bi-key"></i> Cambiar contraseña</h3>
        <input id="au-pw-old" type="password" class="login-modal__inp" placeholder="Contraseña actual" autocomplete="current-password">
        <input id="au-pw-new" type="password" class="login-modal__inp mt-2" placeholder="Nueva contraseña (mín 8)" autocomplete="new-password">
        <button class="btn-primary-solid mt-2" id="au-pw-save" style="width:auto">Cambiar contraseña</button>
        <p class="small text-muted mt-1 mb-0">Así podrás entrar también con correo y contraseña (útil en pizarras sin Google).</p>
        <hr class="my-3">
        <h3 class="h6 mb-2"><i class="bi bi-google"></i> Vincular con Google</h3>
        <p class="small text-muted mb-2">Si te registraste con correo, asocia tu Google para entrar con un clic y traer tu foto.</p>
        <button class="btn-ghost" id="au-link-google" style="width:auto"><i class="bi bi-google"></i> Vincular mi cuenta de Google</button>
        <div class="d-flex gap-2 mt-3">
          <button class="btn-ghost" id="au-cancel" style="width:auto">Cerrar</button>
        </div>
      </div>`;
  }

  // Sube una imagen (avatar o banner), la guarda en el perfil y repinta.
  async function pickImage(kind) {
    const inp = document.getElementById(kind === 'avatar' ? 'au-file-avatar' : 'au-file-banner');
    if (!inp) return;
    inp.value = '';
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await uploadMedia(file);
        const merged = await saveProfile(ownerId, { [kind]: dataUrl });
        profile = { ...profile, ...merged };
        toast(kind === 'avatar' ? 'Foto actualizada.' : 'Portada actualizada.', 'success');
        paintHead();
      } catch (e) {
        toast('No se pudo guardar la imagen: ' + e.message, 'danger', 5000);
      }
    };
    inp.click();
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

    // Perfil desde la colección pública `profiles` (fuente de verdad). Respaldo: el
    // nombre etiquetado en las actividades, o el local (para el dueño, pintado ya).
    const nameFromRows = rows.find(a => a.author?.name)?.author?.name || '';
    const local = isOwner ? getLocalProfile(ownerId) : {};
    const remote = await fetchProfile(ownerId);
    profile = {
      name: remote.name || nameFromRows || (isOwner ? getAuthName() : '') || 'Profesor',
      school: remote.school || local.school || '',
      bio: remote.bio || local.bio || '',
      avatar: remote.avatar || local.avatar || '',
      banner: remote.banner || local.banner || '',
    };
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
  on(rootSel, 'click', '#au-account', () => paintAccount(true));
  on(rootSel, 'click', '#au-cancel', () => { paintEditForm(false); });
  on(rootSel, 'click', '#au-cam-avatar', () => pickImage('avatar'));
  on(rootSel, 'click', '#au-cam-banner', () => pickImage('banner'));
  on(rootSel, 'click', '#au-save', async (_, b) => {
    const name = (document.getElementById('au-name')?.value || '').trim();
    const school = (document.getElementById('au-school')?.value || '').trim();
    const bio = (document.getElementById('au-bio')?.value || '').trim();
    b.disabled = true;
    try {
      // Un solo sitio que actualizar: la fila `profiles` (no cada actividad).
      const merged = await saveProfile(ownerId, { name: name || getAuthName() || profile.name, school, bio });
      profile = { ...profile, ...merged };
      toast('Perfil actualizado.', 'success');
      paintHead();
      paintEditForm(false);
    } catch (e) {
      toast('No se pudo guardar el perfil: ' + e.message, 'danger', 5000);
      b.disabled = false;
    }
  });
  on(rootSel, 'click', '#au-pw-save', async (_, b) => {
    const oldP = document.getElementById('au-pw-old')?.value || '';
    const newP = document.getElementById('au-pw-new')?.value || '';
    b.disabled = true;
    try {
      await changePassword(oldP, newP);
      toast('Contraseña cambiada. Ya puedes entrar con correo y clave.', 'success');
      paintAccount(false);
    } catch (e) {
      toast(e.message, 'danger', 5000);
      b.disabled = false;
    }
  });
  on(rootSel, 'click', '#au-link-google', async (_, b) => {
    const ok = await confirmModal('Se abrirá Google para vincular tu cuenta. ¿Continuar?', { okText: 'Vincular' });
    if (!ok) return;
    b.disabled = true;
    try { await linkGoogle(); }   // redirige a Google; al volver queda vinculada
    catch (e) { toast(e.message, 'danger', 5000); b.disabled = false; }
  });

  load();
}
