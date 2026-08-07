import { installErrorHandlers } from './core/errorLog.js';
import { route, start, navigate, setNotFound, setBeforeResolve, resolve } from './core/router.js';
import { clearListeners } from './core/events.js';

installErrorHandlers('teacher');

// Templates: each module self-registers via registerTemplate(...).
import './core/registerTemplates.js';

import { renderHome } from './views/home.js';
import { renderLanding } from './views/landing.js';
import { renderTemplateSelector } from './views/templateSelector.js';
import { renderPlayerView } from './views/playerView.js';
import { renderSorteoView } from './views/sorteoView.js';
import { renderEditView } from './views/editView.js';
import { renderHostLaunch, renderHostByCode } from './views/hostLive.js';
import { renderReports, renderActivityReport, renderSessionReport } from './views/reports.js';
import { renderAssignmentsForActivity, renderAttempts } from './views/assignments.js';
import { renderListView } from './views/listView.js';
import { renderEditList } from './views/editList.js';
import { renderExplore } from './views/explore.js';
import { renderJuegos } from './views/juegos.js';
import { renderModerate } from './views/moderate.js';
import { renderAuthor } from './views/author.js';
import { renderAdmin } from './views/adminView.js';
import { sync, setStorageUser, claimGuestActivities, retryUnsynced } from './core/storage.js';
import { ensureIdentity } from './core/identity.js';
import { authRefresh, completeOAuthLogin, getAuthUserId, onAuthChange } from './core/auth.js';
import { mountAuthSlot } from './core/authWidget.js';
import { requireTeacher, requireHost } from './core/authGate.js';
import { modeAuthHint } from './core/modes.js';
import { applySkin } from './core/skins.js';
// Side-effect: boot.js wires sounds + visual effects to the GameEvents bus and
// exposes the navbar helpers (version stamp + mute button).
import { stampVersion } from './core/boot.js';
import { initCustomAnims } from './core/vsAnimations.js';
import { html, mount } from './core/html.js';

const APP = '#app';

// LA ENTRADA (§7c): el profe CON sesión va directo a Mis actividades — viene con
// prisa y a por su material; el escaparate es para quien llega de fuera. Sin
// sesión, la portada pública (que le habla AL PROFE, no al alumno).
route('#/', async () => {
  const { getUser } = await import('./core/auth.js');
  if (await getUser()) return navigate('#/mine');
  renderLanding(APP);
});
// #/home → redirección compatible a Mis actividades.
route('#/home', () => navigate('#/mine'));
// "Mis actividades" (renderHome): NO se gatea VER (transición segura — un profe que
// aún no configuró Google sigue viendo sus borradores locales; ver es libre). Crear
// y editar SÍ exigen sesión (gate en #/new, #/edit*).
route('#/mine', () => renderHome(APP));
// Autoría (crear/editar/gestionar) → requiere sesión de profe (S1). Ver/jugar libre.
route('#/new', () => requireTeacher(APP, () => renderTemplateSelector(APP)));
route('#/edit-new/:template', ({ template }) => requireTeacher(APP, () => renderEditView(APP, { template })));
route('#/edit/:id', ({ id }) => requireTeacher(APP, () => renderEditView(APP, { id })));
route('#/play/:id', ({ id }) => renderPlayerView(APP, id));
route('#/vs/:id', ({ id }) => renderPlayerView(APP, id, 'vs'));
route('#/teams/:id', ({ id }) => renderPlayerView(APP, id, 'teams'));
route('#/memory/:id', ({ id }) => renderPlayerView(APP, id, 'teams'));
// DIRIGIR una sala en vivo exige sesión de profe (ley §22: el veredicto lo pone
// el host, y el servidor solo distingue host de alumno por el token). Se gatea en
// el ROUTER, no dentro de la vista, para que el aviso llegue ANTES de intentar
// crear la sala — descubrirlo con un 403 y la clase delante es el peor momento.
// El ALUMNO no pasa por aquí: entra con el PIN, sin cuenta.
route('#/launch/:id', ({ id }) => requireHost(APP, () => renderHostLaunch(APP, id), {
  title: 'Entra para dirigir la clase en vivo',
  subtitle: modeAuthHint('live') + '. Tus alumnos NO necesitan cuenta: entran con el PIN desde su móvil.',
}));
// Reentrar a una sala ya creada es el MISMO acto de profe (avanzar fase, revelar,
// puntuar = escrituras host-only): si la sesión caducó, mejor el gate claro que un
// 403 silencioso al pulsar "Siguiente".
route('#/host/:code', ({ code }) => requireHost(APP, () => renderHostByCode(APP, code), {
  title: 'Entra para dirigir la clase en vivo',
  subtitle: modeAuthHint('live') + '. Tus alumnos NO necesitan cuenta: entran con el PIN desde su móvil.',
}));
route('#/reports', () => renderReports(APP));
route('#/reports/session/:id', ({ id }) => renderSessionReport(APP, id));
route('#/reports/:id', ({ id }) => renderActivityReport(APP, id));
route('#/tasks/:id', ({ id }) => requireHost(APP, () => renderAssignmentsForActivity(APP, id), {
  title: 'Entra para crear tareas',
  subtitle: modeAuthHint('task') + '. Tus alumnos la hacen con el código de la tarea, sin cuenta.',
}));
route('#/task/:id/attempts', ({ id }) => renderAttempts(APP, id));
route('#/list/:id', ({ id }) => renderListView(APP, id));
route('#/edit-list/:id', ({ id }) => requireTeacher(APP, () => renderEditList(APP, { id })));
route('#/new-list', () => requireTeacher(APP, () => renderEditList(APP, {})));
route('#/explore', (_, q) => renderExplore(APP, q?.q || ''));
route('#/juegos', () => renderJuegos(APP));   // la estantería (§4c/§7c): sin crear, sin login
route('#/autor/:id', ({ id }) => renderAuthor(APP, id));
route('#/moderar', () => renderModerate(APP));
route('#/admin', () => renderAdmin(APP));
route('#/modos', () => renderAdmin(APP));
route('#/sorteo', () => renderSorteoView(APP));

