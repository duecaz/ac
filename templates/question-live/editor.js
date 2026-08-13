import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
// La subida de imagen pasa por core/upload.js (uploadMedia), que es el dueño
// único: aplica el tope de core/quotas.js (§25) Y valida el MIME contra su
// allowlist. Este editor tenía su propio IMG_MAX_BYTES + readDataUrl copiados
// —el mismo bloque en wheel y question-live, byte por byte— y NO miraba el
// tipo: `accept="image/*"` es una sugerencia del navegador, no una validación,
// así que cualquier fichero entraba como data-URL en el JSON de la actividad.
import { uploadMedia } from '../../core/upload.js';
import { abrirBuscadorImagenes } from '../../core/imageSearchModal.js';
import { toast } from '../../core/toast.js';
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

function imgTileHtml(url) {
  return `
    <input type="file" accept="image/*" class="d-none ql-img-file">
    ${url
      ? `<img src="${escapeHtml(url)}" class="img-fluid rounded mb-1" style="max-height:90px;object-fit:contain">`
      : `<div class="d-flex flex-column align-items-center justify-content-center text-muted bg-body-secondary rounded mb-1" style="height:80px"><i class="bi bi-image fs-4"></i><small>Sin imagen</small></div>`}
    <div class="d-flex gap-1 justify-content-center flex-wrap">
      <button type="button" class="btn btn-sm btn-outline-primary ql-img-add"><i class="bi ${url ? 'bi-arrow-repeat' : 'bi-plus-lg'}"></i> ${url ? 'Cambiar' : 'Imagen'}</button>
      <button type="button" class="btn btn-sm btn-outline-primary ql-img-search" title="Buscar una imagen libre"><i class="bi bi-search"></i></button>
      ${url ? `<button type="button" class="btn btn-sm btn-outline-danger ql-img-del"><i class="bi bi-trash"></i></button>` : ''}
    </div>`;
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
        <div class="col-12 col-md-3 text-center" id="img-${i}">${imgTileHtml(item.image)}</div>
      </div>`).join('')}
    <button class="btn btn-outline-primary mt-2" id="ql-add"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>`;
}

function wireContent(root, a, ctx) {
  on(root, 'input', '.ql-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.item-del', (_, b) => { a.content.items.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, b) => { reorderArray(a.content.items, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.items, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#ql-add', () => { a.content.items.push(newItem()); ctx.onChange(a); ctx.repaint(); });

  // Inline image handling (data-URL, 200 KB cap, no external upload).
  const tileIndex = (el) => { const t = el.closest('[id^="img-"]'); return t ? +t.id.slice(4) : -1; };
  on(root, 'click', '.ql-img-add', (_, b) => { b.closest('[id^="img-"]')?.querySelector('.ql-img-file')?.click(); });
  on(root, 'click', '.ql-img-del', (_, b) => { const i = tileIndex(b); if (i < 0) return; a.content.items[i].image = null; ctx.onChange(a); ctx.repaint(); });
  on(root, 'change', '.ql-img-file', async (e) => {
    const input = e.target;
    const i = tileIndex(input);
    const f = input.files?.[0];
    if (i < 0 || !f) return;
    try {
      a.content.items[i].image = await uploadMedia(f);
      delete a.content.items[i].imageCredit;   // el crédito se va con su imagen
      ctx.onChange(a); ctx.repaint();
    } catch (err) { toast(err.message, 'danger', 4000); }
  });
  // Buscar una imagen libre (F6): la misma puerta que en el resto de editores.
  on(root, 'click', '.ql-img-search', async (_, b) => {
    const i = tileIndex(b);
    if (i < 0) return;
    const r = await abrirBuscadorImagenes({ consulta: a.content.items[i].question || '' });
    if (!r) return;
    a.content.items[i].image = r.url;
    a.content.items[i].imageCredit = r.atribucion;
    ctx.onChange(a); ctx.repaint();
  });
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
