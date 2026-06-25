import { VERSION } from './core/constants.js';
import { installErrorHandlers } from './core/errorLog.js';
import { route, start, navigate, setNotFound } from './core/router.js';

installErrorHandlers('teacher');

// Templates: each module self-registers via registerTemplate(...).
import './templates/quiz/index.js';
import './templates/wheel/index.js';
import './templates/match/index.js';
import './templates/memory/index.js';
import './templates/tildes/index.js';
import './templates/comas/index.js';
import './templates/math/index.js';
import './templates/wordsearch/index.js';
import './templates/froggy/index.js';
import './templates/crossword/index.js';
import './templates/question-live/index.js';

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
import { ensureAuth } from './core/supabase.js';
import { applySkin } from './core/skins.js';
// Side-effect imports: subscribe to GameEvents bus for sounds + visual effects.
import './core/sounds.js';
import './core/effects.js';
import { isMuted, setMuted } from './core/sounds.js';
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

(async function boot() {
  applySkin(localStorage.getItem('ww.skin') || 'default');
  const v = document.getElementById('ww-version'); if (v) v.textContent = 'v' + VERSION;
  // Mute toggle in navbar.
  const muteSlot = document.getElementById('ww-mute-slot');
  if (muteSlot) {
    const paint = () => muteSlot.innerHTML = `<button class="btn btn-sm btn-outline-light" id="ww-mute-btn" title="${isMuted()?'Activar sonido':'Silenciar'}"><i class="bi ${isMuted()?'bi-volume-mute-fill':'bi-volume-up-fill'}"></i></button>`;
    paint();
    muteSlot.addEventListener('click', (e) => { if (e.target.closest('#ww-mute-btn')) { setMuted(!isMuted()); paint(); } });
  }
  initCustomAnims(); // register any animations added from the Admin panel
  // Start the router immediately so the home page paints from localStorage
  // without waiting for the network. Auth + sync happen in the background.
  start();
  window.__APP_READY__ = true;
  try {
    const user = await ensureAuth();
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
