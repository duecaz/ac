// Editor de Ruleta — solo aporta sus paneles; el chasis lo pone el shell.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderWheelEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.entries)) a.content = { entries: ['', '', '', ''] };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Entradas', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
  });
}

function contentHtml(a) {
  const n = a.content.entries.length;
  return `
    <p class="text-muted small mb-2">${n} opción${n !== 1 ? 'es' : ''} · la ruleta acepta hasta 32</p>
    <div class="d-flex flex-column gap-2">
      ${a.content.entries.map((e, i) => `
        <div class="d-flex gap-2 align-items-center">
          <span class="text-muted small" style="min-width:1.4rem">${i + 1}.</span>
          <input class="form-control we-entry" data-i="${i}" placeholder="Opción ${i + 1}" value="${escapeHtml(e)}">
          ${itemControlsHtml(i, a.content.entries.length)}
        </div>`).join('')}
    </div>
    ${n < 32 ? `<button class="btn btn-outline-primary mt-3" id="we-add"><i class="bi bi-plus-lg"></i> Añadir opción</button>` : `<p class="text-muted small mt-2">Máximo 32 opciones alcanzado.</p>`}`;
}
function wireContent(root, a, ctx) {
  on(root, 'input', '.we-entry', (e, el) => { a.content.entries[+el.dataset.i] = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.item-del', (_, b) => { a.content.entries.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, b) => { reorderArray(a.content.entries, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.entries, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#we-add', () => { a.content.entries.push(''); ctx.onChange(a); ctx.repaint(); });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Duración del giro (ms)</label><input id="we-dur" type="number" min="500" max="30000" step="500" class="form-control" value="${a.rules.spinDurationMs ?? 4000}"><div class="form-text">Máximo 30000 ms (30 s).</div></div>
    <div class="col-md-4 form-check pt-4"><input class="form-check-input" type="checkbox" id="we-rm" ${a.rules.removeAfterSpin ? 'checked' : ''}><label class="form-check-label" for="we-rm">Quitar tras girar</label></div>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'input', '#we-dur', e => { a.rules.spinDurationMs = Math.min(30000, +e.target.value || 4000); ctx.onChange(a); });
  on(root, 'change', '#we-rm', e => { a.rules.removeAfterSpin = e.target.checked; ctx.onChange(a); });
}
