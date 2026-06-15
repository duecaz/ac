// Sign-in / sign-up modal. Renders into a Bootstrap modal element.
import { html, escapeHtml } from '../core/html.js';
import { signIn, signUp, signInWithGoogle, signOut, getUser, getProfile } from '../core/auth.js';

export function ensureAuthModal() {
  if (document.getElementById('ww-auth-modal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal fade" id="ww-auth-modal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Iniciar sesión</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <ul class="nav nav-pills mb-3" role="tablist">
              <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#auth-in">Entrar</button></li>
              <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#auth-up">Crear cuenta</button></li>
            </ul>
            <div class="tab-content">
              <div class="tab-pane fade show active" id="auth-in">
                <input id="auth-in-email" type="email" class="form-control mb-2" placeholder="Email">
                <input id="auth-in-pass" type="password" class="form-control mb-2" placeholder="Contraseña">
                <button id="auth-in-go" class="btn btn-primary w-100">Entrar</button>
              </div>
              <div class="tab-pane fade" id="auth-up">
                <input id="auth-up-name" class="form-control mb-2" placeholder="Nombre">
                <input id="auth-up-email" type="email" class="form-control mb-2" placeholder="Email">
                <input id="auth-up-pass" type="password" class="form-control mb-2" placeholder="Contraseña (mín 6)">
                <button id="auth-up-go" class="btn btn-primary w-100">Crear cuenta</button>
              </div>
            </div>
            <hr>
            <button id="auth-google" class="btn btn-outline-dark w-100"><i class="bi bi-google"></i> Continuar con Google</button>
            <div id="auth-err" class="text-danger small mt-3"></div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap.firstElementChild);

  document.getElementById('auth-in-go').onclick = async () => {
    const email = document.getElementById('auth-in-email').value.trim();
    const pass = document.getElementById('auth-in-pass').value;
    return doAuth(() => signIn(email, pass));
  };
  document.getElementById('auth-up-go').onclick = async () => {
    const name = document.getElementById('auth-up-name').value.trim();
    const email = document.getElementById('auth-up-email').value.trim();
    const pass = document.getElementById('auth-up-pass').value;
    return doAuth(() => signUp(email, pass, name));
  };
  document.getElementById('auth-google').onclick = async () => doAuth(signInWithGoogle);
}

async function doAuth(fn) {
  const err = document.getElementById('auth-err');
  err.textContent = '';
  try {
    await fn();
    bootstrap.Modal.getInstance(document.getElementById('ww-auth-modal'))?.hide();
    location.reload();
  } catch (e) {
    err.textContent = e.message;
  }
}

export function openAuthModal() {
  ensureAuthModal();
  new bootstrap.Modal(document.getElementById('ww-auth-modal')).show();
}

// Renders the navbar slot for auth state. Returns HTML string for inclusion
// in a parent and a separate function to attach handlers.
export async function renderAuthBadge(targetSel) {
  const target = typeof targetSel === 'string' ? document.querySelector(targetSel) : targetSel;
  if (!target) return;
  const u = await getUser();
  const p = await getProfile();
  if (!u || !u.email) {
    // Banco compartido anónimo: el login no hace falta (queda para el futuro
    // "privado con Google"). Ocultamos el CTA "Entrar" para no confundir; el
    // modal sigue accesible vía openAuthModal() si se reactiva.
    target.innerHTML = '';
    return;
  }
  const name = p?.display_name || u.email.split('@')[0];
  target.innerHTML = `
    <div class="dropdown">
      <button class="btn btn-sm btn-outline-light dropdown-toggle" data-bs-toggle="dropdown">
        <i class="bi bi-person-circle"></i> ${escapeHtml(name)}
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><span class="dropdown-item-text small text-muted">${escapeHtml(u.email)}</span></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="#/explore"><i class="bi bi-globe"></i> Explorar</a></li>
        <li><button class="dropdown-item" id="ww-signout"><i class="bi bi-box-arrow-right"></i> Salir</button></li>
      </ul>
    </div>`;
  target.querySelector('#ww-signout').onclick = async () => {
    await signOut(); location.reload();
  };
}
