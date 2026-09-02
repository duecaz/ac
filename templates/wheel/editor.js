// Editor de Ruleta — preguntas con imagen opcional (igual que Pregunta Live).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, wireItemList } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
// El tile de imagen (subir · buscar · quitar) es de core/imageTile.js — este
// editor y question-live/editor.js lo tenían copiado byte por byte (barrido B5, 2026-09-02).
import { imageTileHtml, wireImageTile } from '../../core/imageTile.js';
import { SPIN_DUR_MAX, SPIN_DUR_DEFAULT } from '../../core/ruleta/spin.js';
import { newItem, migrateLegacyItems } from '../../core/contentModels/items.js';


export function renderWheelEditor(root, activity, onChange) {
  const a = activity;
  // Migrate old flat-entries format to items.
  if (Array.isArray(a.content?.entries) && !Array.isArray(a.content?.items)) {
    a.content = migrateLegacyItems(a.content);
    onChange(a);
  }
  if (!Array.isArray(a.content?.items)) a.content = { items: [newItem(), newItem(), newItem(), newItem()] };
  if (!a.rules) a.rules = {};
  renderEditorShell(root, a, onChange, {
    content: { label: 'Opciones', html: contentHtml, wire: wireContent },
    rules: { label: 'Ajustes', html: rulesHtml, wire: wireRules },
  });
}

function contentHtml(a) {
  const n = a.content.items.length;
  return `
    <p class="text-muted small mb-3">${n} opción${n !== 1 ? 'es' : ''} · la ruleta acepta hasta 32. Añade una imagen opcional a cada entrada (máx. 200&nbsp;KB).</p>
    ${a.content.items.map((item, i) => `
      <div class="row g-2 mb-3 align-items-start border-bottom pb-3">
        <div class="col-12 col-md-9">
          <div class="input-group">
            <span class="input-group-text fw-bold">${i + 1}</span>
            <input class="form-control we-entry" data-i="${i}" placeholder="Opción ${i + 1}" value="${escapeHtml(item.question ?? item.q ?? '')}">
            <span class="input-group-text p-0 border-0 ps-2 d-flex">${itemControlsHtml(i, a.content.items.length)}</span>
          </div>
        </div>
        <div class="col-12 col-md-3 text-center" id="we-img-${i}">${imageTileHtml(item.image, { prefix: 'we-', height: 80 })}</div>
      </div>`).join('')}
    ${n < 32 ? `<button class="btn btn-outline-primary mt-2" id="we-add"><i class="bi bi-plus-lg"></i> Añadir opción</button>` : `<p class="text-muted small mt-2">Máximo 32 opciones alcanzado.</p>`}`;
}

function wireContent(root, a, ctx) {
  on(root, 'input', '.we-entry', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  wireItemList(root, a, ctx, { list: a.content.items, añadir: { selector: '#we-add', fabrica: newItem } });
  wireImageTile(root, a, a.content.items, ctx, { prefix: 'we-', queryField: 'question' });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4">
      <label class="form-label">Duración del giro (ms) <span class="text-muted small">solo modo individual</span></label>
      <input id="we-dur" type="number" min="500" max="${SPIN_DUR_MAX}" step="500" class="form-control" value="${a.rules.spinDurationMs ?? SPIN_DUR_DEFAULT}">
      <div class="form-text">Máximo 30 000 ms (30 s).</div>
    </div>
    <div class="col-md-4 form-check pt-4 mt-2">
      <input class="form-check-input" type="checkbox" id="we-rm" ${a.rules.removeAfterSpin ? 'checked' : ''}>
      <label class="form-check-label" for="we-rm">Quitar tras girar <span class="text-muted small">(individual)</span></label>
    </div>
  </div>`;
}

function wireRules(root, a, ctx) {
  on(root, 'input', '#we-dur', e => { a.rules.spinDurationMs = Math.min(SPIN_DUR_MAX, +e.target.value || SPIN_DUR_DEFAULT); ctx.onChange(a); });
  on(root, 'change', '#we-rm', e => { a.rules.removeAfterSpin = e.target.checked; ctx.onChange(a); });
}
