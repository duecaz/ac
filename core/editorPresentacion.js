// LA PESTAÑA «PRESENTACIÓN» DEL EDITOR: elegir skin y fondo de la actividad (y
// poner una imagen propia, subida o buscada).
//
// Es un panel del chasis (core/editorShell.js), no un editor aparte: el chasis
// decide si la pestaña existe (`presentation: false` la quita) y este módulo
// pone su HTML y su cableado. Vive fuera porque es lo único del editor que toca
// `a.presentation.*` — un dueño por ajuste (§21b).
import { escapeHtml, $input } from './html.js';
import { on } from './events.js';
import { listSkins, skinPreviewHtml, applySkin } from './skins.js';
import { listBackgrounds, backgroundPreviewHtml, applyBackground, readBackgroundImage, BG_IMAGE_MAX_BYTES } from './backgrounds.js';
import { abrirBuscadorImagenes } from './imageSearchModal.js';
import { creditoTexto } from './imageSearch.js';
import { QUOTAS } from './quotas.js';
import { mensajeDe } from './frontera.js';

/**
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../kernel/contracts/activity.js').ImageCredit} ImageCredit
 */

/** @param {Activity} a */
export function presentationHtml(a) {
  const cs = a.presentation?.skin || 'default';
  const cb = a.presentation?.background || 'none';
  return `
    <div class="mb-4">
      <div id="pres-preview" class="ww-player-frame rounded-3 p-3 d-flex align-items-center gap-2" style="height:72px;max-width:260px;">
        <div class="d-flex gap-1">
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-1)"></span>
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-2)"></span>
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-3)"></span>
          <span style="width:14px;height:14px;border-radius:3px;background:var(--ww-shape-4)"></span>
        </div>
        <span class="small fw-semibold" style="color:var(--ww-fg)">Vista previa</span>
      </div>
    </div>
    <h6 class="mb-2">Skin (colores y sonidos)</h6>
    <div class="d-flex flex-wrap gap-3 mb-4">
      ${listSkins().map(s => `
        <div class="ww-skin-tile skin-pick ${cs === s.name ? 'is-active' : ''}" data-name="${s.name}" role="button">
          ${skinPreviewHtml(s.name)}
          <div class="text-center small mt-1">${escapeHtml(s.description || '')}</div>
        </div>`).join('')}
    </div>
    <h6 class="mb-2">Fondo</h6>
    <div class="d-flex flex-wrap gap-3">
      ${listBackgrounds().map(b => b.name === 'custom'
        ? `<div class="ww-skin-tile bg-pick ${cb === 'custom' ? 'is-active' : ''}" data-name="custom" role="button" style="width:120px">
             ${backgroundPreviewHtml('custom', a.presentation?.backgroundImage || '')}
             <label class="btn btn-sm btn-outline-secondary w-100 mt-1" style="cursor:pointer" title="Máx 800 KB">
               <i class="bi bi-upload"></i> ${a.presentation?.backgroundImage ? 'Cambiar' : 'Subir'}
               <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" id="bg-custom-file" hidden>
             </label>
             <button type="button" class="btn btn-sm btn-outline-secondary w-100 mt-1" id="bg-custom-search">
               <i class="bi bi-search"></i> Buscar
             </button>
           </div>`
        : `<div class="ww-skin-tile bg-pick ${cb === b.name ? 'is-active' : ''}" data-name="${b.name}" role="button" style="width:120px">
             ${backgroundPreviewHtml(b.name)}
             <div class="text-center small text-muted">${escapeHtml(b.description || '')}</div>
           </div>`).join('')}
    </div>
    <div class="text-danger small mt-2" id="bg-custom-err" hidden></div>`;
}

/**
 * @param {Element} root
 * @param {Activity} a
 * @param {(activity: Activity) => void} onChange
 */
