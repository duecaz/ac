// Editor for Operaciones: a list of operations (text + numeric result) plus a
// quick multiplication-table generator.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderModesTab, wireModesTab } from '../../core/editorModes.js';

export function renderMathEditor(root, activity, onChange) {
  const a = activity;
  if (!a.content) a.content = { items: [] };
  if (!a.scoring) a.scoring = { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 };
  if (!a.rules) a.rules = { randomize: true };
  const commit = () => { onChange(a); paint(); };

  function paint() {
    mount(root, html`
      <div class="ww-editor">
        <div class="row g-2 mb-3">
          <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" id="f-title" value="${escapeHtml(a.title || '')}"></div>
          <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" id="f-sub" value="${escapeHtml(a.subtitle || '')}"></div>
        </div>
        <div class="form-check mb-2">
          <input class="form-check-input" type="checkbox" id="f-rand" ${a.rules.randomize !== false ? 'checked' : ''}>
          <label class="form-check-label" for="f-rand">Mezclar el orden de las operaciones</label>
        </div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <div class="input-group" style="max-width:300px">
            <span class="input-group-text">Tabla del</span>
            <input type="number" min="1" max="12" class="form-control" id="gen-n" value="2">
            <button class="btn btn-outline-success" id="gen-table"><i class="bi bi-magic"></i> Generar &times;1&ndash;10</button>
          </div>
          <button class="btn btn-outline-primary" id="add-op"><i class="bi bi-plus-lg"></i> A&ntilde;adir operaci&oacute;n</button>
        </div>
        <div class="form-text mb-2">Escribe la operaci&oacute;n (ej. <code>2 &times; 6</code>) y su resultado. El alumno responde con el teclado num&eacute;rico.</div>
        ${renderItems(a)}
        <hr class="my-4">
        <h6 class="text-muted text-uppercase small mb-2"><i class="bi bi-controller"></i> Modos de juego</h6>
        ${renderModesTab(a)}
      </div>`);

    on(root, 'input', '#f-title', e => { a.title = e.target.value; onChange(a); });
    on(root, 'input', '#f-sub', e => { a.subtitle = e.target.value; onChange(a); });
    on(root, 'change', '#f-rand', e => { a.rules.randomize = e.target.checked; onChange(a); });
    on(root, 'click', '#add-op', () => {
      a.content.items.push({ id: 'm_' + Math.random().toString(36).slice(2, 8), question: '', answer: '', points: 1 });
      commit();
    });
    on(root, 'click', '#gen-table', () => {
      const n = Math.max(1, Math.min(12, +(root.querySelector('#gen-n')?.value) || 2));
      for (let i = 1; i <= 10; i++) a.content.items.push({ id: 'm_' + Math.random().toString(36).slice(2, 8), question: `${n} × ${i}`, answer: String(n * i), points: 1 });
      commit();
    });
    on(root, 'input', '.it-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; onChange(a); });
    on(root, 'input', '.it-a', (e, el) => { a.content.items[+el.dataset.i].answer = e.target.value.trim(); onChange(a); });
    on(root, 'click', '.it-del', (_, b) => { a.content.items.splice(+b.dataset.i, 1); commit(); });
    wireModesTab(root, a, onChange);
  }
  paint();
}

function renderItems(a) {
  if (!a.content.items.length) return `<p class="text-muted">Sin operaciones. Usa "Generar" o "A&ntilde;adir operaci&oacute;n".</p>`;
  return a.content.items.map((it, i) => `
    <div class="input-group mb-2">
      <span class="input-group-text">#${i + 1}</span>
      <input class="form-control it-q" data-i="${i}" placeholder="Operación (ej. 2 × 6)" value="${escapeHtml(it.question || '')}">
      <span class="input-group-text">=</span>
      <input class="form-control it-a" data-i="${i}" style="max-width:130px" inputmode="numeric" placeholder="Resultado" value="${escapeHtml(it.answer ?? '')}">
      <button class="btn btn-outline-danger it-del" data-i="${i}" title="Eliminar"><i class="bi bi-trash"></i></button>
    </div>`).join('');
}
