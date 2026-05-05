import { route, start, setNotFound } from './core/router.js';
import { html, mount } from './core/html.js';
import { ensureAuth } from './core/supabase.js';
import { renderJoin, renderPlay } from './views/studentLive.js';

const APP = '#app';

route('#/', () => renderJoin(APP));
route('#/join', () => renderJoin(APP));
route('#/join/:code', ({ code }) => renderJoin(APP, code));
route('#/play/:code', ({ code }) => renderPlay(APP, code));

setNotFound(() => mount(APP, html`<div class="alert alert-warning m-4">Ruta no encontrada.</div>`));

(async function boot() {
  try { await ensureAuth(); }
  catch (err) { console.warn('[boot] auth failed:', err.message); }
  start();
  window.__APP_READY__ = true;
})();