export function wirePresentacion(root, a, onChange) {
  // Initialize the mini preview scoped to its own element — never touches the page.
  const prev = /** @type {HTMLElement|null} */ (root.querySelector('#pres-preview'));
  const applyPrevBg = () => {
    const p = /** @type {HTMLElement|null} */ (root.querySelector('#pres-preview'));
    if (p) applyBackground(a.presentation?.background || 'none', p, a.presentation?.backgroundImage);
  };
  if (prev) {
    applySkin(a.presentation?.skin || 'default', prev);
    applyPrevBg();
  }
  on(root, 'click', '.skin-pick', (_, b) => {
    a.presentation = a.presentation || {};
    a.presentation.skin = b.dataset.name; onChange(a);
    root.querySelectorAll('.skin-pick').forEach(x => x.classList.toggle('is-active', x === b));
    const p = /** @type {HTMLElement|null} */ (root.querySelector('#pres-preview'));
    if (p) applySkin(b.dataset.name, p);
  });
  on(root, 'click', '.bg-pick', (_, b) => {
    // The custom tile selects only once an image exists; otherwise its
    // "Subir" button (below) opens the file dialog and selects on success.
    if (b.dataset.name === 'custom' && !a.presentation?.backgroundImage) return;
    a.presentation = a.presentation || {};
    a.presentation.background = b.dataset.name; onChange(a);
    root.querySelectorAll('.bg-pick').forEach(x => x.classList.toggle('is-active', x === b));
    applyPrevBg();
  });
  // Custom background upload — read → validate size → store in the activity.
  // SUBIR y BUSCAR terminan en el mismo sitio: la única diferencia es de
  // dónde sale el data-URL (y que la búsqueda trae además su crédito).
  /** @param {string} dataUrl @param {ImageCredit|null} [atribucion] */
  const ponerFondo = (dataUrl, atribucion = null) => {
    a.presentation = a.presentation || {};
    a.presentation.backgroundImage = dataUrl;
    a.presentation.background = 'custom';
    // El crédito viaja CON el píxel (§24: campo declarado del contenido) o
    // se borra al cambiar de imagen — atribuir la foto anterior es peor que
    // no atribuir.
    if (atribucion) a.presentation.backgroundImageCredit = atribucion;
    else delete a.presentation.backgroundImageCredit;
    onChange(a);
    // Update the custom tile in place (avoid a full repaint that would
    // bounce the user off the Presentación tab).
    const tile = root.querySelector('.bg-pick[data-name="custom"]');
    const pv = /** @type {HTMLElement|null} */ (tile?.querySelector('.ww-bg-preview') ?? null);
    if (pv) { pv.style.background = `center/cover no-repeat url("${dataUrl}")`; pv.innerHTML = ''; }
    root.querySelectorAll('.bg-pick').forEach(x => x.classList.toggle('is-active', x === tile));
    applyPrevBg();
    const errEl = /** @type {HTMLElement|null} */ (root.querySelector('#bg-custom-err'));
    if (errEl) {
      errEl.hidden = !atribucion;
      errEl.className = atribucion ? 'text-muted small mt-2' : 'text-danger small mt-2';
      errEl.textContent = atribucion ? `Imagen de ${creditoTexto(atribucion)}` : '';
    }
  };
  const bgFile = $input('#bg-custom-file', root);
  if (bgFile) bgFile.addEventListener('change', async () => {
    const errEl = /** @type {HTMLElement|null} */ (root.querySelector('#bg-custom-err'));
    try {
      ponerFondo(await readBackgroundImage(bgFile.files?.[0]));
    } catch (err) {
      const msg = mensajeDe(err);
      if (errEl) { errEl.className = 'text-danger small mt-2'; errEl.textContent = msg; errEl.hidden = false; }
      bgFile.value = '';
    }
  });
  root.querySelector('#bg-custom-search')?.addEventListener('click', async () => {
    const elegido = await abrirBuscadorImagenes({
      maxBytes: BG_IMAGE_MAX_BYTES, ladoMax: QUOTAS.canvasImageSide,
      consulta: a.title && a.title !== 'Sin título' ? a.title : '',
    });
    // `atribucionDe()` (core/imageSearch.js) produce siempre un ImageCredit.
    if (elegido) ponerFondo(elegido.url, /** @type {ImageCredit} */ (elegido.atribucion));
  });
}
