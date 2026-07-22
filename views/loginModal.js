// Modal de inicio de sesión del profe. Dos vías:
//  - Google (OAuth) — cómodo en el equipo propio del profe.
//  - Correo + contraseña — para PIZARRAS interactivas donde no hay cuenta de
//    Google puesta; el admin puede crear estas cuentas (ver panel de Profesores).
import { html } from '../core/html.js';
import { signInWithGoogle, signIn } from '../core/auth.js';

let _open = false;

export function openLoginModal() {
  if (_open) return;
  _open = true;
  const host = document.createElement('div');
  host.className = 'login-modal';
  host.innerHTML = html`
    <div class="login-modal__backdrop" data-close></div>
    <div class="login-modal__card" role="dialog" aria-modal="true">
      <button class="login-modal__x" data-close title="Cerrar"><i class="bi bi-x-lg"></i></button>
      <h2 class="login-modal__title">Entrar</h2>
      <p class="login-modal__sub">Inicia sesión para crear y gestionar tus actividades.</p>

      <button class="login-modal__google" id="lm-google"><i class="bi bi-google"></i> Entrar con Google</button>

      <div class="login-modal__or"><span>o con correo</span></div>

      <form id="lm-form" class="login-modal__form">
        <input id="lm-email" class="login-modal__inp" type="email" placeholder="Correo" autocomplete="email" required>
        <input id="lm-pass" class="login-modal__inp" type="password" placeholder="Contraseña" autocomplete="current-password" required>
        <div id="lm-err" class="login-modal__err"></div>
        <button type="submit" class="login-modal__submit" id="lm-submit">Entrar</button>
      </form>
      <p class="login-modal__hint text-muted small mt-2 mb-0">¿No tienes cuenta? Entra con Google, o pídele al administrador que te cree un acceso de correo para las pizarras.</p>
    </div>`;
  document.body.appendChild(host);

  // Solo INICIO de sesión: el alta pública se retiró (biblioteca curada de
  // colegio). Cuentas nuevas = Google (autoservicio) o el admin las crea por
  // correo desde el panel Profesores (#/admin). Ver docs/handoff-acceso-docente.md U1.
  const $ = (id) => host.querySelector(id);
  const close = () => { _open = false; host.remove(); };

  host.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  $('#lm-google').addEventListener('click', async () => {
    try { await signInWithGoogle(); } // redirige
    catch (err) { showErr(err.message); }
  });
  $('#lm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#lm-email').value.trim();
    const pass = $('#lm-pass').value;
    if (!email || !pass) return showErr('Completa correo y contraseña.');
    $('#lm-submit').disabled = true;
    try {
      await signIn(email, pass);
      close(); // auth.js ya hizo notify() → la barra se repinta
    } catch (err) {
      showErr(err.message || 'No se pudo iniciar sesión.');
      $('#lm-submit').disabled = false;
    }
  });

  function showErr(m) { const el = $('#lm-err'); if (el) el.textContent = m || ''; }
}
