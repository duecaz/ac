import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { renderImagePicker, attachImagePicker } from '../../core/imagePicker.js';

export function renderQuestionLiveEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.items)) {
    a.content = { items: [newItem(), newItem(), newItem()] };
  }
  renderEditorShell(root, a, onChange, {
    content: { label: 'Preguntas', html: contentHtml, wire: wireContent },
  });
}

function newItem() {
  return { id: 'q_' + Math.random().toString(36).slice(2, 8), q: '', image: null };
}

function contentHtml(a) {
  return `
    <p class="small text-muted">Preguntas que se muestran en cajas numeradas. El alumno elige una caja, responde de viva voz y el profesor asigna los puntos. Puedes añadir una imagen a cada pregunta.</p>
    ${a.content.items.map((item, i) => `
      <div class="row g-2 mb-3 align-items-start border-bottom pb-3">
        <div class="col-12 col-md-9">
          <div class="input-group">
            <span class="input-group-text fw-bold">${i + 1}</span>
            <input class="form-control ql-q" data-i="${i}" placeholder="Escribe la pregunta aquí…" value="${escapeHtml(item.q || '')}">
            <span class="input-group-text p-0 border-0 ps-2 d-flex">${itemControlsHtml(i, a.content.items.length)}</span>
          </div>
        </div>
        <div class="col-12 col-md-3" id="img-${i}">${renderImagePicker(item.image)}</div>
      </div>`).join('')}
    <button class="btn btn-outline-primary mt-2" id="ql-add"><i class="bi bi-plus-lg"></i> Añadir pregunta</button>`;
}

function wireContent(root, a, ctx) {
  on(root, 'input', '.ql-q', (e, el) => { a.content.items[+el.dataset.i].q = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.item-del', (_, b) => { a.content.items.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, b) => { reorderArray(a.content.items, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.items, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#ql-add', () => { a.content.items.push(newItem()); ctx.onChange(a); ctx.repaint(); });
  a.content.items.forEach((item, i) => {
    attachImagePicker(root, `#img-${i}`, item.image, (url) => { item.image = url; ctx.onChange(a); }, { maxBytes: 200 * 1024 });
  });
}
