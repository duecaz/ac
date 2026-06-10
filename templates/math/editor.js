// Editor de Operaciones — solo aporta sus paneles; el chasis (incluida la
// pestaña "Modos") lo pone el shell compartido.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderMathEditor(root, activity, onChange) {
  const a = activity;
  if (!a.content) a.content = { items: [] };
  if (!a.scoring) a.scoring = { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 };
  if (!a.rules) a.rules = { randomize: true };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Operaciones', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
  });
}

function contentHtml(a) {
  return `
    <div class="d-flex flex-wrap gap-2 mb-3">
      <div class="input-group" style="max-width:300px">
        <span class="input-group-text">Tabla del</span>
        <input type="number" min="1" max="12" class="form-control" id="gen-n" value="2">
        <button class="btn btn-outline-success" id="gen-table"><i class="bi bi-magic"></i> Generar &times;1&ndash;10</button>
      </div>
      <button class="btn btn-outline-primary" id="add-op"><i class="bi bi-plus-lg"></i> Añadir operación</button>
    </div>
    <div class="form-text mb-2">Escribe la operación (ej. <code>2 &times; 6</code>) y su resultado. El alumno responde con el teclado numérico.</div>
    ${renderItems(a)}`;
}
function wireContent(root, a, ctx) {
  on(root, 'click', '#add-op', () => {
    a.content.items.push({ id: 'm_' + Math.random().toString(36).slice(2, 8), question: '', answer: '', points: 1 });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'click', '#gen-table', () => {
    const n = Math.max(1, Math.min(12, +(root.querySelector('#gen-n')?.value) || 2));
    for (let i = 1; i <= 10; i++) a.content.items.push({ id: 'm_' + Math.random().toString(36).slice(2, 8), question: `${n} × ${i}`, answer: String(n * i), points: 1 });
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'input', '.it-q', (e, el) => { a.content.items[+el.dataset.i].question = e.target.value; ctx.onChange(a); });
  on(root, 'input', '.it-a', (e, el) => { a.content.items[+el.dataset.i].answer = e.target.value.trim(); ctx.onChange(a); });
  on(root, 'click', '.it-del', (_, b) => { a.content.items.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
}

function rulesHtml(a) {
  return `<div class="form-check">
    <input class="form-check-input" type="checkbox" id="f-rand" ${a.rules.randomize !== false ? 'checked' : ''}>
    <label class="form-check-label" for="f-rand">Mezclar el orden de las operaciones</label>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#f-rand', e => { a.rules.randomize = e.target.checked; ctx.onChange(a); });
}

function renderItems(a) {
  if (!a.content.items.length) return `<p class="text-muted">Sin operaciones. Usa "Generar" o "Añadir operación".</p>`;
  return a.content.items.map((it, i) => `
    <div class="input-group mb-2">
      <span class="input-group-text">#${i + 1}</span>
      <input class="form-control it-q" data-i="${i}" placeholder="Operación (ej. 2 × 6)" value="${escapeHtml(it.question || '')}">
      <span class="input-group-text">=</span>
      <input class="form-control it-a" data-i="${i}" style="max-width:130px" inputmode="numeric" placeholder="Resultado" value="${escapeHtml(it.answer ?? '')}">
      <button class="btn btn-outline-danger it-del" data-i="${i}" title="Eliminar"><i class="bi bi-trash"></i></button>
    </div>`).join('');
}
