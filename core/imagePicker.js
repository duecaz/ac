// Reusable compact image picker. Renders a preview (or placeholder) plus two
// buttons — Cambiar/Añadir and Eliminar — with a hidden file input. On file
// change it uploads to the storage bucket and calls back with the public URL.
import { uploadMedia } from './upload.js';
import { escapeHtml } from './html.js';
import { toast } from './toast.js';

export function renderImagePicker(currentUrl) {
  return `
    <div class="ww-img-picker text-center">
      <input type="file" accept="image/*" class="d-none ww-img-file">
      ${currentUrl
        ? `<img src="${escapeHtml(currentUrl)}" class="ww-img-preview img-fluid rounded mb-2" style="max-height:120px;object-fit:contain">`
        : `<div class="ww-img-empty d-flex flex-column align-items-center justify-content-center text-muted bg-body-secondary rounded mb-2" style="height:96px">
             <i class="bi bi-image fs-3"></i><small>Sin imagen</small>
           </div>`}
      <div class="d-flex gap-1 justify-content-center flex-wrap">
        <button type="button" class="btn btn-sm btn-outline-primary ww-img-change">
          <i class="bi ${currentUrl ? 'bi-arrow-repeat' : 'bi-plus-lg'}"></i> ${currentUrl ? 'Cambiar' : 'Añadir imagen'}
        </button>
        ${currentUrl ? `<button type="button" class="btn btn-sm btn-outline-danger ww-img-clear"><i class="bi bi-trash"></i> Eliminar</button>` : ''}
      </div>
    </div>`;
}

export function attachImagePicker(root, containerSel, currentUrl, onChange) {
  const container = (typeof root === 'string' ? document.querySelector(root) : root).querySelector(containerSel);
  if (!container) return;
  const fileInput = container.querySelector('.ww-img-file');
  const changeBtn = container.querySelector('.ww-img-change');
  const clearBtn = container.querySelector('.ww-img-clear');

  const rerender = (url) => {
    container.innerHTML = renderImagePicker(url);
    attachImagePicker(root, containerSel, url, onChange);
  };

  if (changeBtn && fileInput) changeBtn.addEventListener('click', () => fileInput.click());
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (changeBtn) changeBtn.disabled = true;
      try {
        const url = await uploadMedia(f);
        onChange(url);
        rerender(url);
      } catch (err) {
        toast('Error subiendo imagen: ' + err.message, 'danger', 5000);
        if (changeBtn) changeBtn.disabled = false;
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      onChange(null);
      rerender(null);
    });
  }
}
