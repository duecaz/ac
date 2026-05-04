import { html, mount } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save } from '../core/storage.js';
import { newActivity } from '../core/migrate.js';
import { getEditor } from '../core/registry.js';
import { navigate } from '../core/router.js';

export function renderEditView(rootSel, { id, template }) {
  let activity = id ? get(id) : null;
  if (!activity && template) activity = newActivity(template);
  if (!activity) { mount(rootSel, html`<div class="alert alert-danger">No se pudo cargar.</div>`); return; }

  let dirty = false;
  const Editor = getEditor(activity.template);
  if (!Editor) { mount(rootSel, html`<div class="alert alert-danger">Editor no disponible para "${activity.template}".</div>`); return; }

  mount(rootSel, html`
    <div class="d-flex justify-content-between align-items-center mb-3">
      <a href="#/home" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
      <div>
        <button class="btn btn-outline-success" id="btn-test"><i class="bi bi-play-fill"></i> Probar</button>
        <button class="btn btn-primary" id="btn-save"><i class="bi bi-cloud-arrow-up"></i> Guardar</button>
      </div>
    </div>
    <div id="editor-root"></div>
  `);

  Editor.render(document.getElementById('editor-root'), activity, (a) => { activity = a; dirty = true; });

  on(rootSel, 'click', '#btn-save', () => {
    save(activity);
    dirty = false;
    flash('Guardado.');
  });
  on(rootSel, 'click', '#btn-test', () => {
    save(activity);
    navigate(`#/play/${activity.id}`);
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

function flash(msg) {
  const t = document.createElement('div');
  t.className = 'toast align-items-center text-bg-success border-0 show position-fixed top-0 end-0 m-3';
  t.style.zIndex = 9999;
  t.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div></div>`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1500);
}
