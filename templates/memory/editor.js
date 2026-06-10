// Memoria usa el mismo contenido que Emparejar (pares). Solo aporta sus
// paneles; el chasis lo pone el shell compartido.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderMemoryEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: [newPair(), newPair(), newPair()] };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Pares', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
    scoring: { html: scoringHtml, wire: wireScoring },
  });
}

function contentHtml(a) {
  return `
    <p class="small text-muted">Cada par genera dos cartas (texto izquierdo y derecho).</p>
    ${a.content.pairs.map((p, i) => `
      <div class="row g-2 mb-2">
        <div class="col-5"><input class="form-control mp-l" data-i="${i}" placeholder="Carta A" value="${escapeHtml(p.left || '')}"></div>
        <div class="col-5"><input class="form-control mp-r" data-i="${i}" placeholder="Carta B" value="${escapeHtml(p.right || '')}"></div>
        <div class="col-2 d-flex">${itemControlsHtml(i, a.content.pairs.length)}</div>
      </div>`).join('')}
    <button class="btn btn-outline-primary mt-2" id="mp-add"><i class="bi bi-plus-lg"></i> Añadir par</button>`;
}
function wireContent(root, a, ctx) {
  on(root, 'input', '.mp-l', (e, el) => { a.content.pairs[+el.dataset.i].left = e.target.value; ctx.onChange(a); });
  on(root, 'input', '.mp-r', (e, el) => { a.content.pairs[+el.dataset.i].right = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.item-del', (_, b) => { a.content.pairs.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up', (_, b) => { reorderArray(a.content.pairs, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.pairs, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#mp-add', () => { a.content.pairs.push(newPair()); ctx.onChange(a); ctx.repaint(); });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Columnas</label>
      <select id="m-cols" class="form-select">
        ${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${a.rules.columns === n ? 'selected' : ''}>${n}</option>`).join('')}
      </select></div>
    <div class="col-md-4"><label class="form-label">Tiempo de revelado (ms)</label><input id="m-rev" type="number" min="200" max="5000" class="form-control" value="${a.rules.revealMs ?? 900}"></div>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#m-cols', e => { a.rules.columns = +e.target.value; ctx.onChange(a); });
  on(root, 'input', '#m-rev', e => { a.rules.revealMs = +e.target.value || 900; ctx.onChange(a); });
}

function scoringHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Puntos por par</label><input id="m-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
    <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="m-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
  </div>`;
}
function wireScoring(root, a, ctx) {
  on(root, 'input', '#m-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; ctx.onChange(a); });
  on(root, 'input', '#m-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; ctx.onChange(a); });
}
