// Stub for Phase 2. Phase 0 only paints a placeholder.
import { route, start, setNotFound } from './core/router.js';
import { html, mount } from './core/html.js';

const APP = '#app';

route('#/', () => mount(APP, html`<div class="text-center py-5"><a href="#/join" class="btn btn-light btn-lg">Unirme con PIN</a></div>`));
route('#/join', () => mount(APP, html`
  <div class="text-center py-5">
    <h2>Modo alumno</h2>
    <p class="text-light-50">Disponible en Fase 2.</p>
    <input class="form-control form-control-lg text-center mx-auto my-3" style="max-width:300px;font-size:2rem;letter-spacing:.5rem" placeholder="PIN" disabled>
    <button class="btn btn-warning btn-lg" disabled>Entrar</button>
  </div>
`));
route('#/join/:code', () => mount(APP, html`<div class="alert alert-info m-4">Modo Live disponible en Fase 2.</div>`));
route('#/play/:code', () => mount(APP, html`<div class="alert alert-info m-4">Modo Live disponible en Fase 2.</div>`));

setNotFound(() => mount(APP, html`<div class="alert alert-warning m-4">Ruta no encontrada.</div>`));

start();
window.__APP_READY__ = true;
