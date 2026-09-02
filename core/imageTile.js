// Tile de imagen del editor (imagen opcional por ítem: añadir · buscar · quitar).
// Dueño único de un bloque que question-live/editor.js y wheel/editor.js repetían
// byte por byte (markup Y handlers, prefijo `ql-`/`we-` aparte) — barrido B5,
// 2026-09-02. La puerta «buscar» (regla `imagen-buscable`) va incluida: quien use
// este tile no puede olvidarla.
import { escapeHtml } from './html.js';
import { on } from './events.js';
import { uploadMedia } from './upload.js';
import { abrirBuscadorImagenes } from './imageSearchModal.js';
import { toast, TOAST_NORMAL } from './toast.js';

/**
 * Markup de un tile de imagen (subir · buscar · quitar).
 * @param {string} url  data-URL actual, o falsy si no hay imagen.
 * @param {object} [opts]
 * @param {string} [opts.prefix] clase/id del editor ('ql-', 'we-'…), sin guion final propio.
 * @param {number} [opts.height] alto máx. de la miniatura / del hueco vacío.
 */
export function imageTileHtml(url, { prefix = 'it-', height = 90 } = {}) {
  return `
    <input type="file" accept="image/*" class="d-none ${prefix}img-file">
    ${url
      ? `<img src="${escapeHtml(url)}" class="img-fluid rounded mb-1" style="max-height:${height}px;object-fit:contain">`
      : `<div class="d-flex flex-column align-items-center justify-content-center text-muted bg-body-secondary rounded mb-1" style="height:${height - 10}px"><i class="bi bi-image fs-4"></i><small>Sin imagen</small></div>`}
    <div class="d-flex gap-1 justify-content-center flex-wrap">
      <button type="button" class="btn btn-sm btn-outline-primary ${prefix}img-add"><i class="bi ${url ? 'bi-arrow-repeat' : 'bi-plus-lg'}"></i> ${url ? 'Cambiar' : 'Imagen'}</button>
      <button type="button" class="btn btn-sm btn-outline-primary ${prefix}img-search" title="Buscar una imagen libre"><i class="bi bi-search"></i></button>
      ${url ? `<button type="button" class="btn btn-sm btn-outline-danger ${prefix}img-del"><i class="bi bi-trash"></i></button>` : ''}
    </div>`;
}

/**
 * Cablea los handlers de un tile de imagen por ítem. Cada tile va envuelto por
 * quien pinta el HTML en un contenedor `id="${prefix}img-${i}"`.
 * @param {Element} root
 * @param {object} a  la actividad (se pasa tal cual a `ctx.onChange`).
 * @param {Array} items  `a.content.items` (mutado in-place: cada uno con `.image`/`.imageCredit`).
 * @param {{onChange:Function, repaint:Function}} ctx
 * @param {{prefix?: string, queryField?: string}} [opts]  `queryField` = campo del ítem que sugiere la búsqueda.
 */
export function wireImageTile(root, a, items, ctx, { prefix = 'it-', queryField = 'question' } = {}) {
  const tileSel = `[id^="${prefix}img-"]`;
  const tileIndex = (el) => {
    const t = el.closest(tileSel);
    return t ? +t.id.slice(prefix.length + 3) : -1; // '<prefix>img-'.length
  };
  on(root, 'click', `.${prefix}img-add`, (_, b) => { b.closest(tileSel)?.querySelector(`.${prefix}img-file`)?.click(); });
  on(root, 'click', `.${prefix}img-del`, (_, b) => {
    const i = tileIndex(b);
    if (i < 0) return;
    items[i].image = null;
    ctx.onChange(a); ctx.repaint();
  });
  on(root, 'change', `.${prefix}img-file`, async (e) => {
    const input = e.target;
    const i = tileIndex(input);
    const f = input.files?.[0];
    if (i < 0 || !f) return;
    try {
      items[i].image = await uploadMedia(f);
      delete items[i].imageCredit;   // el crédito se va con su imagen
      ctx.onChange(a); ctx.repaint();
    } catch (err) { toast(err.message, 'danger', TOAST_NORMAL); }
  });
  // Buscar una imagen libre (F6): la misma puerta que en el resto de editores.
  on(root, 'click', `.${prefix}img-search`, async (_, b) => {
    const i = tileIndex(b);
    if (i < 0) return;
    const r = await abrirBuscadorImagenes({ consulta: items[i][queryField] || '' });
    if (!r) return;
    items[i].image = r.url;
    items[i].imageCredit = r.atribucion;
    ctx.onChange(a); ctx.repaint();
  });
}
