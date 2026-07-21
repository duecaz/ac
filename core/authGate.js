// Gate de sesión (S1): las vistas de AUTORÍA (crear/editar/gestionar) exigen que el
// profe haya iniciado sesión con Google. Ver/jugar/explorar NO se gatean.
// Uso: en el router → requireTeacher(APP, () => renderEditView(APP, params)).
import { getUser } from './auth.js';
import { html, mount } from './html.js';
import { mountAuthSlot } from './authWidget.js';

// Pantalla amable de "entra para gestionar". Reusa el botón del authWidget.
function gateScreen(rootSel, { title, subtitle } = {}) {
  mount(rootSel, html`
    <div class="auth-gate">
      <div class="auth-gate__card">
        <div class="auth-gate__icon"><i class="bi bi-mortarboard-fill"></i></div>
        <h1 class="auth-gate__title">${title || 'Entra para crear tus actividades'}</h1>
        <p class="auth-gate__sub">${subtitle || 'Inicia sesión con Google para crear, editar y gestionar tus actividades. Ver y jugar es libre para todos.'}</p>
        <div class="auth-gate__cta" id="auth-gate-slot"></div>
        <a href="#/" class="auth-gate__back"><i class="bi bi-arrow-left"></i> Volver a la portada</a>
      </div>
    </div>
  `);
  mountAuthSlot('#auth-gate-slot').catch(() => {});
}

// Si hay sesión → ejecuta renderFn(); si no → pinta el gate. Async porque getUser
// puede consultar el almacenamiento/estado.
export async function requireTeacher(rootSel, renderFn, opts = {}) {
  const user = await getUser();
  if (user) return renderFn();
  gateScreen(rootSel, opts);
}
