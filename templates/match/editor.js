// Editor de Emparejar — aporta sus paneles; el chasis lo pone el shell (vía
// renderPairsEditor, el wrapper del modelo — core/contentModels/pairs.js).
import { escapeHtml, marcado } from '../../core/html.js';
import { toast, TOAST_NORMAL } from '../../core/toast.js';
import { uploadMedia } from '../../core/upload.js';
import { abrirBuscadorImagenes } from '../../core/imageSearchModal.js';
import { on } from '../../core/events.js';
import { newPair, paresDe } from '../../core/contentModels/pairs.js';
import { renderPairsEditor } from '../../core/editorPares.js';
import { itemControlsHtml, wireItemList, wireCampoTexto, ruleScopeNote } from '../../core/editorPrimitives.js';
import { scoringPanelHtml, wireScoringPanel } from '../../core/editorPanels.js';
import { mensajeDe } from '../../core/frontera.js';
/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').Pair} Pair
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 * @typedef {import('../../core/editorShell.js').EditorCtx} EditorCtx
 */

/**
 * @param {Element} root
 * @param {Activity} activity
 * @param {(activity: Activity) => void} onChange
 */
export function renderMatchEditor(root, activity, onChange) {
  return renderPairsEditor(root, /** @type {import('../../kernel/contracts/activity.js').Activity<PairsContent>} */ (activity), onChange, {
    seedCount: 2,
    panels: {
      content: { label: 'Pares', html: contentHtml, wire: wireContent },
      rules:   { html: rulesHtml,   wire: wireRules   },
      // Sin "Modo" (bonus por velocidad): Emparejar no va a Live (`modes.live: false`).
      scoring: { html: (a) => scoringPanelHtml(a, { conModo: false }), wire: wireScoringPanel },
    },
  });
}

/** @param {Activity} a */
function contentHtml(a) {
  const lista = paresDe(a);
  return `
    <div class="row g-2 mb-2 fw-bold small text-muted">
      <div class="col-5">Izquierda</div><div class="col-5">Derecha</div><div class="col-2"></div>
    </div>
    ${lista.map((p, i) => pairRowHtml(p, i, lista.length)).join('')}
    <button class="btn btn-outline-primary mt-2" id="mp-add"><i class="bi bi-plus-lg"></i> Añadir par</button>`;
}

/** @param {Pair} p @param {number} i @param {number} total */
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

/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx */
function wireContent(root, a, ctx) {
  wireCampoTexto(root, a, ctx, { selector: '.mp-l', lista: () => paresDe(a), campo: 'left' });
  wireCampoTexto(root, a, ctx, { selector: '.mp-r', lista: () => paresDe(a), campo: 'right' });
  wireItemList(root, a, ctx, { list: paresDe(a), añadir: { selector: '#mp-add', fabrica: newPair } });

  // Image upload
  on(root, 'click', '.mp-img-btn', (_, btn) => {
    const par = /** @type {Record<string, unknown>|undefined} */ (paresDe(a)[Number(btn.dataset.i)]);
    const side = btn.dataset.side;
    if (!par) return;
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = 'image/*';
    // Por el dueño único (core/upload.js): tope de §25 + allowlist de MIME. Este
    // bloque leía el fichero a mano con un 200 KB escrito aquí, sin mirar el
    // tipo, y avisaba con `alert()` en vez del toast de la app.
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        const field = side === 'L' ? 'leftImage' : 'rightImage';
        par[field] = await uploadMedia(file);
        delete par[field + 'Credit'];   // el crédito se va con su imagen
        ctx.onChange(a);
        ctx.repaint();
      } catch (err) { toast(mensajeDe(err), 'danger', TOAST_NORMAL); }
    };
    inp.click();
  });

  // Buscar una imagen libre (F6): la misma puerta que en el resto de editores.
  on(root, 'click', '.mp-img-search', async (_, btn) => {
    const side = btn.dataset.side;
    const field = side === 'L' ? 'leftImage' : 'rightImage';
    const par = paresDe(a)[Number(btn.dataset.i)];
    if (!par) return;
    const r = await abrirBuscadorImagenes({ consulta: (side === 'L' ? par.left : par.right) || '' });
    if (!r) return;
    // Escritura por campo CALCULADO (el lado decide la clave): el par se mira
    // como saco solo para eso, no para leerlo.
    const saco = /** @type {Record<string, unknown>} */ (par);
    saco[field] = r.url;
    saco[field + 'Credit'] = r.atribucion;
    ctx.onChange(a); ctx.repaint();
  });

  // Image remove
  on(root, 'click', '.mp-img-del', (_, btn) => {
    const side = btn.dataset.side;
    const field = side === 'L' ? 'leftImage' : 'rightImage';
    const par = paresDe(a)[Number(btn.dataset.i)];
    if (!par) return;
    delete (/** @type {Record<string, unknown>} */ (par))[field];
    if (side === 'L') delete par.image; // clear legacy field too
    ctx.onChange(a);
    ctx.repaint();
  });
}

/** @param {Activity} a */
function rulesHtml(a) {
  return `<div class="row g-3">
    <div class="col-md-4 form-check pt-4 ms-3"><input class="form-check-input" type="checkbox" id="m-rand" ${a.rules.randomize ? 'checked' : ''}><label class="form-check-label" for="m-rand">Mezclar columnas</label></div>
    <div class="col-12">${ruleScopeNote()}</div>
      </div>`;
}
/** @param {Element} root @param {Activity} a @param {EditorCtx} ctx */
function wireRules(root, a, ctx) {
  on(root, 'change', '#m-rand', (e, el) => { a.rules.randomize = marcado(el); ctx.onChange(a); });
}
