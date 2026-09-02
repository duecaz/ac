import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, wireItemList } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
// El tile de imagen (subir · buscar · quitar) es de core/imageTile.js — este
// editor y wheel/editor.js lo tenían copiado byte por byte (barrido B5, 2026-09-02).
import { imageTileHtml, wireImageTile } from '../../core/imageTile.js';
import { newItem } from '../../core/contentModels/items.js';

// Images are stored INLINE as data-URLs inside the activity JSON (same approach
// as the custom background). No external upload — works on PocketBase with no
// Supabase storage. Kept small so the activity/live record stays light.

export function renderQuestionLiveEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.items)) {
    a.content = { items: [newItem(), newItem(), newItem()] };
  }
  if (!a.rules) a.rules = {};
  if (!a.rules.selector) a.rules.selector = 'boxes';
  renderEditorShell(root, a, onChange, {
    content: { label: 'Preguntas', html: contentHtml, wire: wireContent },
    rules: { label: 'Selector', html: rulesHtml, wire: wireRules },
  });
}

function contentHtml(a) {
  return `
    <p class="small text-muted">Preguntas que se muestran en cajas numeradas. El alumno elige una caja, responde de viva voz y el profesor asigna los puntos. Puedes añadir una imagen a cada pregunta (máx. 200&nbsp;KB).</p>
    ${a.content.items.map((item, i) => `
      <div class="row g-2 mb-3 align-items-start border-bottom pb-3">
        <div class="col-12 col-md-9">
          <div class="input-group">
            <span class="input-group-text fw-bold">${i + 1}</span>
            <input class="form-control ql-q" data-i="${i}" placeholder="Escribe la pregunta aquí…" value="${escapeHtml(item.question ?? item.q ?? '')}">
            <span class="input-group-text p-0 border-0 ps-2 d-flex">${itemControlsHtml(i, a.content.items.length)}</span>
          </div>
        </div>
        <div class="col-12 col-md-3 text-center" id="ql-img-${i}">${imageTileHtml(item.image, { prefix: 'ql-', height: 90 })}</div>
      </div>`).join('')}
    <button class="btn btn-outline-primary mt-2" id="ql-add"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>`;
}

function wireContent(root, a, ctx) {
  on(root, 'input', '.ql-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  wireItemList(root, a, ctx, { list: a.content.items, añadir: { selector: '#ql-add', fabrica: newItem } });
  wireImageTile(root, a, a.content.items, ctx, { prefix: 'ql-', queryField: 'question' });
}

function rulesHtml(a) {
  const sel = a.rules?.selector || 'boxes';
  return `
    <label class="form-label fw-bold">¿Cómo elige el alumno la pregunta?</label>
    <div class="row g-3">
      <div class="col-md-6">
        <div class="form-check card p-3 ${sel === 'boxes' ? 'border-primary' : ''}">
          <input class="form-check-input ql-sel" type="radio" name="ql-sel" id="ql-sel-boxes" value="boxes" ${sel === 'boxes' ? 'checked' : ''}>
          <label class="form-check-label" for="ql-sel-boxes">
            <b><i class="bi bi-grid-3x3-gap-fill"></i> Cajas</b><br>
            <span class="small text-muted">Rejilla de cajas numeradas; el alumno toca una.</span>
          </label>
        </div>
      </div>
      <div class="col-md-6">
        <div class="form-check card p-3 ${sel === 'wheel' ? 'border-primary' : ''}">
          <input class="form-check-input ql-sel" type="radio" name="ql-sel" id="ql-sel-wheel" value="wheel" ${sel === 'wheel' ? 'checked' : ''}>
          <label class="form-check-label" for="ql-sel-wheel">
            <b><i class="bi bi-bullseye"></i> Ruleta</b><br>
            <span class="small text-muted">El alumno gira una rueda y le toca la pregunta que salga.</span>
          </label>
        </div>
      </div>
    </div>`;
}

function wireRules(root, a, ctx) {
  on(root, 'change', '.ql-sel', (e) => { a.rules.selector = e.target.value; ctx.onChange(a); ctx.repaint(); });
}
