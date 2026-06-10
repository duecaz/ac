// Editor de Emparejar — solo aporta sus paneles; el chasis lo pone el shell.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { itemControlsHtml, reorderArray } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderMatchEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: [newPair(), newPair()] };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Pares', html: contentHtml, wire: wireContent },
    rules: { html: rulesHtml, wire: wireRules },
    scoring: { html: scoringHtml, wire: wireScoring },
  });
}

function contentHtml(a) {
  return `
    <div class="row g-2 mb-2 fw-bold small text-muted">
      <div class="col-5">Izquierda</div><div class="col-5">Derecha</div><div class="col-2"></div>
    </div>
    ${a.content.pairs.map((p, i) => `
      <div class="row g-2 mb-2">
        <div class="col-5"><input class="form-control mp-l" data-i="${i}" placeholder="Pareja ${i + 1} izq" value="${escapeHtml(p.left || '')}"></div>
        <div class="col-5"><input class="form-control mp-r" data-i="${i}" placeholder="Pareja ${i + 1} der" value="${escapeHtml(p.right || '')}"></div>
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
    <div class="col-md-4 form-check pt-4 ms-3"><input class="form-check-input" type="checkbox" id="m-rand" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="m-rand">Mezclar columnas</label></div>
    <div class="col-md-4"><label class="form-label">Timer (s, 0=off)</label><input id="m-timer" type="number" min="0" class="form-control" value="${a.rules.timer || 0}"></div>
  </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#m-rand', e => { a.rules.randomize = e.target.checked; ctx.onChange(a); });
  on(root, 'input', '#m-timer', e => { a.rules.timer = +e.target.value || 0; ctx.onChange(a); });
}

function scoringHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input id="m-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
    <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="m-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
  </div>`;
}
function wireScoring(root, a, ctx) {
  on(root, 'input', '#m-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; ctx.onChange(a); });
  on(root, 'input', '#m-ppw', e => { a.scoring.pointsPerWrong = +e.target.value || 0; ctx.onChange(a); });
}
