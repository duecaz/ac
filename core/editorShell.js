// Shell de editor COMPARTIDO. Antes cada plantilla armaba a mano su barra de
// pestañas, y derivaban (una sin pestañas, otra sin "Modos", nombres distintos…).
// Aquí el chasis se renderiza UNA vez para todas: título/subtítulo + pestañas
//   Contenido · Individual · Puntuación · Modos · En vivo · Presentación
// y cada plantilla aporta SOLO sus paneles propios. Así es imposible que un
// editor "haga lo suyo" u olvide un modo: todos heredan el mismo esqueleto.
//
// spec = {
//   content:  { label, html(a), wire(root, a, ctx) }        // obligatorio
//   rules:    { label?, html(a), wire(root, a, ctx) } | null // "Individual"
//   scoring:  { html(a), wire(root, a, ctx) } | null          // "Puntuación"
//   live:     { html(a), wire(root, a, ctx) } | null          // "En vivo" (si meta.modes.live)
//   presentation: bool (def. true)                            // skin + fondo
// }
// ctx = { onChange, repaint }  — repaint() re-renderiza todo (para alta/baja de ítems).
import { html, escapeHtml, mount } from './html.js';
import { on } from './events.js';
import { getTemplate, listTemplates } from './registry.js';
import { modesForTemplate } from './modes.js';
import { renderModesTab, wireModesTab } from './editorModes.js';
import { listSkins, skinPreviewHtml } from './skins.js';
import { listBackgrounds, backgroundPreviewHtml } from './backgrounds.js';

function presentationHtml(a) {
  const cs = a.presentation?.skin || 'default';
  const cb = a.presentation?.background || 'none';
  return `
    <h6 class="mb-2">Skin (colores y sonidos)</h6>
    <div class="d-flex flex-wrap gap-3 mb-4">
      ${listSkins().map(s => `
        <div class="ww-skin-tile skin-pick ${cs === s.name ? 'is-active' : ''}" data-name="${s.name}" role="button">
          ${skinPreviewHtml(s.name)}
          <div class="text-center small mt-1">${escapeHtml(s.description || '')}</div>
        </div>`).join('')}
    </div>
    <h6 class="mb-2">Fondo</h6>
    <div class="d-flex flex-wrap gap-3">
      ${listBackgrounds().map(b => `
        <div class="ww-skin-tile bg-pick ${cb === b.name ? 'is-active' : ''}" data-name="${b.name}" role="button" style="width:120px">
          ${backgroundPreviewHtml(b.name)}
          <div class="text-center small text-muted">${escapeHtml(b.description || '')}</div>
        </div>`).join('')}`;
}

export function renderEditorShell(root, a, onChange, spec) {
  const T = getTemplate(a.template);
  const liveOn = !!T?.meta?.modes?.live && !!spec.live;
  // "Modos" aparece si la plantilla soporta VS/Equipos/Tarea (En vivo va aparte).
  const hasModes = modesForTemplate(T).some(m => ['vs', 'teams', 'task'].includes(m.id));
  const presOn = spec.presentation !== false;

  // Pestañas en orden fijo. id = el data-bs-target; cada una se incluye solo si
  // su contenido existe (Contenido y Presentación según spec).
  const tabs = [
    { id: 'tab-content', label: spec.content.label || 'Contenido', body: () => spec.content.html(a) },
    spec.rules && { id: 'tab-rules', label: spec.rules.label || 'Individual', icon: 'bi-person-fill', body: () => spec.rules.html(a) },
    spec.scoring && { id: 'tab-scoring', label: 'Puntuación', body: () => spec.scoring.html(a) },
    hasModes && { id: 'tab-modes', label: 'Modos', icon: 'bi-controller', body: () => renderModesTab(a) },
    liveOn && { id: 'tab-live', label: 'En vivo', icon: 'bi-broadcast', body: () => spec.live.html(a) },
    presOn && { id: 'tab-pres', label: 'Presentación', icon: 'bi-palette', body: () => presentationHtml(a) },
  ].filter(Boolean);

  function repaint() { render(); }
  const ctx = { onChange, repaint };

  function render() {
    mount(root, html`
      <div class="ww-editor">
        <div class="row g-2 mb-3">
          <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title || '')}"></div>
          <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
        </div>
        <ul class="nav nav-tabs" role="tablist">
          ${tabs.map((t, i) => `<li class="nav-item"><button class="nav-link ${i === 0 ? 'active' : ''}" data-bs-toggle="tab" data-bs-target="#${t.id}">${escapeHtml(t.label)}${t.icon ? ` <i class="bi ${t.icon}"></i>` : ''}</button></li>`).join('')}
        </ul>
        <div class="tab-content border border-top-0 p-3 rounded-bottom">
          ${tabs.map((t, i) => `<div class="tab-pane fade ${i === 0 ? 'show active' : ''}" id="${t.id}">${t.body()}</div>`).join('')}
        </div>
      </div>`);

    // Common wiring (título/subtítulo, Modos, Presentación).
    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    if (hasModes) wireModesTab(root, a, onChange);
    if (presOn) {
      on(root, 'click', '.skin-pick', (_, b) => {
        (a.presentation = a.presentation || {}).skin = b.dataset.name; onChange(a);
        root.querySelectorAll('.skin-pick').forEach(x => x.classList.toggle('is-active', x === b));
      });
      on(root, 'click', '.bg-pick', (_, b) => {
        (a.presentation = a.presentation || {}).background = b.dataset.name; onChange(a);
        root.querySelectorAll('.bg-pick').forEach(x => x.classList.toggle('is-active', x === b));
      });
    }
    // Template-specific wiring.
    spec.content.wire?.(root, a, ctx);
    spec.rules?.wire?.(root, a, ctx);
    spec.scoring?.wire?.(root, a, ctx);
    if (liveOn) spec.live.wire?.(root, a, ctx);
  }

  render();
}

// Test helper: confirma que una plantilla expone, vía su editor-spec, un panel
// "Modos" cuando su capacidad lo incluye. No usado en runtime (solo introspección).
export function shellWouldShowModes(templateName) {
  const T = getTemplate(templateName) || listTemplates().find(t => t.meta.name === templateName);
  return T ? modesForTemplate(T).some(m => ['vs', 'teams', 'task'].includes(m.id)) : false;
}
