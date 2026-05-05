import { VERSION } from './core/constants.js';
import { route, start, navigate, setNotFound } from './core/router.js';
import { registerTemplate, registerEditor } from './core/registry.js';
import { QuizTemplate } from './templates/quiz.js';
import { QuizEditor } from './editors/quizEditor.js';
import { renderHome } from './views/home.js';
import { renderTemplateSelector } from './views/templateSelector.js';
import { renderPlayerView } from './views/playerView.js';
import { renderEditView } from './views/editView.js';
import { renderHostLaunch, renderHostByCode } from './views/hostLive.js';
import { sync } from './core/storage.js';
import { ensureAuth } from './core/supabase.js';
import { html, mount } from './core/html.js';

registerTemplate('quiz', QuizTemplate);
registerEditor('quiz', QuizEditor);

const APP = '#app';

route('#/', () => navigate('#/home'));
route('#/home', () => renderHome(APP));
route('#/new', () => renderTemplateSelector(APP));
route('#/edit-new/:template', ({ template }) => renderEditView(APP, { template }));
route('#/edit/:id', ({ id }) => renderEditView(APP, { id }));
route('#/play/:id', ({ id }) => renderPlayerView(APP, id));
route('#/launch/:id', ({ id }) => renderHostLaunch(APP, id));
route('#/host/:code', ({ code }) => renderHostByCode(APP, code));

setNotFound(() => mount(APP, html`<div class="alert alert-warning">Ruta no encontrada. <a href="#/home">Inicio</a></div>`));

(async function boot() {
  try {
    await ensureAuth();
    sync().catch(err => console.warn('[sync]', err.message));
  } catch (err) {
    console.warn('[boot] auth failed:', err.message);
    // Keep the app usable in offline/local mode.
  }
  const v = document.getElementById('ww-version'); if (v) v.textContent = 'v' + VERSION;
  start();
  window.__APP_READY__ = true;
})();
