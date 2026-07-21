// Modal de inicio de sesión del profe. Dos vías:
//  - Google (OAuth) — cómodo en el equipo propio del profe.
//  - Correo + contraseña — para PIZARRAS interactivas donde no hay cuenta de
//    Google puesta; el admin puede crear estas cuentas (ver panel de Profesores).
import { html } from '../core/html.js';
import { signInWithGoogle, signIn, signUp } from '../core/auth.js';

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
        <div id="lm-name-row" hidden>
          <input id="lm-name" class="login-modal__inp" placeholder="Tu nombre" autocomplete="name">
        </div>
        <input id="lm-email" class="login-modal__inp" type="email" placeholder="Correo" autocomplete="email" required>
        <input id="lm-pass" class="login-modal__inp" type="password" placeholder="Contraseña" autocomplete="current-password" required>
        <div id="lm-err" class="login-modal__err"></div>
        <button type="submit" class="login-modal__submit" id="lm-submit">Entrar</button>
      </form>
      <button class="login-modal__toggle" id="lm-toggle">¿No tienes cuenta? Crear una</button>
    </div>`;
  document.body.appendChild(host);

  let mode = 'signin'; // 'signin' | 'signup'
  const $ = (id) => host.querySelector(id);
  const close = () => { _open = false; host.remove(); };

  host.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', close));
  $('#lm-google').addEventListener('click', async () => {
    try { await signInWithGoogle(); } // redirige
    catch (err) { showErr(err.message); }
  });
  $('#lm-toggle').addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    $('#lm-name-row').hidden = mode !== 'signup';
    $('#lm-submit').textContent = mode === 'signup' ? 'Crear cuenta' : 'Entrar';
    $('#lm-toggle').textContent = mode === 'signup' ? '¿Ya tienes cuenta? Entrar' : '¿No tienes cuenta? Crear una';
    showErr('');
  });
  $('#lm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#lm-email').value.trim();
    const pass = $('#lm-pass').value;
    if (!email || !pass) return showErr('Completa correo y contraseña.');
    if (mode === 'signup' && pass.length < 8) return showErr('La contraseña debe tener al menos 8 caracteres.');
    $('#lm-submit').disabled = true;
    try {
      if (mode === 'signup') await signUp(email, pass, $('#lm-name').value.trim());
      else await signIn(email, pass);
      close(); // auth.js ya hizo notify() → la barra se repinta
    } catch (err) {
      showErr(err.message || 'No se pudo iniciar sesión.');
      $('#lm-submit').disabled = false;
    }
  });

  function showErr(m) { const el = $('#lm-err'); if (el) el.textContent = m || ''; }
}
