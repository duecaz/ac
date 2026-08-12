// Crear cuenta de PROFE por correo (#/registro) — decisión del dueño 2026-08-11:
// no todos los profes tienen Google (o el colegio se lo capa). El alta es página
// propia (no modal): más campos, y sitio para explicar qué obtiene el profe.
// El servidor prohíbe traer `role` en el alta (nadie se registra como admin) —
// regla en tools/setup-pocketbase.ps1 (Apply-Users).
import { html, escapeHtml, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { navigate } from '../core/router.js';
import { getUser, signUp, signInWithGoogle } from '../core/auth.js';
import { saveProfile } from '../core/profile.js';
import { toast } from '../core/toast.js';

export async function renderRegistro(rootSel) {
  if (await getUser()) { navigate('#/mine'); return; }   // ya dentro: a su casa
  mount(rootSel, html`
    <div class="login-modal__card" style="max-width:430px;margin:2.5rem auto;position:static">
      <h2 class="login-modal__title">Crear cuenta de profe</h2>
      <p class="login-modal__sub">Para crear actividades, dirigir salas en vivo y mandar tareas.
        Tus alumnos <b>no</b> necesitan cuenta.</p>

      <button class="login-modal__google" id="rg-google"><i class="bi bi-google"></i> Crear con Google</button>
      <div class="login-modal__or"><span>o con correo</span></div>

      <form id="rg-form" class="login-modal__form">
        <input id="rg-email" class="login-modal__inp" type="email" placeholder="Correo" autocomplete="email" required>
        <input id="rg-name" class="login-modal__inp" type="text" maxlength="60" placeholder="Tu nombre" autocomplete="name" required>
        <input id="rg-school" class="login-modal__inp" type="text" maxlength="80" placeholder="Colegio / centro (opcional)">
        <input id="rg-pass" class="login-modal__inp" type="password" placeholder="Contraseña (mín 8)" autocomplete="new-password" required minlength="8">
        <input id="rg-pass2" class="login-modal__inp" type="password" placeholder="Repite la contraseña" autocomplete="new-password" required>
        <div id="rg-err" class="login-modal__err"></div>
        <button type="submit" class="login-modal__submit" id="rg-submit">Crear cuenta</button>
      </form>
      <p class="login-modal__hint text-muted small mt-2 mb-0">¿Ya tienes cuenta?
        <a href="#/" id="rg-entrar">Entra aquí</a>. Después podrás vincular tu Google desde tu perfil.</p>
    </div>`);

  const err = (m) => { const el = document.getElementById('rg-err'); if (el) el.textContent = m || ''; };

  on(rootSel, 'click', '#rg-google', async () => {
    try { await signInWithGoogle(); } catch (e) { err(e.message); }
  });
  on(rootSel, 'click', '#rg-entrar', async (e) => {
    e.preventDefault();
    const { openLoginModal } = await import('./loginModal.js');
    navigate('#/');
    openLoginModal();
  });
  on(rootSel, 'submit', '#rg-form', async (e) => {
    e.preventDefault();
    const v = (id) => document.getElementById(id)?.value ?? '';
    const email = v('rg-email').trim(), name = v('rg-name').trim(), school = v('rg-school').trim();
    const pass = v('rg-pass'), pass2 = v('rg-pass2');
    if (pass !== pass2) return err('Las contraseñas no coinciden.');
    const btn = document.getElementById('rg-submit');
    btn.disabled = true; err('');
    try {
      const { id } = await signUp(email, pass, name);
      // El colegio y el nombre van al perfil PÚBLICO (profiles, su dueño). Que
      // falle el perfil no tumba un alta ya hecha — se dice y se puede reintentar
      // desde "Mi perfil" (R6).
      try { await saveProfile(id, { name, ...(school ? { school } : {}) }); }
      catch (e2) { console.warn('[registro] cuenta creada; el perfil no se pudo sellar aún:', e2.message); }
      toast(`Cuenta creada. ¡Bienvenido, ${name}!`, 'success', 5000);
      navigate('#/mine');
    } catch (e2) {
      err(e2.message || 'No se pudo crear la cuenta.');
      btn.disabled = false;
    }
  });
}
