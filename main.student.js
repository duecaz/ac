import { VERSION } from './core/constants.js';
import { installErrorHandlers } from './core/errorLog.js';
import { route, start, setNotFound } from './core/router.js';

installErrorHandlers('student');

// Templates: needed because async tasks render the template's player on this page.
import './templates/quiz/index.js';
import './templates/wheel/index.js';
import './templates/match/index.js';
import './templates/memory/index.js';

import { html, mount } from './core/html.js';
import { ensureAuth } from './core/supabase.js';
import { applySkin } from './core/skins.js';
import { renderJoin, renderPlay } from './views/studentLive.js';
import { renderTask } from './views/studentTask.js';

const APP = '#app';

route('#/', () => renderJoin(APP));
route('#/join', () => renderJoin(APP));
route('#/join/:code', ({ code }) => renderJoin(APP, code));
route('#/play/:code', ({ code }) => renderPlay(APP, code));
route('#/task/:code', ({ code }) => renderTask(APP, code));

setNotFound(() => mount(APP, html`<div class="alert alert-warning m-4">Ruta no encontrada.</div>`));

(async function boot() {
  applySkin(localStorage.getItem('ww.skin') || 'default');
  try { await ensureAuth(); }
  catch (err) { console.warn('[boot] auth failed:', err.message); }
  const v = document.getElementById('ww-version'); if (v) v.textContent = 'v' + VERSION;
  start();
  window.__APP_READY__ = true;
})();
