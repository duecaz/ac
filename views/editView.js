import { html, mount, escapeHtml } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save } from '../core/storage.js';
import { newActivity } from '../core/migrate.js';
import { getEditor, getTemplate } from '../core/registry.js';
import { navigate } from '../core/router.js';
import { toast, confirmModal } from '../core/toast.js';
import { acquire } from '../core/lifecycle.js';
import { buildSwitchOptions, applyAndSave } from './switchTemplate.js';

const AUTOSAVE_DELAY_MS = 2000;

export function renderEditView(rootSel, { id, template }) {
  const ctx = acquire('editView');
  let activity = id ? get(id) : null;
  if (!activity && template) activity = newActivity(template);
  if (!activity) { mount(rootSel, html`<div class="alert alert-danger">No se pudo cargar.</div>`); return; }

  let dirty = false;
  let saving = false;
  let autosaveTimer = null;

  const Editor = getEditor(activity.template);
  if (!Editor) { mount(rootSel, html`<div class="alert alert-danger">Editor no disponible para "${activity.template}".</div>`); return; }

  const curT = getTemplate(activity.template);
  const switchOpts = buildSwitchOptions(activity);

  mount(rootSel, html`
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <a href="#/home" class="btn btn-link"><i class="bi bi-arrow-left"></i> Volver</a>
      <div class="d-flex gap-2 align-items-center flex-wrap">
        <select id="meta-vis" class="form-select form-select-sm" style="width:140px" title="Visibilidad">
          <option value="private" ${activity.visibility==='private'?'selected':''}>Privada</option>
          <option value="unlisted" ${activity.visibility==='unlisted'?'selected':''}>No listada</option>
          <option value="public" ${activity.visibility==='public'?'selected':''}>Pública</option>
        </select>
        <input id="meta-tags" class="form-control form-control-sm" style="width:200px" placeholder="tags (coma)" value="${escapeHtml((activity.tags||[]).join(', '))}">
        <select id="meta-lang" class="form-select form-select-sm" style="width:100px">
          <option value="es" ${activity.language==='es'?'selected':''}>es</option>
          <option value="en" ${activity.language==='en'?'selected':''}>en</option>
          <option value="fr" ${activity.language==='fr'?'selected':''}>fr</option>
          <option value="pt" ${activity.language==='pt'?'selected':''}>pt</option>
        </select>
      </div>
    </div>

    <details class="ww-switch mb-3" id="switch-format">
      <summary class="d-inline-flex align-items-center gap-2 small text-muted" style="cursor:pointer; list-style:none">
        <span class="badge bg-${curT?.meta?.color || 'secondary'}"><i class="bi ${curT?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(curT?.meta?.label || activity.template)}</span>
        <i class="bi bi-arrow-left-right"></i> Cambiar formato
      </summary>
      ${switchOpts.length ? html`
        <div class="mt-2">
          <div class="text-muted small mb-1">Reutiliza este contenido en otro formato — como Wordwall.</div>
          <div class="d-flex flex-wrap gap-2">
            ${switchOpts.filter(o => o.valid).map(o => html`
              <button type="button" class="btn btn-sm btn-outline-${o.template.meta.color || 'secondary'} tpl-switch-opt"
                      data-name="${o.template.meta.name}" data-kind="${o.kind}"
                      title="${o.kind === 'direct' ? 'Mismo contenido' : 'Convierte el contenido a este formato'}">
                <i class="bi ${o.template.meta.icon}"></i> ${escapeHtml(o.template.meta.label)}
                ${o.kind === 'convert' ? '<i class="bi bi-shuffle ms-1 opacity-50"></i>' : ''}
              </button>
            `).join('')}
          </div>
        </div>` : html`<div class="text-muted small mt-2">No hay otros formatos compatibles con este contenido.</div>`}
    </details>

    <div id="editor-root" style="padding-bottom:90px"></div>

    <div id="ww-savebar" class="position-fixed bottom-0 start-0 end-0 bg-light border-top p-2 d-flex justify-content-between align-items-center" style="z-index:1030">
      <div>
        <span id="save-state" class="badge bg-secondary"><i class="bi bi-check2"></i> Guardado</span>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-outline-success btn-sm" id="btn-test"><i class="bi bi-play-fill"></i> Probar</button>
        <button class="btn btn-primary btn-sm" id="btn-save"><i class="bi bi-cloud-arrow-up"></i> Guardar</button>
      </div>
    </div>
  `);

  Editor.render(document.getElementById('editor-root'), activity, (a) => {
    activity = a;
    markDirty();
  });

  function setState(label, kind = 'secondary', icon = 'bi-check2') {
    const el = document.getElementById('save-state');
    if (!el) return;
    el.className = `badge bg-${kind}`;
    el.innerHTML = `<i class="bi ${icon}"></i> ${label}`;
  }

  function markDirty() {
    dirty = true;
    setState('Cambios sin guardar', 'warning', 'bi-pencil');
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = ctx.setTimeout(() => doSave(true), AUTOSAVE_DELAY_MS);
  }

  async function doSave(silent = false) {
    if (saving) return;
    saving = true;
    setState('Guardando…', 'info', 'bi-cloud-arrow-up');
    const { remote } = save(activity);
    try {
      await remote;
      dirty = false;
      setState('Guardado', 'success', 'bi-check-circle-fill');
      if (!silent) toast('Guardado correctamente.', 'success');
    } catch (e) {
      setState('Error al sincronizar (queda local)', 'danger', 'bi-exclamation-triangle-fill');
      if (!silent) toast('No se pudo sincronizar: ' + e.message, 'danger', 6000);
    } finally {
      saving = false;
    }
  }

  // Edit-meta handlers.
  on(rootSel, 'change', '#meta-vis', e => { activity.visibility = e.target.value; markDirty(); });
  on(rootSel, 'input', '#meta-tags', e => { activity.tags = e.target.value.split(',').map(s=>s.trim()).filter(Boolean); markDirty(); });
  on(rootSel, 'change', '#meta-lang', e => { activity.language = e.target.value; markDirty(); });

  // Switch format (Wordwall-style). 'direct' keeps content as-is; 'convert'
  // transforms it to the target model, so confirm first (it may drop fields).
  on(rootSel, 'click', '.tpl-switch-opt', async (_, btn) => {
    const name = btn.dataset.name;
    const kind = btn.dataset.kind;
    const label = btn.textContent.trim();
    if (kind === 'convert') {
      const ok = await confirmModal(
        `Convertir "${activity.title || 'esta actividad'}" al formato “${label}”. El contenido se adaptará y algunos datos podrían no trasladarse. ¿Continuar?`,
        { title: 'Cambiar formato', okText: 'Convertir', cancelText: 'Cancelar' });
      if (!ok) return;
    }
    if (autosaveTimer) clearTimeout(autosaveTimer);
    const next = applyAndSave(activity, name);
    if (!next) { toast('No se pudo cambiar a ese formato.', 'danger'); return; }
    dirty = false;
    toast(`Formato cambiado a “${label}”.`, 'success');
    navigate(`#/edit/${next.id}`); // same hash → re-renders the editor cleanly
  });

  on(rootSel, 'click', '#btn-save', () => doSave(false));
  on(rootSel, 'click', '#btn-test', async () => {
    if (dirty) await doSave(true);
    navigate(`#/play/${activity.id}`);
  });

  // Don't lose changes on accidental nav. Browsers ignore custom messages
  // but the prompt itself still appears.
  ctx.add(() => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
  });
  const beforeUnload = (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  };
  window.addEventListener('beforeunload', beforeUnload);
  ctx.add(() => window.removeEventListener('beforeunload', beforeUnload));
}
