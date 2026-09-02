// Toast helper. Replaces window.alert/confirm with non-blocking UI.
// Auto-creates a fixed container at top-right.
import { rid } from './ids.js';

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

// DURACIONES CON NOMBRE — dueño único (barrido B5, 2026-09-02). 48 sitios
// pasaban un literal (4000/5000/6000/7000/8000/9000/10000/2000/2500…) como
// tercer argumento de `toast(`: nueve números para lo mismo, cada uno elegido
// a ojo en su sitio. Se leyó cada mensaje y se colapsó en CUATRO niveles reales
// de urgencia — no hay una quinta lectura que un profe distinga de las otras
// cuatro con la pizarra delante:
//   CORTO   — confirmación de una acción que el propio profe acaba de hacer
//             (ya sabe lo que dice: solo hace falta verlo un instante).
//   NORMAL  — el mensaje más común: un error o aviso de una frase.
//   LARGO   — explica ALGO MÁS que el qué (el porqué, o qué hacer ahora).
//   ERROR   — algo del trabajo del profe puede perderse (cuota llena, sin
//             conexión, datos que no llegaron) — el que más tiempo necesita.
export const TOAST_CORTO = 2500;
export const TOAST_NORMAL = 5000;
export const TOAST_LARGO = 6000;
export const TOAST_ERROR = 9000;

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
    const id = rid('ww-cm-');
    const wrap = document.createElement('div');
    // `white-space: pre-line` en el cuerpo: un mensaje con saltos de línea se LEE
    // como se escribió. El aviso «esto tendrás que completarlo» iba tras un salto
    // doble y el HTML lo colapsaba en un espacio, sepultando justo la frase por
    // la que existe el diálogo. Sigue escapado: se respetan los saltos, no se
    // admite marcado.
    wrap.innerHTML = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">${escapeHtml(title)}</h5></div>
            <div class="modal-body" style="white-space: pre-line">${escapeHtml(message)}</div>
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
    // Move focus out of the modal BEFORE hiding. Bootstrap sets aria-hidden on
    // the modal while a button inside still holds focus, which the browser flags
    // (hiding a focused element from assistive tech). Blurring first avoids it.
    const close = (val) => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      resolve(val);
      m.hide();
    };
    el.querySelector('[data-act=ok]').onclick = () => close(true);
    el.querySelector('[data-act=cancel]').onclick = () => close(false);
    el.addEventListener('hidden.bs.modal', () => el.remove());
    m.show();
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
