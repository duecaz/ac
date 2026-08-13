// Modal de inicio de sesión del profe. Dos vías:
//  - Google (OAuth) — cómodo en el equipo propio del profe.
//  - Correo + contraseña — para PIZARRAS interactivas donde no hay cuenta de
//    Google puesta; el admin puede crear estas cuentas (ver panel de Profesores).
// …y la salida cuando la contraseña se pierde, que en una pizarra compartida
// pasa: «¿Olvidaste tu contraseña?» manda el correo de restablecimiento.
import { html, escapeHtml } from '../core/html.js';
import { signInWithGoogle, signIn, requestPasswordReset } from '../core/auth.js';

let _open = false;

/** `reason`: por qué se le pide entrar AHORA ("Inicia sesión para crear una sala
 *  en vivo"). La frase la fija core/modes.js y viaja hasta aquí para que el modal
 *  no diga algo distinto del botón que lo abrió. */
export function openLoginModal({ reason = '' } = {}) {
  if (_open) return;
  _open = true;
  const host = document.createElement('div');
  host.className = 'login-modal';
  host.innerHTML = html`
    <div class="login-modal__backdrop" data-close></div>
    <div class="login-modal__card" role="dialog" aria-modal="true">
      <button class="login-modal__x" data-close title="Cerrar"><i class="bi bi-x-lg"></i></button>
      <h2 class="login-modal__title">Entrar</h2>
      <p class="login-modal__sub">${reason ? escapeHtml(reason) + '. Tus alumnos no necesitan cuenta.'
        : 'Inicia sesión para crear y gestionar tus actividades.'}</p>

      <button class="login-modal__google" id="lm-google"><i class="bi bi-google"></i> Entrar con Google</button>

      <div class="login-modal__or"><span>o con correo</span></div>

      <form id="lm-form" class="login-modal__form">
        <input id="lm-email" class="login-modal__inp" type="email" placeholder="Correo" autocomplete="email" required>
        <input id="lm-pass" class="login-modal__inp" type="password" placeholder="Contraseña" autocomplete="current-password" required>
        <div id="lm-err" class="login-modal__err"></div>
        <button type="submit" class="login-modal__submit" id="lm-submit">Entrar</button>
      </form>
      <p class="login-modal__hint text-muted small mt-2 mb-1">
        <a href="#" id="lm-forgot">¿Olvidaste tu contraseña?</a></p>
      <p class="login-modal__hint text-muted small mb-0">¿No tienes cuenta?
        <a href="#/registro" data-close>Créala aquí</a> — solo correo, nombre y contraseña.</p>
    </div>`;
  document.body.appendChild(host);

  // Inicio de sesión + enlace al ALTA (#/registro, reabierta por decisión del
  // dueño 2026-08-11; U1 la había cerrado). El admin sigue pudiendo crear
  // accesos de pizarra desde el panel Profesores (#/admin).
  const $ = (id) => host.querySelector(id);
  const close = () => { _open = false; host.remove(); window.removeEventListener('hashchange', close); };
  // El modal vive en <body> (fuera de #app), así que el router no lo desmonta:
  // si se navega con él abierto quedaba huérfano encima de la vista nueva y
  // `_open` bloqueaba reabrirlo (ley de vista §23). Navegar = cerrarlo.
  window.addEventListener('hashchange', close);

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

  // ¿OLVIDASTE TU CONTRASEÑA? Activado el 2026-08-13, cuando el correo saliente
  // de la Pi quedó configurado y PROBADO (tools/pb-smtp.sh). Antes el enlace no
  // podía existir: PocketBase habría aceptado la petición y no habría salido
  // ningún correo — un botón que promete algo que no ocurre es peor que no
  // tenerlo.
  $('#lm-forgot').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = $('#lm-email').value.trim();
    // Se reutiliza el campo de arriba en vez de abrir otra pantalla: si ya lo
    // escribió, un toque; si no, se le pide ahí mismo y el foco lo lleva.
    if (!email) { $('#lm-email').focus(); return showErr('Escribe tu correo arriba y vuelve a pulsar.'); }
    const enlace = $('#lm-forgot');
    enlace.textContent = 'Enviando…';
    try {
      await requestPasswordReset(email);
      // MISMA respuesta exista o no la cuenta: decir «ese correo no está
      // registrado» convierte este formulario en un comprobador de quién tiene
      // cuenta. PocketBase responde igual a propósito; aquí no se deshace.
      showErr('');
      enlace.outerHTML = `<span class="text-success">Si <b>${escapeHtml(email)}</b> tiene cuenta, `
        + 'le llega un correo con el enlace para cambiar la contraseña. Mira también la carpeta de spam.</span>';
    } catch (err) {
      enlace.textContent = '¿Olvidaste tu contraseña?';
      showErr(err.message || 'No se pudo enviar el correo. Inténtalo en un minuto.');
    }
  });

  function showErr(m) { const el = $('#lm-err'); if (el) el.textContent = m || ''; }
}
