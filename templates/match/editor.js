// Editor de Emparejar — aporta sus paneles; el chasis lo pone el shell (vía
// renderPairsEditor, el wrapper del modelo — core/contentModels/pairs.js).
import { escapeHtml } from '../../core/html.js';
import { toast, TOAST_NORMAL } from '../../core/toast.js';
import { uploadMedia } from '../../core/upload.js';
import { abrirBuscadorImagenes } from '../../core/imageSearchModal.js';
import { on } from '../../core/events.js';
import { newPair, renderPairsEditor } from '../../core/contentModels/pairs.js';
import { itemControlsHtml, wireItemList, ruleScopeNote } from '../../core/editorPrimitives.js';
import { scoringPanelHtml, wireScoringPanel } from '../../core/editorPanels.js';

export function renderMatchEditor(root, activity, onChange) {
  return renderPairsEditor(root, activity, onChange, {
    seedCount: 2,
    panels: {
      content: { label: 'Pares', html: contentHtml, wire: wireContent },
      rules:   { html: rulesHtml,   wire: wireRules   },
      // Sin "Modo" (bonus por velocidad): Emparejar no va a Live (`modes.live: false`).
      scoring: { html: (a) => scoringPanelHtml(a, { conModo: false }), wire: wireScoringPanel },
    },
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
          <button class="btn btn-outline-secondary mp-img-search" data-i="${i}" data-side="L" type="button" title="Buscar una imagen libre"><i class="bi bi-search"></i></button>
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
          <button class="btn btn-outline-secondary mp-img-search" data-i="${i}" data-side="R" type="button" title="Buscar una imagen libre"><i class="bi bi-search"></i></button>
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
  wireItemList(root, a, ctx, { list: a.content.pairs, añadir: { selector: '#mp-add', fabrica: newPair } });

  // Image upload
  on(root, 'click', '.mp-img-btn', (_, btn) => {
    const i    = +btn.dataset.i;
    const side = btn.dataset.side;
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = 'image/*';
    // Por el dueño único (core/upload.js): tope de §25 + allowlist de MIME. Este
    // bloque leía el fichero a mano con un 200 KB escrito aquí, sin mirar el
    // tipo, y avisaba con `alert()` en vez del toast de la app.
    inp.onchange = async () => {
      const file = inp.files[0];
      if (!file) return;
      try {
        const field = side === 'L' ? 'leftImage' : 'rightImage';
        a.content.pairs[i][field] = await uploadMedia(file);
        delete a.content.pairs[i][field + 'Credit'];   // el crédito se va con su imagen
        ctx.onChange(a);
        ctx.repaint();
      } catch (err) { toast(err.message, 'danger', TOAST_NORMAL); }
    };
    inp.click();
  });

  // Buscar una imagen libre (F6): la misma puerta que en el resto de editores.
  on(root, 'click', '.mp-img-search', async (_, btn) => {
    const i = +btn.dataset.i;
    const side = btn.dataset.side;
    const field = side === 'L' ? 'leftImage' : 'rightImage';
    const par = a.content.pairs[i];
    const r = await abrirBuscadorImagenes({ consulta: (side === 'L' ? par.left : par.right) || '' });
    if (!r) return;
    par[field] = r.url;
    par[field + 'Credit'] = r.atribucion;
    ctx.onChange(a); ctx.repaint();
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
