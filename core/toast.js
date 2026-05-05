// Toast helper. Replaces window.alert/confirm with non-blocking UI.
// Auto-creates a fixed container at top-right.

let _container = null;

function container() {
  if (_container) return _container;
  _container = document.createElement('div');
  _container.className = 'toast-container position-fixed top-0 end-0 p-3';
  _container.style.zIndex = 9999;
  document.body.appendChild(_container);
  return _container;
}

const COLORS = { success: 'success', danger: 'danger', warning: 'warning', info: 'primary' };
const ICONS = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-octagon-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };

export function toast(message, kind = 'success', timeoutMs = 3000) {
  const c = container();
  const el = document.createElement('div');
  el.className = `toast align-items-center text-bg-${COLORS[kind] || 'primary'} border-0 show`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body"><i class="bi ${ICONS[kind] || ''} me-2"></i>${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
    </div>`;
  c.appendChild(el);
  const dismiss = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 200); };
  el.querySelector('.btn-close').onclick = dismiss;
  if (timeoutMs > 0) setTimeout(dismiss, timeoutMs);
  return dismiss;
}

// Promise-based confirm. Resolves true on accept, false on cancel.
export function confirmModal(message, { title = 'Confirmar', okText = 'Aceptar', cancelText = 'Cancelar', danger = false } = {}) {
  return new Promise(resolve => {
    const id = 'ww-cm-' + Math.random().toString(36).slice(2, 8);
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${escapeHtml(title)}</h5></div>
            <div class="modal-body">${escapeHtml(message)}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-act="cancel">${escapeHtml(cancelText)}</button>
              <button type="button" class="btn btn-${danger ? 'danger' : 'primary'}" data-act="ok">${escapeHtml(okText)}</button>
            </div>
          </div>
        </div>
      </div>`;
    const el = wrap.firstElementChild;
    document.body.appendChild(el);
    const m = new bootstrap.Modal(el);
    el.querySelector('[data-act=ok]').onclick = () => { resolve(true); m.hide(); };
    el.querySelector('[data-act=cancel]').onclick = () => { resolve(false); m.hide(); };
    el.addEventListener('hidden.bs.modal', () => el.remove());
    m.show();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
