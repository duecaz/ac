// Reusable image picker. Renders into a container; on file change uploads
// to the 'media' bucket and calls back with the public URL.
import { uploadMedia } from './upload.js';
import { escapeHtml } from './html.js';

export function renderImagePicker(currentUrl) {
  return `
    <div class="ww-img-picker d-flex align-items-center gap-2">
      <input type="file" accept="image/*" class="form-control form-control-sm ww-img-file" style="max-width:240px">
      ${currentUrl ? `<img src="${escapeHtml(currentUrl)}" class="ww-img-preview" style="height:48px;border-radius:4px">
                      <button type="button" class="btn btn-sm btn-outline-danger ww-img-clear"><i class="bi bi-x"></i></button>`
                   : `<small class="text-muted">Sin imagen</small>`}
    </div>`;
}

export function attachImagePicker(root, containerSel, currentUrl, onChange) {
  const container = (typeof root === 'string' ? document.querySelector(root) : root).querySelector(containerSel);
  if (!container) return;
  const fileInput = container.querySelector('.ww-img-file');
  const clearBtn = container.querySelector('.ww-img-clear');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      fileInput.disabled = true;
      try {
        const url = await uploadMedia(f);
        onChange(url);
        // Re-render in place.
        container.innerHTML = renderImagePicker(url);
        attachImagePicker(root, containerSel, url, onChange);
      } catch (err) {
        alert('Error subiendo imagen: ' + err.message);
        fileInput.disabled = false;
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      onChange(null);
      container.innerHTML = renderImagePicker(null);
      attachImagePicker(root, containerSel, null, onChange);
    });
  }
}
