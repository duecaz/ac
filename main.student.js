import { VERSION } from './core/constants.js';
import { installErrorHandlers } from './core/errorLog.js';
import { route, start, setNotFound } from './core/router.js';

installErrorHandlers('student');

// Templates: needed because async tasks render the template's player on this page.
import './templates/quiz/index.js';
import './templates/wheel/index.js';
import './templates/match/index.js';
import './templates/memory/index.js';
import './templates/tildes/index.js';
import './templates/comas/index.js';

import { html, mount } from './core/html.js';
import { ensureAuth } from './core/supabase.js';
import { applySkin } from './core/skins.js';
// Side-effect imports: subscribe sound + effects to game events bus.
import './core/sounds.js';
import './core/effects.js';
import { isMuted, setMuted } from './core/sounds.js';
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
  try {
    const user = await ensureAuth();
    const { setStorageUser } = await import('./core/storage.js');
    setStorageUser(user.id);
  } catch (err) { console.warn('[boot] auth failed:', err.message); }
  const v = document.getElementById('ww-version'); if (v) v.textContent = 'v' + VERSION;
  const muteSlot = document.getElementById('ww-mute-slot');
  if (muteSlot) {
    const paint = () => muteSlot.innerHTML = `<button class="btn btn-sm btn-outline-light" id="ww-mute-btn"><i class="bi ${isMuted()?'bi-volume-mute-fill':'bi-volume-up-fill'}"></i></button>`;
    paint();
    muteSlot.addEventListener('click', (e) => { if (e.target.closest('#ww-mute-btn')) { setMuted(!isMuted()); paint(); } });
  }
  start();
  window.__APP_READY__ = true;
})();
