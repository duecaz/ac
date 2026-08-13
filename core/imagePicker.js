// Reusable compact image picker. Renders a preview (or placeholder) plus the
// two puertas — SUBIR desde el dispositivo y BUSCAR una imagen libre — con su
// input de archivo oculto. Convierte a data-URL inline (sin storage externo) y
// avisa al caller con `(url, atribucion)`. Se guarda dentro del JSON de la
// actividad (máx 200 KB).
//
// La atribución es el SEGUNDO argumento y no un adorno: si la imagen sale del
// buscador, viene de un catálogo Creative Commons y el crédito es la condición
// de uso (ver core/imageSearch.js). Al subir un archivo propio llega `null` y
// el caller borra el crédito anterior — atribuir la imagen que ya no está sería
// peor que no atribuir.
import { uploadMedia } from './upload.js';
import { escapeHtml } from './html.js';
import { toast } from './toast.js';
import { abrirBuscadorImagenes } from './imageSearchModal.js';
import { creditoTexto } from './imageSearch.js';

export function renderImagePicker(currentUrl, credito = null) {
  return `
    <div class="ww-img-picker text-center">
      <input type="file" accept="image/*" class="d-none ww-img-file">
      ${currentUrl
        ? `<img src="${escapeHtml(currentUrl)}" class="ww-img-preview img-fluid rounded mb-2" style="max-height:120px;object-fit:contain">`
        : `<div class="ww-img-empty d-flex flex-column align-items-center justify-content-center text-muted bg-body-secondary rounded mb-2" style="height:96px">
             <i class="bi bi-image fs-3"></i><small>Sin imagen</small>
           </div>`}
      ${credito ? `<small class="d-block text-muted text-truncate mb-1" style="font-size:.72rem" title="${escapeHtml(creditoTexto(credito))}">${escapeHtml(creditoTexto(credito))}</small>` : ''}
      <div class="d-flex gap-1 justify-content-center flex-wrap">
        <button type="button" class="btn btn-sm btn-outline-primary ww-img-change">
          <i class="bi ${currentUrl ? 'bi-arrow-repeat' : 'bi-plus-lg'}"></i> ${currentUrl ? 'Cambiar' : 'Subir'}
        </button>
        <button type="button" class="btn btn-sm btn-outline-primary ww-img-search">
          <i class="bi bi-search"></i> Buscar
        </button>
        ${currentUrl ? `<button type="button" class="btn btn-sm btn-outline-danger ww-img-clear"><i class="bi bi-trash"></i> Eliminar</button>` : ''}
      </div>
    </div>`;
}

// opts.maxBytes — optional client-side size cap (e.g. 200*1024). When set, files
// over the limit are rejected before upload with a friendly toast.
// opts.credito — atribución ya guardada, para pintarla bajo la imagen.
// opts.consulta — qué proponer en el buscador (el título de la pregunta).
export function attachImagePicker(root, containerSel, currentUrl, onChange, opts = {}) {
  const el = typeof root === 'string' ? document.querySelector(root) : root;
  if (!el) return;
  const container = el.querySelector(containerSel);
  if (!container) return;
  const fileInput = container.querySelector('.ww-img-file');
  const changeBtn = container.querySelector('.ww-img-change');
  const searchBtn = container.querySelector('.ww-img-search');
  const clearBtn = container.querySelector('.ww-img-clear');

  const rerender = (url, credito) => {
    container.innerHTML = renderImagePicker(url, credito);
    attachImagePicker(root, containerSel, url, onChange, { ...opts, credito });
  };
  const elegida = (url, atribucion) => { onChange(url, atribucion); rerender(url, atribucion); };

  if (changeBtn && fileInput) changeBtn.addEventListener('click', () => fileInput.click());
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (opts.maxBytes && f.size > opts.maxBytes) {
        toast(`Imagen demasiado grande (máx. ${Math.round(opts.maxBytes / 1024)} KB)`, 'danger', 5000);
        e.target.value = '';
        return;
      }
      if (changeBtn) changeBtn.disabled = true;
      try {
        elegida(await uploadMedia(f), null);
      } catch (err) {
        toast('Error subiendo imagen: ' + err.message, 'danger', 5000);
        if (changeBtn) changeBtn.disabled = false;
      }
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener('click', async () => {
      const r = await abrirBuscadorImagenes({ maxBytes: opts.maxBytes, consulta: opts.consulta || '' });
      if (r) elegida(r.url, r.atribucion);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => elegida(null, null));
  }
}
