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

import { renderHome } from './views/home.js';
import { renderTemplateSelector } from './views/templateSelector.js';
import { renderPlayerView } from './views/playerView.js';
import { renderEditView } from './views/editView.js';
import { renderHostLaunch, renderHostByCode } from './views/hostLive.js';
import { renderReports, renderActivityReport, renderSessionReport } from './views/reports.js';
import { renderAssignmentsForActivity, renderAttempts } from './views/assignments.js';
import { renderExplore } from './views/explore.js';
import { renderAuthBadge } from './views/authView.js';
import { onAuthChange } from './core/auth.js';
import { sync, setStorageUser } from './core/storage.js';
import { ensureAuth } from './core/supabase.js';
import { applySkin } from './core/skins.js';
// Side-effect imports: subscribe to GameEvents bus for sounds + visual effects.
import './core/sounds.js';
import './core/effects.js';
import { isMuted, setMuted } from './core/sounds.js';
import { html, mount } from './core/html.js';

const APP = '#app';

route('#/', () => navigate('#/home'));
route('#/home', () => renderHome(APP));
route('#/new', () => renderTemplateSelector(APP));
route('#/edit-new/:template', ({ template }) => renderEditView(APP, { template }));
route('#/edit/:id', ({ id }) => renderEditView(APP, { id }));
route('#/play/:id', ({ id }) => renderPlayerView(APP, id));
route('#/launch/:id', ({ id }) => renderHostLaunch(APP, id));
route('#/host/:code', ({ code }) => renderHostByCode(APP, code));
route('#/reports', () => renderReports(APP));
route('#/reports/session/:id', ({ id }) => renderSessionReport(APP, id));
route('#/reports/:id', ({ id }) => renderActivityReport(APP, id));
route('#/tasks/:id', ({ id }) => renderAssignmentsForActivity(APP, id));
route('#/task/:id/attempts', ({ id }) => renderAttempts(APP, id));
route('#/explore', () => renderExplore(APP));

setNotFound(() => mount(APP, html`<div class="alert alert-warning">Ruta no encontrada. <a href="#/home">Inicio</a></div>`));

(async function boot() {
  applySkin(localStorage.getItem('ww.skin') || 'default');
  try {
    const user = await ensureAuth();
    setStorageUser(user.id);
    sync().catch(err => console.warn('[sync]', err.message));
  } catch (err) {
    console.warn('[boot] auth failed:', err.message);
  }
  const v = document.getElementById('ww-version'); if (v) v.textContent = 'v' + VERSION;
  // Mute toggle in navbar.
  const muteSlot = document.getElementById('ww-mute-slot');
  if (muteSlot) {
    const paint = () => muteSlot.innerHTML = `<button class="btn btn-sm btn-outline-light" id="ww-mute-btn" title="${isMuted()?'Activar sonido':'Silenciar'}"><i class="bi ${isMuted()?'bi-volume-mute-fill':'bi-volume-up-fill'}"></i></button>`;
    paint();
    muteSlot.addEventListener('click', (e) => { if (e.target.closest('#ww-mute-btn')) { setMuted(!isMuted()); paint(); } });
  }
  await renderAuthBadge('#ww-auth-slot');
  onAuthChange(() => renderAuthBadge('#ww-auth-slot'));
  start();
  window.__APP_READY__ = true;
})();
