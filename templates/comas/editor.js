// Comas editor: paste text WITH commas; the app strips them and stores
// the positions as marks. Works just like the Tildes editor but for commas.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { applyMarks, parseTextWithCommas } from '../../core/textMarks.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { listSkins, skinPreviewHtml } from '../../core/skins.js';
import { listBackgrounds, backgroundPreviewHtml } from '../../core/backgrounds.js';

export function renderComasEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.passages)) a.content = { passages: [newPassage()] };
  function commit() { onChange(a); paint(); }

  function paint() {
    mount(root, html`
      <div class="row g-2 mb-3">
        <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title)}"></div>
        <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
      </div>
      <ul class="nav nav-tabs">
        <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-content">Frases</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-rules">Reglas</button></li>
        <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-pres">Presentación</button></li>
      </ul>
      <div class="tab-content border border-top-0 p-3 rounded-bottom">
        <div class="tab-pane fade show active" id="tab-content">
          <p class="small text-muted">Escribe la frase <b>con sus comas</b>. La app las quita y guarda dónde van.</p>
          ${a.content.passages.map((p, i) => renderPassage(p, i, a.content.passages.length)).join('')}
          <button class="btn btn-outline-primary mt-2" id="t-add"><i class="bi bi-plus-lg"></i> Añadir frase</button>
        </div>
        <div class="tab-pane fade" id="tab-rules">
          <div class="row g-3">
            <div class="col-md-4 form-check pt-4 ms-3"><input id="t-rand" class="form-check-input" type="checkbox" ${a.rules.randomize?'checked':''}><label class="form-check-label" for="t-rand">Mezclar frases</label></div>
            <div class="col-md-4 form-check pt-4"><input id="t-overflow" class="form-check-input" type="checkbox" ${a.rules.allowOverflow!==false?'checked':''}><label class="form-check-label" for="t-overflow">Comas ilimitadas</label></div>
            <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input id="t-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
            <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="t-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
          </div>
        </div>
        <div class="tab-pane fade" id="tab-pres">${renderPresentation(a)}</div>
      </div>
    `);

    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-subtitle', e => { a.subtitle = e.target.value; onChange(a); });
    on(root, 'input', '.tp-accented', (e, el) => {
      const idx = +el.dataset.i;
      const { text, marks } = parseTextWithCommas(e.target.value);
      const p = a.content.passages[idx];
      p.text = text; p.marks = marks;
      onChange(a);
      const preview = document.querySelector(`[data-preview="${idx}"]`);
      if (preview) preview.textContent = text || '(vacío)';
      const expected = document.querySelector(`[data-expected="${idx}"]`);
      if (expected) expected.textContent = applyMarks(text, marks);
    });
    on(root, 'click', '#t-add', () => { a.content.passages.push(newPassage()); commit(); });
    on(root, 'click', '.item-del',  (_, b) => { a.content.passages.splice(+b.dataset.i, 1); commit(); });
    on(root, 'click', '.item-up',   (_, b) => { reorderArray(a.content.passages, +b.dataset.i, -1); commit(); });
    on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.passages, +b.dataset.i, +1); commit(); });
    on(root, 'change', '#t-rand', e => { a.rules.randomize = e.target.checked; onChange(a); });
    on(root, 'change', '#t-overflow', e => { a.rules.allowOverflow = e.target.checked; onChange(a); });
    on(root, 'input', '#t-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; onChange(a); });
    on(root, 'input', '#t-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; onChange(a); });
    on(root, 'click', '.skin-pick', (_, b) => { a.presentation.skin = b.dataset.name; onChange(a); root.querySelectorAll('.skin-pick').forEach(x => x.classList.toggle('is-active', x === b)); });
    on(root, 'click', '.bg-pick',   (_, b) => { a.presentation.background = b.dataset.name; onChange(a); root.querySelectorAll('.bg-pick').forEach(x => x.classList.toggle('is-active', x === b)); });
  }

  function renderPassage(p, i, total) {
    const accented = applyMarks(p.text || '', p.marks || []);
    return `
      <div class="card mb-3"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-secondary">Frase ${i + 1}</span>
          ${itemControlsHtml(i, total)}
        </div>
        <textarea class="form-control mb-2 tp-accented" data-i="${i}" rows="2" placeholder="ej. Hola, ¿cómo estás?">${escapeHtml(accented)}</textarea>
        <div class="row small">
          <div class="col-md-6"><span class="text-muted">Lo que verá el alumno:</span> <span data-preview="${i}" class="font-monospace">${escapeHtml(p.text || '(vacío)')}</span></div>
          <div class="col-md-6"><span class="text-muted">Solución:</span> <b data-expected="${i}">${escapeHtml(accented)}</b></div>
        </div>
      </div></div>`;
  }

  function renderPresentation(a) {
    const cs = a.presentation?.skin || 'default';
    const cb = a.presentation?.background || 'notebook';
    return `
      <h6 class="mb-2">Skin (colores y sonidos)</h6>
      <div class="d-flex flex-wrap gap-3 mb-4">
        ${listSkins().map(s => `
          <div class="ww-skin-tile skin-pick ${cs===s.name?'is-active':''}" data-name="${s.name}" role="button">
            ${skinPreviewHtml(s.name)}
            <div class="text-center small mt-1">${escapeHtml(s.description || '')}</div>
          </div>`).join('')}
      </div>
      <h6 class="mb-2">Fondo</h6>
      <div class="d-flex flex-wrap gap-3">
        ${listBackgrounds().map(b => `
          <div class="ww-skin-tile bg-pick ${cb===b.name?'is-active':''}" data-name="${b.name}" role="button" style="width:120px">
            ${backgroundPreviewHtml(b.name)}
            <div class="text-center small text-muted">${escapeHtml(b.description || '')}</div>
          </div>`).join('')}
      </div>`;
  }

  paint();
}
