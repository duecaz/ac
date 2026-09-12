import { installErrorHandlers } from './core/errorLog.js';
import { route, setNotFound } from './core/router.js';

installErrorHandlers('student');

// Templates: needed because async tasks render the template's player on this page.
import './core/registerTemplates.js';

import { html, mount } from './core/html.js';
import { ensureIdentity } from './core/identity.js';
// Side-effect: boot.js wires sounds + effects to the GameEvents bus and exposes
// the shared page boot (skin baseline, navbar chrome, router start).
import { bootApp } from './core/boot.js';
import { renderJoin, renderPlay } from './views/studentLive.js';
import { renderTask } from './views/studentTask.js';

const APP = '#app';

route('#/', () => renderJoin(APP));
route('#/join', () => renderJoin(APP));
route('#/join/:code', ({ code }) => renderJoin(APP, code));
route('#/play/:code', ({ code }) => renderPlay(APP, code));
route('#/task/:code', ({ code }) => renderTask(APP, code));

setNotFound(() => mount(APP, html`<div class="alert alert-warning m-4">Ruta no encontrada.</div>`));

// El arranque compartido (baseline de skin, sello de versión, menú de la barra,
// soltar handlers delegados entre vistas, start + __APP_READY__) vive en
// core/boot.js: aquí solo lo PROPIO del alumno — su identidad anónima, que es
// quien firma los resultados.
bootApp({
  app: APP,
  mute: true,
  antesDeArrancar: async () => {
    try {
      const user = await ensureIdentity();
      const { setStorageUser } = await import('./core/storage.js');
      setStorageUser(user.id);
    } catch (err) { console.warn('[boot] auth failed:', err instanceof Error ? err.message : String(err)); }
  },
});
