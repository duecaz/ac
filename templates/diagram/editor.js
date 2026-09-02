// Editor de "Etiqueta el diagrama": sube una imagen de fondo, HAZ CLIC sobre ella
// para poner un pin (guarda x,y como fracción), arrástralo para moverlo, y escribe
// la etiqueta de cada pin. El chasis (título, ajustes, tabs) lo pone el shell.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { ruleScopeNote } from '../../core/editorPrimitives.js';
import { uploadMedia, medirImagen } from '../../core/upload.js';
import { QUOTAS } from '../../core/quotas.js';
import { newPin } from '../../core/contentModels/diagram.js';
import { renderEditorShell } from '../../core/editorShell.js';
import { toast, TOAST_LARGO, TOAST_NORMAL } from '../../core/toast.js';
import { abrirBuscadorImagenes } from '../../core/imageSearchModal.js';
import { creditoTexto } from '../../core/imageSearch.js';

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
    <div class="mb-3 d-flex align-items-center gap-2 flex-wrap">
      <label class="btn btn-outline-primary mb-0">
        <i class="bi bi-image"></i> ${img ? 'Cambiar imagen' : 'Subir imagen de fondo'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" id="dg-img-file" hidden>
      </label>
      <button type="button" class="btn btn-outline-primary" id="dg-img-search">
        <i class="bi bi-search"></i> Buscar imagen
      </button>
      <span class="text-muted small">Se guarda dentro de la actividad (se comprime sola; hasta 800 KB).</span>
    </div>
    ${a.content.imageCredit ? `<p class="text-muted small mb-2"><i class="bi bi-c-circle"></i> Imagen de ${escapeHtml(creditoTexto(a.content.imageCredit))}</p>` : ''}
    ${img ? `
      <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
        <button type="button" class="btn btn-outline-success btn-sm" id="dg-add">
          <i class="bi bi-plus-lg"></i> Añadir etiqueta
        </button>
        <span class="small text-muted"><i class="bi bi-info-circle"></i> …o haz clic sobre la imagen. Arrastra un pin para moverlo.</span>
      </div>
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
    ` : ''}`;
}

function wireContent(root, a, ctx) {
  // SUBIR y BUSCAR acaban aquí: una sola función pone la imagen, con lo que la
  // regla dura (cambiar el soporte invalida los pines) no puede quedarse en uno
  // de los dos caminos.
  const ponerImagen = (dataUrl, atribucion = null) => {
    a.content.image = dataUrl;
    // LA FORMA DE LA FOTO ES CONTENIDO, y se apunta AQUÍ, cuando se elige. El
    // player la necesita para escribir su caja de una vez (`aspect-ratio`): si
    // la midiera al pintar, la actividad nacería con una medida y se
    // recalcularía a la vista. Se guarda al ponerla —cuando ya está cargada—,
    // así que no cuesta nada y viaja con la actividad (§24: campo declarado).
    medirImagen(dataUrl).then(({ w, h }) => {
      if (a.content.image !== dataUrl) return;   // ya la cambiaron otra vez
      if (w && h) { a.content.imageW = w; a.content.imageH = h; ctx.onChange(a); }
    });
    // El crédito viaja CON el píxel, o se va con él (§24: campo declarado del
    // contenido). Atribuir la imagen anterior sería peor que no atribuir.
    if (atribucion) a.content.imageCredit = atribucion;
    else delete a.content.imageCredit;
    // CAMBIAR EL SOPORTE INVALIDA LO ANCLADO A ÉL (R-C · plan del editor).
    // Los pines guardan x/y como FRACCIÓN de ESTA imagen: al cambiarla se
    // quedaban clavados donde estaban y «Nariz» aparecía en medio de tu mapa
    // — que es lo que veía cualquiera que subiera su propio diagrama sobre el
    // ejemplo. Se quitan y se DICE cuántos: dejarlo mudo es lo que hacía que
    // pareciera que el editor estaba roto.
    const habia = a.content.pins.length;
    if (habia) {
      a.content.pins = [];
      toast(`Imagen nueva: se quitaron ${habia} etiqueta${habia === 1 ? '' : 's'} — estaban colocadas sobre la anterior. `
        + 'Haz clic en la imagen para poner las tuyas.', 'info', TOAST_LARGO);
    }
    ctx.onChange(a); ctx.repaint();
  };

  on(root, 'change', '#dg-img-file', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Presupuesto de LIENZO, no de imagen de pregunta (§25): un diagrama se
      // mira de cerca y sus rótulos se leen. Con los 200 KB / 1280 px de una
      // foto de enunciado salía borroso justo donde hay que señalar.
      ponerImagen(await uploadMedia(file,
        { maxBytes: QUOTAS.canvasImageBytes, ladoMax: QUOTAS.canvasImageSide }));
    } catch (err) { toast('No se pudo cargar la imagen: ' + err.message, 'warning', TOAST_NORMAL); }
  });

  // BUSCAR (F6): el diagrama es el caso que lo pidió — nadie tiene a mano un
  // dibujo del corazón, y subirlo desde el móvil con la clase delante no pasa.
  on(root, 'click', '#dg-img-search', async () => {
    const elegido = await abrirBuscadorImagenes({
      maxBytes: QUOTAS.canvasImageBytes, ladoMax: QUOTAS.canvasImageSide,
      consulta: a.title && a.title !== 'Sin título' ? a.title : '',
    });
    if (elegido) ponerImagen(elegido.url, elegido.atribucion);
  });

  // «+ Añadir etiqueta» (R-B): el clic sobre la imagen sigue siendo un ATAJO,
  // pero no puede ser la ÚNICA puerta — vivía en una línea gris y el dueño no la
  // encontró. El pin nace en el CENTRO, a la vista y listo para arrastrar.
  on(root, 'click', '#dg-add', () => {
    if (!a.content.image) { toast('Primero sube el dibujo: las etiquetas se colocan encima.', 'info', TOAST_NORMAL); return; }
    a.content.pins.push(newPin(0.5, 0.5));
    ctx.onChange(a); ctx.repaint();
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