setNotFound(() => mount(APP, html`<div class="alert alert-warning">Ruta no encontrada. <a href="#/home">Inicio</a></div>`));

// Antes de renderizar cada vista, suelta los handlers delegados que la vista
// anterior dejó en #app (raíz compartida y estable). Sin esto, p.ej. los
// handlers .skin-pick/.bg-pick del player seguían vivos al entrar al editor
// (mismas clases) → "mount: root not found" + el tema saltaba a <body>.
setBeforeResolve(() => clearListeners(APP));

(async function boot() {
  // Baseline NEUTRO del chrome. Antes leía `ww.skin` de localStorage — una
  // clave que NADIE escribía en todo el repo (el skin es de la ACTIVIDAD,
  // `presentation.skin`, y se aplica al marco, no a la página). Se quitó la
  // lectura muerta, no el baseline: una clave fantasma es una promesa falsa.
  applySkin('default');
  stampVersion();
  initCustomAnims(); // register any animations added from the Admin panel

  // Retorno de Google OAuth: aterriza en teacher.html?code=…&state=… . Se canjea
  // el code ANTES de arrancar el router y se limpia la query (deja el #hash para
  // que el router enrute normal). Si falla, se avisa pero la app sigue.
  const _q = new URLSearchParams(location.search);
  if (_q.get('code') && _q.get('state')) {
    let _returnHash = '';
    try { const _res = await completeOAuthLogin(_q.get('code'), _q.get('state')); _returnHash = _res?.returnHash || ''; }
    catch (e) {
      console.warn('[oauth]', e.message);
      try { const { toast } = await import('./core/toast.js'); toast('Login con Google: ' + e.message, 'danger', 7000); } catch {}
    }
    // Devuelve al profe a donde estaba (Google no preserva el #hash en el retorno).
    history.replaceState(null, '', location.pathname + (_returnHash || location.hash || '#/home'));
  }
  mountAuthSlot('#ww-auth-slot').catch(() => {});

  // Almacén de actividades = el profe logueado con Google (o 'guest' si no hay
  // sesión). getAuthUserId() lee la sesión guardada de forma síncrona → no bloquea.
  // (S1) Antes se usaba el id ANÓNIMO de ensureIdentity como storage user; ya no:
  // guest usa la clave legacy y un profe usa la suya propia.
  function applyStorageUser(id) {
    setStorageUser(id || undefined);
    if (id) {
      // Primer login en este navegador: adopta las actividades anónimas locales.
      claimGuestActivities(id);
      // Sube las reclamadas (firma owner) y trae SOLO las del profe.
      retryUnsynced().catch(() => {});
      sync()
        .then(() => { const h = location.hash; if (!h || h === '#/' || h === '#/home' || h === '#/mine') resolve(); })
        .catch(err => console.warn('[sync]', err.message));
    }
  }
  applyStorageUser(getAuthUserId());

  // Start the router immediately so la home pinta desde localStorage sin esperar red.
  start();
  window.__APP_READY__ = true;

  // Identidad anónima para subsistemas de alumno/resultados (NO es el storage user).
  ensureIdentity().catch(err => console.warn('[boot] identity:', err.message));

  // Refresca el token del profe (Fase 0 seguridad PB). Si expira de verdad,
  // authRefresh limpia la sesión → onAuthChange nos lleva a 'guest' y re-renderiza.
  authRefresh().catch(() => {});

  // Transiciones de sesión sin recarga (logout, o refresh que invalida el token).
  // El LOGIN normal recarga la página (redirección OAuth), así que boot lo cubre;
  // esto cubre sobre todo el logout y la expiración.
  onAuthChange(({ user }) => {
    applyStorageUser(user?.id || null);
    resolve(); // re-ejecuta el router para la ruta actual con el nuevo estado
  });
})();
