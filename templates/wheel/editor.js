// Editor de Ruleta — preguntas con imagen opcional (igual que Pregunta Live).
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { toast } from '../../core/toast.js';
import { newItem, migrateLegacyItems } from '../../core/contentModels/items.js';

const IMG_MAX_BYTES = 200 * 1024; // 200 KB — stored inline as data-URL

function readDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    r.readAsDataURL(file);
  });
}

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

function imgTileHtml(url, i) {
  return `
    <input type="file" accept="image/*" class="d-none we-img-file">
    ${url
      ? `<img src="${escapeHtml(url)}" class="img-fluid rounded mb-1" style="max-height:80px;object-fit:contain">`
      : `<div class="d-flex flex-column align-items-center justify-content-center text-muted bg-body-secondary rounded mb-1" style="height:70px"><i class="bi bi-image fs-4"></i><small>Sin imagen</small></div>`}
    <div class="d-flex gap-1 justify-content-center flex-wrap">
      <button type="button" class="btn btn-sm btn-outline-primary we-img-add"><i class="bi ${url ? 'bi-arrow-repeat' : 'bi-plus-lg'}"></i> ${url ? 'Cambiar' : 'Imagen'}</button>
      ${url ? `<button type="button" class="btn btn-sm btn-outline-danger we-img-del"><i class="bi bi-trash"></i></button>` : ''}
    </div>`;
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
        <div class="col-12 col-md-3 text-center" id="we-img-${i}">${imgTileHtml(item.image, i)}</div>
      </div>`).join('')}
    ${n < 32 ? `<button class="btn btn-outline-primary mt-2" id="we-add"><i class="bi bi-plus-lg"></i> Añadir opción</button>` : `<p class="text-muted small mt-2">Máximo 32 opciones alcanzado.</p>`}`;
}

function wireContent(root, a, ctx) {
  on(root, 'input', '.we-entry', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.item-del', (_, b) => { a.content.items.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, b) => { reorderArray(a.content.items, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.items, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#we-add', () => { a.content.items.push(newItem()); ctx.onChange(a); ctx.repaint(); });

  // Inline image handling (data-URL, 200 KB cap).
  const tileIndex = (el) => { const t = el.closest('[id^="we-img-"]'); return t ? +t.id.slice(7) : -1; };
  on(root, 'click', '.we-img-add', (_, b) => { b.closest('[id^="we-img-"]')?.querySelector('.we-img-file')?.click(); });
  on(root, 'click', '.we-img-del', (_, b) => { const i = tileIndex(b); if (i < 0) return; a.content.items[i].image = null; ctx.onChange(a); ctx.repaint(); });
  on(root, 'change', '.we-img-file', async (e) => {
    const input = e.target;
    const i = tileIndex(input);
    const f = input.files?.[0];
    if (i < 0 || !f) return;
    if (f.size > IMG_MAX_BYTES) { toast(`Imagen demasiado grande (${Math.round(f.size / 1024)} KB). Máximo 200 KB.`, 'danger', 5000); input.value = ''; return; }
    try {
      a.content.items[i].image = await readDataUrl(f);
      ctx.onChange(a); ctx.repaint();
    } catch (err) { toast(err.message, 'danger', 4000); }
  });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4">
      <label class="form-label">Duración del giro (ms) <span class="text-muted small">solo modo individual</span></label>
      <input id="we-dur" type="number" min="500" max="30000" step="500" class="form-control" value="${a.rules.spinDurationMs ?? 4000}">
      <div class="form-text">Máximo 30 000 ms (30 s).</div>
    </div>
    <div class="col-md-4 form-check pt-4 mt-2">
      <input class="form-check-input" type="checkbox" id="we-rm" ${a.rules.removeAfterSpin ? 'checked' : ''}>
      <label class="form-check-label" for="we-rm">Quitar tras girar <span class="text-muted small">(individual)</span></label>
    </div>
  </div>`;
}

function wireRules(root, a, ctx) {
  on(root, 'input', '#we-dur', e => { a.rules.spinDurationMs = Math.min(30000, +e.target.value || 4000); ctx.onChange(a); });
  on(root, 'change', '#we-rm', e => { a.rules.removeAfterSpin = e.target.checked; ctx.onChange(a); });
}
