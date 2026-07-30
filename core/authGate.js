// Gate de sesión (S1): las vistas de AUTORÍA (crear/editar/gestionar) exigen que el
// profe haya iniciado sesión con Google. Ver/jugar/explorar NO se gatean.
// Uso: en el router → requireTeacher(APP, () => renderEditView(APP, params)).
import { getUser, getAuthUserId } from './auth.js';
import { html, mount } from './html.js';
import { mountAuthSlot } from './authWidget.js';
import { backendName } from '../adapters/index.js';

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

// Gate de los modos que DIRIGEN una sesión compartida (sala en vivo, tareas).
// Existe por las reglas del servidor (§22: solo un token distingue host de
// alumno), así que donde NO hay servidor —backend `local`, que es el dev offline
// y el que usan los smokes headless— no hay nada que exigir: pedir cuenta ahí
// solo bloquea el desarrollo y las pruebas. En producción (PocketBase) gatea
// igual que requireTeacher.
/** ¿Puede este navegador DIRIGIR ahora mismo? Misma condición que requireHost,
 *  en forma síncrona, para que el BOTÓN (candado) y el GATE del router no digan
 *  cosas distintas: con sesión sí; y sin servidor (backend local) también. */
export function canHost() {
  return !!getAuthUserId() || backendName() === 'local';
}

export async function requireHost(rootSel, renderFn, opts = {}) {
  if (backendName() === 'local') return renderFn();
  return requireTeacher(rootSel, renderFn, opts);
}
