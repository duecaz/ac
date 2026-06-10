// Editor de Tildes: lista de frases (escribe CON tildes; la app las quita y
// guarda dónde van). Solo aporta sus paneles; el chasis lo pone el shell.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPassage } from '../../core/contentModels/textCorrection.js';
import { applyMarks, parseAccentedText } from '../../core/textMarks.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderTildesEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.passages)) a.content = { passages: [newPassage()] };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Frases', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
  });
}

function contentHtml(a) {
  return `
    <p class="small text-muted">Escribe el texto SIN tildes. Después haz clic en cada vocal que debería llevar tilde.</p>
    ${a.content.passages.map((p, i) => renderPassage(p, i, a.content.passages.length)).join('')}
    <button class="btn btn-outline-primary mt-2" id="t-add"><i class="bi bi-plus-lg"></i> Añadir frase</button>`;
}
function wireContent(root, a, ctx) {
  on(root, 'input', '.tp-accented', (e, el) => {
    const idx = +el.dataset.i;
    const { text, marks } = parseAccentedText(e.target.value);
    const p = a.content.passages[idx];
    p.text = text; p.marks = marks;
    ctx.onChange(a);
    const preview = document.querySelector(`[data-preview="${idx}"]`);
    if (preview) preview.textContent = text || '(vacío)';
    const expected = document.querySelector(`[data-expected="${idx}"]`);
    if (expected) expected.textContent = applyMarks(text, marks);
  });
  on(root, 'click', '#t-add', () => { a.content.passages.push(newPassage()); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-del', (_, b) => { a.content.passages.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, b) => { reorderArray(a.content.passages, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.passages, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4 form-check pt-4 ms-3"><input id="t-rand" class="form-check-input" type="checkbox" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="t-rand">Mezclar frases</label></div>
    <div class="col-md-4 form-check pt-4"><input id="t-overflow" class="form-check-input" type="checkbox" ${a.rules.allowOverflow !== false ? 'checked' : ''}><label class="form-check-label" for="t-overflow">Tildes ilimitadas en la paleta</label></div>
    <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input id="t-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
    <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="t-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#t-rand', e => { a.rules.randomize = e.target.checked; ctx.onChange(a); });
  on(root, 'change', '#t-overflow', e => { a.rules.allowOverflow = e.target.checked; ctx.onChange(a); });
  on(root, 'input', '#t-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; ctx.onChange(a); });
  on(root, 'input', '#t-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; ctx.onChange(a); });
}

function renderPassage(p, i, total) {
  const accented = applyMarks(p.text || '', p.marks || []);
  return `
    <div class="card mb-3"><div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary">Frase ${i + 1}</span>
        ${itemControlsHtml(i, total)}
      </div>
      <label class="form-label small text-muted">Escribe la frase <b>con tildes</b>. La app las quita automáticamente y guarda dónde van.</label>
      <textarea class="form-control mb-2 tp-accented" data-i="${i}" rows="2" placeholder="ej. canción popular">${escapeHtml(accented)}</textarea>
      <div class="row small">
        <div class="col-md-6"><span class="text-muted">Lo que verá el alumno:</span> <span data-preview="${i}" class="font-monospace">${escapeHtml(p.text || '(vacío)')}</span></div>
        <div class="col-md-6"><span class="text-muted">Solución:</span> <b data-expected="${i}">${escapeHtml(accented)}</b></div>
      </div>
    </div></div>`;
}
