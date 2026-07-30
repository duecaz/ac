// Editor de "Etiqueta el diagrama": sube una imagen de fondo, HAZ CLIC sobre ella
// para poner un pin (guarda x,y como fracción), arrástralo para moverlo, y escribe
// la etiqueta de cada pin. El chasis (título, ajustes, tabs) lo pone el shell.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { ruleScopeNote } from '../../core/editorPrimitives.js';
import { uploadMedia } from '../../core/upload.js';
import { newPin } from '../../core/contentModels/diagram.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { toast } from '../../core/toast.js';

export function renderDiagramEditor(root, activity, onChange) {
  const a = activity;
  if (!a.content || typeof a.content !== 'object') a.content = { image: null, pins: [] };
  if (!Array.isArray(a.content.pins)) a.content.pins = [];
  renderEditorShell(root, a, onChange, {
    content: { label: 'Imagen y pines', html: contentHtml, wire: wireContent },
    rules:   { html: rulesHtml,   wire: wireRules },
    scoring: { html: scoringHtml, wire: wireScoring },
  });
}

function contentHtml(a) {
  const pins = a.content.pins;
  const img = a.content.image;
  return `
    <div class="mb-3">
      <label class="btn btn-outline-primary">
        <i class="bi bi-image"></i> ${img ? 'Cambiar imagen' : 'Subir imagen de fondo'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" id="dg-img-file" hidden>
      </label>
      <span class="text-muted small ms-2">Se guarda dentro de la actividad (imagen ligera, &lt;200 KB).</span>
    </div>
    ${img ? `
      <p class="small text-muted mb-1"><i class="bi bi-info-circle"></i> Haz clic en la imagen para añadir un pin; arrástralo para moverlo.</p>
      <div class="dg-edit-stage mb-3">
        <div class="dg-img-box" id="dg-edit-box">
          <img class="dg-img" src="${escapeHtml(img)}" alt="" draggable="false">
          ${pins.map((p, i) => `<span class="dg-pin dg-edit-pin" data-i="${i}" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%">${i + 1}</span>`).join('')}
        </div>
      </div>
      <div class="fw-bold small text-muted mb-1">Etiquetas (${pins.length})</div>
      ${pins.map((p, i) => `
        <div class="input-group mb-2">
          <span class="input-group-text">${i + 1}</span>
          <input class="form-control dg-label-input" data-i="${i}" placeholder="Etiqueta del pin ${i + 1}" value="${escapeHtml(p.label || '')}">
          <button class="btn btn-outline-danger dg-pin-del" data-i="${i}" type="button" title="Eliminar pin"><i class="bi bi-trash"></i></button>
        </div>`).join('')}
      ${pins.length === 0 ? '<p class="text-muted">Aún no hay pines. Haz clic en la imagen.</p>' : ''}
    ` : '<p class="text-muted">Sube una imagen para empezar a colocar pines.</p>'}`;
}

function wireContent(root, a, ctx) {
  on(root, 'change', '#dg-img-file', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      a.content.image = await uploadMedia(file);
      ctx.onChange(a); ctx.repaint();
    } catch (err) { toast('No se pudo cargar la imagen: ' + err.message, 'warning', 5000); }
  });

  on(root, 'input', '.dg-label-input', (e, el) => { a.content.pins[+el.dataset.i].label = el.value; ctx.onChange(a); });
  on(root, 'click', '.dg-pin-del', (_, b) => { a.content.pins.splice(+b.dataset.i, 1); ctx.onChange(a); ctx.repaint(); });

  const box = root.querySelector('#dg-edit-box');
  if (!box) return;
  let drag = null;
  const frac = (e) => {
    const r = box.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
             y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  box.addEventListener('pointerdown', (e) => {
    const pin = e.target.closest('.dg-edit-pin');
    if (!pin) return;                          // clic en vacío → lo maneja el 'click'
    e.preventDefault();
    drag = { i: +pin.dataset.i, moved: false, pointerId: e.pointerId };
    try { box.setPointerCapture(e.pointerId); } catch {}
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.moved = true;
    const { x, y } = frac(e);
    a.content.pins[drag.i].x = x; a.content.pins[drag.i].y = y;
    const el = box.querySelector(`.dg-edit-pin[data-i="${drag.i}"]`);
    if (el) { el.style.left = (x * 100) + '%'; el.style.top = (y * 100) + '%'; }
  });
  box.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    try { box.releasePointerCapture(e.pointerId); } catch {}
    if (drag.moved) { ctx.onChange(a); box._suppressClick = true; setTimeout(() => { box._suppressClick = false; }, 0); }
    drag = null;
  });
  // Clic sobre la imagen (no sobre un pin, no tras arrastrar) → añade un pin.
  box.querySelector('.dg-img')?.addEventListener('click', (e) => {
    if (box._suppressClick) return;
    const { x, y } = frac(e);
    a.content.pins.push({ ...newPin(x, y), label: '' });
    ctx.onChange(a); ctx.repaint();
  });
}

// ── Rules + scoring (mínimos: barajar + puntos por acierto) ─────────────────────
function rulesHtml(a) {
  return `<div class="form-check">
    <input class="form-check-input" type="checkbox" id="dg-rand" ${a.rules?.randomize !== false ? 'checked' : ''}>
    <label class="form-check-label" for="dg-rand">Barajar el orden de las etiquetas</label>
  </div>
    ${ruleScopeNote()}`;
}
function wireRules(root, a, ctx) {
  on(root, 'change', '#dg-rand', (e) => { (a.rules = a.rules || {}).randomize = e.target.checked; ctx.onChange(a); });
}
function scoringHtml(a) {
  return `<div class="input-group" style="max-width:280px">
    <span class="input-group-text">Puntos por acierto</span>
    <input type="number" min="1" class="form-control" id="dg-ppc" value="${a.scoring?.pointsPerCorrect ?? 1}">
  </div>`;
}
function wireScoring(root, a, ctx) {
  on(root, 'input', '#dg-ppc', (e) => { (a.scoring = a.scoring || {}).pointsPerCorrect = Math.max(1, +e.target.value || 1); ctx.onChange(a); });
}
