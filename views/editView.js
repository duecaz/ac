import { html, mount, escapeHtml } from '../core/html.js';
import { on } from '../core/events.js';
import { get, save } from '../core/storage.js';
import { newActivity } from '../core/migrate.js';
import { getEditor, getTemplate } from '../core/registry.js';
import { revisarActividad } from '../core/activityCheck.js';
import { navigate } from '../core/router.js';
import { toast, confirmModal } from '../core/toast.js';
import { acquire } from '../core/lifecycle.js';
import { buildSwitchOptions, applyAndSave } from './switchTemplate.js';
import { downloadActivitiesJson } from '../core/io.js';
import { checkActivitySize } from '../core/quotas.js';

const AUTOSAVE_DELAY_MS = 2000;
let _sizeWarned = false; // aviso de tamaño una vez por sesión

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
        <span id="vis-badge" class="badge ${activity.visibility==='public'?'bg-success':'bg-secondary'}" title="Estado de publicación">
          ${activity.visibility==='public' ? '<i class="bi bi-globe"></i> Pública' : '<i class="bi bi-eye-slash"></i> Borrador'}
        </span>
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
      <summary class="d-inline-flex align-items-center gap-2 small text-muted flex-wrap" style="cursor:pointer; list-style:none">
        <span class="badge bg-${curT?.meta?.color || 'secondary'}"><i class="bi ${curT?.meta?.icon || 'bi-puzzle'}"></i> ${escapeHtml(curT?.meta?.label || activity.template)}</span>
        <i class="bi bi-arrow-left-right"></i> Cambiar formato
        ${switchOpts.filter(o => o.valid).length ? `<span class="text-muted">·</span>
        <span class="fw-semibold">${switchOpts.filter(o => o.valid).slice(0, 3).map(o => escapeHtml(o.template.meta.label)).join(' · ')}${switchOpts.filter(o => o.valid).length > 3 ? ` +${switchOpts.filter(o => o.valid).length - 3}` : ''}</span>` : ''}
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
        <button class="btn btn-outline-secondary btn-sm" id="btn-export" title="Exportar JSON"><i class="bi bi-file-earmark-arrow-down"></i> JSON</button>
        <button class="btn btn-outline-success btn-sm" id="btn-test"><i class="bi bi-play-fill"></i> Probar</button>
        <button class="btn btn-outline-secondary btn-sm" id="btn-save-draft" title="Guardar sin publicar (solo tú la ves)"><i class="bi bi-eye-slash"></i> Guardar borrador</button>
        <button class="btn btn-primary btn-sm" id="btn-publish" title="Publicar en la biblioteca (visible para todos)"><i class="bi bi-globe"></i> ${activity.visibility==='public'?'Actualizar publicación':'Publicar'}</button>
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

  // Refleja el estado público/borrador en el badge y en el botón de publicar.
  function paintVis() {
    const badge = document.getElementById('vis-badge');
    if (badge) {
      const pub = activity.visibility === 'public';
      badge.className = `badge ${pub ? 'bg-success' : 'bg-secondary'}`;
      badge.innerHTML = pub ? '<i class="bi bi-globe"></i> Pública' : '<i class="bi bi-eye-slash"></i> Borrador';
    }
    const pubBtn = document.getElementById('btn-publish');
    if (pubBtn) pubBtn.innerHTML = `<i class="bi bi-globe"></i> ${activity.visibility === 'public' ? 'Actualizar publicación' : 'Publicar'}`;
  }

  // setVis: 'public' | 'unlisted' | null. Los botones fijan la visibilidad de forma
  // EXPLÍCITA (Guardar borrador vs Publicar); el autosave (silent) la respeta (null).
  async function doSave(silent = false, setVis = null) {
    if (saving) return;
    if (setVis) { activity.visibility = setVis; paintVis(); }
    saving = true;
    setState('Guardando…', 'info', 'bi-cloud-arrow-up');
    // §25 CAPACIDAD (antes P1-6): una actividad con muchas imágenes inline deja
    // de poder guardarse. El AVISO salta antes del tope; pasado el tope el
    // servidor la RECHAZA, así que se dice aquí en vez de dejar que falle la
    // sincronización en silencio. Una sola redacción, la de core/quotas.js.
    const size = checkActivitySize(activity);
    if (size.level === 'over') {
      _sizeWarned = true;
      setState('Demasiado pesada para el servidor', 'danger', 'bi-exclamation-triangle-fill');
      if (!silent) toast(size.msg, 'danger', 10000);
    } else if (size.level === 'warn' && !_sizeWarned) {
      _sizeWarned = true;
      toast(size.msg, 'warning', 8000);
    }
    const { remote, persisted } = save(activity);
    // P1-2: si NI SIQUIERA se guardó en local (cuota llena), NO fingir éxito —
    // estado de error PERSISTENTE (no un toast que se va) y `dirty` sigue true
    // para que el autosave reintente al liberar espacio.
    if (persisted === false) {
      setState('No se pudo guardar: almacenamiento lleno', 'danger', 'bi-exclamation-triangle-fill');
      if (!silent) toast('Almacenamiento del navegador lleno. Exporta a JSON y libera espacio; tu cambio NO se guardó.', 'danger', 8000);
      saving = false;
      return;
    }
    try {
      await remote;
      dirty = false;
      setState('Guardado', 'success', 'bi-check-circle-fill');
      if (!silent) toast(activity.visibility === 'public' ? 'Publicada en la biblioteca ✓ Ya aparece en Explorar.' : 'Guardado como borrador (solo tú la ves).', 'success');
    } catch (e) {
      setState('Error al sincronizar (queda local)', 'danger', 'bi-exclamation-triangle-fill');
      if (!silent) toast('No se pudo sincronizar: ' + e.message, 'danger', 6000);
    } finally {
      saving = false;
    }
  }

  // Edit-meta handlers.
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

  on(rootSel, 'click', '#btn-export', () => downloadActivitiesJson([activity.id]));
  on(rootSel, 'click', '#btn-save-draft', () => doSave(false, 'unlisted'));
  on(rootSel, 'click', '#btn-publish', () => doSave(false, 'public'));
  on(rootSel, 'click', '#btn-test', async () => {
    // No se prueba lo que no se puede jugar: se DICE qué falta y se deja al
    // profe donde puede arreglarlo, en vez de mandarlo a una pantalla de error.
    // El panel rojo de la pestaña Contenido lleva la lista completa.
    const rev = revisarActividad(activity);
    if (!rev.listo) {
      toast(`Todavía no se puede probar: ${rev.problemas[0]}`
        + (rev.problemas.length > 1 ? ` (y ${rev.problemas.length - 1} más — mira el aviso rojo en Contenido)` : ''),
        'danger', 6000);
      document.querySelector('#ww-falta')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (dirty) await doSave(true);
    navigate(`#/play/${activity.id}`);
  });

  // Don't lose changes on accidental nav. Browsers ignore custom messages
  // but the prompt itself still appears.
  // beforeunload solo cubre el cierre REAL de pestaña, no la navegación por hash
  // (Volver / otro enlace #/…). Si el usuario navega dentro de la ventana de 2 s
  // del autosave, el disposer corría clearTimeout SIN guardar → cambio perdido.
  // Aquí hacemos flush SÍNCRONO a local si quedaba algo sucio (save() escribe
  // local de inmediato; el PATCH remoto es best-effort).
  ctx.add(() => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    if (dirty) { try { save(activity); } catch { /* best-effort */ } }
  });
  const beforeUnload = (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  };
  window.addEventListener('beforeunload', beforeUnload);
  ctx.add(() => window.removeEventListener('beforeunload', beforeUnload));
}
