// Botón de sesión del profe en la barra superior (#ww-auth-slot).
// Deslogueado → "Entrar". Logueado → AVATAR (de Google/subido) + nombre + menú
// (Mi perfil / Salir). El avatar sale de la colección pública `profiles` (cache
// local), sellado por el login de Google. Ver core/profile.js y views/author.js.
import { getUser, signOut, onAuthChange, isAdmin, getAuthUserId } from './auth.js';
import { getLocalProfile } from './profile.js';
import { escapeHtml } from './html.js';

let _wired = false;

export async function mountAuthSlot(selector = '#ww-auth-slot') {
  const slot = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!slot) return;

  async function paint() {
    const user = await getUser();
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.hidden = !isAdmin();
    if (user) {
      const uid = getAuthUserId();
      const prof = getLocalProfile(uid);
      const name = prof.name || user.name || user.email || 'Profe';
      const av = prof.avatar
        ? `<img class="ww-auth__av" src="${escapeHtml(prof.avatar)}" alt="" referrerpolicy="no-referrer">`
        : `<span class="ww-auth__av ww-auth__av--ph"><i class="bi bi-person-fill"></i></span>`;
      slot.innerHTML = `
        <span class="ww-auth ww-auth--in" style="position:relative">
          ${isAdmin() ? `<a href="#/moderar" class="btn btn-sm btn-outline-warning ww-auth__mod" title="Moderación"><i class="bi bi-flag"></i></a>` : ''}
          <button type="button" class="ww-auth__btn" title="${escapeHtml(user.email || '')}">
            ${av}<span class="ww-auth__name">${escapeHtml(name)}</span><i class="bi bi-chevron-down small"></i>
          </button>
          <div class="ww-auth__menu" hidden>
            <a href="#/autor/${escapeHtml(uid)}" class="ww-auth__item ww-auth__profile"><i class="bi bi-person-badge"></i> Mi perfil</a>
            <button type="button" class="ww-auth__item ww-auth__out"><i class="bi bi-box-arrow-right"></i> Salir</button>
          </div>
        </span>`;
    } else {
      slot.innerHTML = `
        <button type="button" class="btn btn-sm btn-light ww-auth__in d-inline-flex align-items-center gap-2" title="Iniciar sesión">
          <i class="bi bi-box-arrow-in-right"></i> Entrar
        </button>`;
    }
  }

  if (!_wired) {
    _wired = true;
    slot.addEventListener('click', async (e) => {
      const menu = slot.querySelector('.ww-auth__menu');
      if (e.target.closest('.ww-auth__btn')) {
        if (menu) menu.hidden = !menu.hidden;
        return;
      }
      if (e.target.closest('.ww-auth__in')) {
        const { openLoginModal } = await import('../views/loginModal.js');
        openLoginModal();
      } else if (e.target.closest('.ww-auth__out')) {
        await signOut();
      } else if (e.target.closest('.ww-auth__profile')) {
        if (menu) menu.hidden = true;   // navega por el href; solo cerramos el menú
      }
    });
    // Cerrar el menú al hacer clic fuera.
    document.addEventListener('click', (e) => {
      if (slot.contains(e.target)) return;
      const menu = slot.querySelector('.ww-auth__menu');
      if (menu) menu.hidden = true;
    });
    onAuthChange(() => { paint(); });
  }
  await paint();
}
