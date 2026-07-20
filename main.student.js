import { installErrorHandlers } from './core/errorLog.js';
import { route, start, setNotFound, setBeforeResolve } from './core/router.js';
import { clearListeners } from './core/events.js';

installErrorHandlers('student');

// Templates: needed because async tasks render the template's player on this page.
import './core/registerTemplates.js';

import { html, mount } from './core/html.js';
import { ensureIdentity } from './core/identity.js';
import { applySkin } from './core/skins.js';
// Side-effect: boot.js wires sounds + effects to the GameEvents bus and exposes
// the navbar helpers (version stamp + mute button).
import { stampVersion, attachMuteButton } from './core/boot.js';
import { renderJoin, renderPlay } from './views/studentLive.js';
import { renderTask } from './views/studentTask.js';

const APP = '#app';

route('#/', () => renderJoin(APP));
route('#/join', () => renderJoin(APP));
route('#/join/:code', ({ code }) => renderJoin(APP, code));
route('#/play/:code', ({ code }) => renderPlay(APP, code));
route('#/task/:code', ({ code }) => renderTask(APP, code));

setNotFound(() => mount(APP, html`<div class="alert alert-warning m-4">Ruta no encontrada.</div>`));

// Suelta los handlers delegados de la vista anterior en la raíz compartida antes
// de renderizar la siguiente (ver core/events.js clearListeners).
setBeforeResolve(() => clearListeners(APP));

(async function boot() {
  applySkin(localStorage.getItem('ww.skin') || 'default');
  try {
    const user = await ensureIdentity();
    const { setStorageUser } = await import('./core/storage.js');
    setStorageUser(user.id);
  } catch (err) { console.warn('[boot] auth failed:', err.message); }
  stampVersion();
  attachMuteButton();
  start();
  window.__APP_READY__ = true;
})();
