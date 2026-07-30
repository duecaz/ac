// Editor de Emparejar — aporta sus paneles; el chasis lo pone el shell.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { newPair } from '../../core/contentModels/pairs.js';
import { itemControlsHtml, reorderArray, ruleScopeNote } from '../../core/editorPrimitives.js';
import { renderEditorShell } from '../../core/editorShell.js';

export function renderMatchEditor(root, activity, onChange) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: [newPair(), newPair()] };
  renderEditorShell(root, a, onChange, {
    content: { label: 'Pares', html: contentHtml, wire: wireContent },
    rules:   { html: rulesHtml,   wire: wireRules   },
    scoring: { html: scoringHtml, wire: wireScoring  },
  });
}

function contentHtml(a) {
  return `
    <div class="row g-2 mb-2 fw-bold small text-muted">
      <div class="col-5">Izquierda</div><div class="col-5">Derecha</div><div class="col-2"></div>
    </div>
    ${a.content.pairs.map((p, i) => pairRowHtml(p, i, a.content.pairs.length)).join('')}
    <button class="btn btn-outline-primary mt-2" id="mp-add"><i class="bi bi-plus-lg"></i> Añadir par</button>`;
}

function pairRowHtml(p, i, total) {
  const limg = p.leftImage || p.image || null;
  const rimg = p.rightImage || null;
  return `
    <div class="row g-2 mb-3 align-items-start">
      <div class="col-5">
        <div class="input-group mb-1">
          <input class="form-control mp-l" data-i="${i}" placeholder="Izquierda ${i + 1}" value="${escapeHtml(p.left || '')}">
          <button class="btn btn-outline-secondary mp-img-btn" data-i="${i}" data-side="L" type="button" title="Subir imagen"><i class="bi bi-camera"></i></button>
        </div>
        ${limg ? `<div class="d-flex align-items-center gap-1 mt-1">
          <img src="${limg}" style="height:44px;object-fit:contain;border-radius:6px;border:1px solid #dee2e6;" alt="">
          <button class="btn btn-sm btn-outline-danger mp-img-del" data-i="${i}" data-side="L" type="button" title="Quitar imagen">×</button>
        </div>` : ''}
      </div>
      <div class="col-5">
        <div class="input-group mb-1">
          <input class="form-control mp-r" data-i="${i}" placeholder="Derecha ${i + 1}" value="${escapeHtml(p.right || '')}">
          <button class="btn btn-outline-secondary mp-img-btn" data-i="${i}" data-side="R" type="button" title="Subir imagen"><i class="bi bi-camera"></i></button>
        </div>
        ${rimg ? `<div class="d-flex align-items-center gap-1 mt-1">
          <img src="${rimg}" style="height:44px;object-fit:contain;border-radius:6px;border:1px solid #dee2e6;" alt="">
          <button class="btn btn-sm btn-outline-danger mp-img-del" data-i="${i}" data-side="R" type="button" title="Quitar imagen">×</button>
        </div>` : ''}
      </div>
      <div class="col-2 d-flex align-items-start pt-1">${itemControlsHtml(i, total)}</div>
    </div>`;
}

function wireContent(root, a, ctx) {
  on(root, 'input',  '.mp-l', (e, el) => { a.content.pairs[+el.dataset.i].left  = e.target.value; ctx.onChange(a); });
  on(root, 'input',  '.mp-r', (e, el) => { a.content.pairs[+el.dataset.i].right = e.target.value; ctx.onChange(a); });
  on(root, 'click', '.item-del',  (_, b) => { a.content.pairs.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-up',   (_, b) => { reorderArray(a.content.pairs, +b.dataset.i, -1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '.item-down', (_, b) => { reorderArray(a.content.pairs, +b.dataset.i, +1); ctx.onChange(a); ctx.repaint(); });
  on(root, 'click', '#mp-add',    ()     => { a.content.pairs.push(newPair()); ctx.onChange(a); ctx.repaint(); });

  // Image upload
  on(root, 'click', '.mp-img-btn', (_, btn) => {
    const i    = +btn.dataset.i;
    const side = btn.dataset.side;
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      if (file.size > 200 * 1024) { alert('Imagen demasiado grande (máx 200 KB)'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const field = side === 'L' ? 'leftImage' : 'rightImage';
        a.content.pairs[i][field] = reader.result;
        ctx.onChange(a);
        ctx.repaint();
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  });

  // Image remove
  on(root, 'click', '.mp-img-del', (_, btn) => {
    const i    = +btn.dataset.i;
    const side = btn.dataset.side;
    const field = side === 'L' ? 'leftImage' : 'rightImage';
    delete a.content.pairs[i][field];
    if (side === 'L') delete a.content.pairs[i].image; // clear legacy field too
    ctx.onChange(a);
    ctx.repaint();
  });
}

function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4 form-check pt-4 ms-3"><input class="form-check-input" type="checkbox" id="m-rand" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="m-rand">Mezclar columnas</label></div>
    <div class="col-12">${ruleScopeNote()}</div>
      </div>`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#m-rand',  e => { a.rules.randomize = e.target.checked; ctx.onChange(a); });
}

function scoringHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4"><label class="form-label">Puntos por acierto</label><input id="m-ppc" type="number" min="0" class="form-control" value="${a.scoring.pointsPerCorrect ?? 1}"></div>
    <div class="col-md-4"><label class="form-label">Puntos por error</label><input id="m-ppw" type="number" class="form-control" value="${a.scoring.pointsPerWrong ?? 0}"></div>
  </div>`;
}
function wireScoring(root, a, ctx) {
  on(root, 'input', '#m-ppc', e => { a.scoring.pointsPerCorrect = +e.target.value || 0; ctx.onChange(a); });
  on(root, 'input', '#m-ppw', e => { a.scoring.pointsPerWrong  = +e.target.value || 0; ctx.onChange(a); });
}
