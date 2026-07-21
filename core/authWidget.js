// Botón de sesión del profe en la barra superior (#ww-auth-slot).
// Deslogueado → "Entrar con Google". Logueado → nombre + "Salir".
// El login con Google desbloquea `owner` (seguridad PB) y, en Fase B, el envío
// de tareas a Google Classroom. Ver docs/handoff-google-classroom.md.
import { getUser, signOut, onAuthChange, isAdmin } from './auth.js';
import { escapeHtml } from './html.js';

let _wired = false;

export async function mountAuthSlot(selector = '#ww-auth-slot') {
  const slot = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!slot) return;

  async function paint() {
    const user = await getUser();
    // El botón "Admin" de la barra solo se muestra a administradores (auth v2).
    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.hidden = !isAdmin();
    if (user) {
      const name = user.name || user.email || 'Profe';
      slot.innerHTML = `
        <span class="ww-auth ww-auth--in d-inline-flex align-items-center gap-2">
          ${isAdmin() ? `<a href="#/moderar" class="btn btn-sm btn-outline-warning ww-auth__mod" title="Moderación"><i class="bi bi-flag"></i></a>` : ''}
          <span class="ww-auth__name" title="${escapeHtml(user.email || '')}">
            <i class="bi bi-person-check-fill"></i> ${escapeHtml(name)}
          </span>
          <button type="button" class="btn btn-sm btn-outline-secondary ww-auth__out" title="Cerrar sesión">Salir</button>
        </span>`;
    } else {
      slot.innerHTML = `
        <button type="button" class="btn btn-sm btn-light ww-auth__in d-inline-flex align-items-center gap-2" title="Iniciar sesión">
          <i class="bi bi-box-arrow-in-right"></i> Entrar
        </button>`;
    }
  }

  // Delegación en el slot (sobrevive a los repaints).
  if (!_wired) {
    _wired = true;
    slot.addEventListener('click', async (e) => {
      if (e.target.closest('.ww-auth__in')) {
        const { openLoginModal } = await import('../views/loginModal.js');
        openLoginModal(); // Google + correo/contraseña (pizarras sin Google)
      } else if (e.target.closest('.ww-auth__out')) {
        await signOut();
      }
    });
    onAuthChange(() => { paint(); });
  }
  await paint();
}
