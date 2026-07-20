import { installErrorHandlers } from './core/errorLog.js';
import { route, start, navigate, setNotFound, setBeforeResolve } from './core/router.js';
import { clearListeners } from './core/events.js';

installErrorHandlers('teacher');

// Templates: each module self-registers via registerTemplate(...).
import './core/registerTemplates.js';

import { renderHome } from './views/home.js';
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
import { renderAdmin } from './views/adminView.js';
import { sync, setStorageUser } from './core/storage.js';
import { ensureIdentity } from './core/identity.js';
import { authRefresh } from './core/auth.js';
import { applySkin } from './core/skins.js';
// Side-effect: boot.js wires sounds + visual effects to the GameEvents bus and
// exposes the navbar helpers (version stamp + mute button).
import { stampVersion } from './core/boot.js';
import { initCustomAnims } from './core/vsAnimations.js';
import { html, mount } from './core/html.js';

const APP = '#app';

route('#/', () => navigate('#/home'));
route('#/home', () => renderHome(APP));
route('#/new', () => renderTemplateSelector(APP));
route('#/edit-new/:template', ({ template }) => renderEditView(APP, { template }));
route('#/edit/:id', ({ id }) => renderEditView(APP, { id }));
route('#/play/:id', ({ id }) => renderPlayerView(APP, id));
route('#/vs/:id', ({ id }) => renderPlayerView(APP, id, 'vs'));
route('#/teams/:id', ({ id }) => renderPlayerView(APP, id, 'teams'));
route('#/memory/:id', ({ id }) => renderPlayerView(APP, id, 'teams'));
route('#/launch/:id', ({ id }) => renderHostLaunch(APP, id));
route('#/host/:code', ({ code }) => renderHostByCode(APP, code));
route('#/reports', () => renderReports(APP));
route('#/reports/session/:id', ({ id }) => renderSessionReport(APP, id));
route('#/reports/:id', ({ id }) => renderActivityReport(APP, id));
route('#/tasks/:id', ({ id }) => renderAssignmentsForActivity(APP, id));
route('#/task/:id/attempts', ({ id }) => renderAttempts(APP, id));
route('#/list/:id', ({ id }) => renderListView(APP, id));
route('#/edit-list/:id', ({ id }) => renderEditList(APP, { id }));
route('#/new-list', () => renderEditList(APP, {}));
route('#/explore', () => renderExplore(APP));
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
  applySkin(localStorage.getItem('ww.skin') || 'default');
  stampVersion();
  initCustomAnims(); // register any animations added from the Admin panel
  // Start the router immediately so the home page paints from localStorage
  // without waiting for the network. Auth + sync happen in the background.
  start();
  window.__APP_READY__ = true;
  // Refresca el token del profe en el arranque (Fase 0 seguridad PB): mantiene la
  // sesión viva para firmar las escrituras; si expiró de verdad, limpia y fuerza
  // re-login en vez de arrastrar un token muerto. No bloquea el render.
  authRefresh().catch(() => {});
  try {
    const user = await ensureIdentity();
    setStorageUser(user.id);
    // Re-render home once remote data arrives so new/updated activities appear.
    sync()
      .then(() => {
        const h = location.hash;
        if (!h || h === '#/' || h === '#/home') renderHome(APP);
      })
      .catch(err => console.warn('[sync]', err.message));
  } catch (err) {
    console.warn('[boot] auth failed:', err.message);
  }
})();
