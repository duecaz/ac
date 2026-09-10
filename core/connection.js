// Connection state banner. Shows a sticky message when realtime/network drops.
// Driven by adapters/pocketbase/realtime.js subscribeRoom: 'reconnecting' on
// SSE backoff, 'connected' on a successful PB_CONNECT handshake. Also reacts to
// the window online/offline events directly.
//
// Debounced: a flaky SSE can cycle error → reconnect several times a minute
// during normal heartbeats. Without debounce the user sees the "Reconectando…"
// banner blink and a "Conexión recuperada" toast every time even with a fine
// connection. We hold off showing anything until the disconnected state has
// lasted at least DEBOUNCE_MS.
import { toast, TOAST_CORTO } from './toast.js';

const DEBOUNCE_MS = 1500;

let _state = 'connected';
let _displayed = false;        // is the banner currently visible?
/** @type {HTMLElement|null} */
let _bannerEl = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let _debounceTimer = null;

/** Los estados que pintan aviso; cualquier otro cae al genérico.
 *  @typedef {'connected'|'reconnecting'|'offline'|'error'} EstadoConexion */

/** @returns {HTMLElement} */
function ensureBanner() {
  if (!_bannerEl) {
    document.body.insertAdjacentHTML('beforeend',
      '<div id="ww-conn-banner" class="d-none position-fixed start-50 translate-middle-x" '
      + 'style="top:60px;z-index:1040;border-radius:999px;padding:.4rem 1rem;font-size:.875rem;box-shadow:0 4px 12px rgba(0,0,0,.2)"></div>');
    _bannerEl = /** @type {HTMLElement} */ (document.getElementById('ww-conn-banner'));
  }
  return _bannerEl;
}

/** @param {string} state */
function showBanner(state) {
  const b = ensureBanner();
  /** @type {Record<string, {cls: string, html: string}>} */
  const CFG = {
    reconnecting: { cls: 'bg-warning text-dark', html: '<span class="spinner-border spinner-border-sm me-1"></span> Reconectando…' },
    offline:      { cls: 'bg-danger text-white',  html: '<i class="bi bi-wifi-off"></i> Sin conexión' },
    error:        { cls: 'bg-danger text-white',  html: '<i class="bi bi-exclamation-triangle-fill"></i> Conexión perdida' }
  };
  const cfg = CFG[state] || { cls: 'bg-secondary text-white', html: state };
  b.className = `position-fixed start-50 translate-middle-x ${cfg.cls}`;
  b.style.top = '60px'; b.style.zIndex = '1040'; b.style.borderRadius = '999px'; b.style.padding = '.4rem 1rem';
  b.innerHTML = cfg.html;
  _displayed = true;
}

function hideBanner() {
  const b = ensureBanner();
  b.className = 'd-none position-fixed start-50 translate-middle-x';
  _displayed = false;
}

/** @param {EstadoConexion|string} state */
export function setConnectionState(state) {
  if (state === 'connected') {
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
    if (_displayed) {
      hideBanner();
      toast('Conexión recuperada.', 'success', TOAST_CORTO);
    }
    _state = 'connected';
    return;
  }
  _state = state;
  if (_displayed) {
    showBanner(state);
  } else if (!_debounceTimer) {
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      if (_state !== 'connected') showBanner(_state);
    }, DEBOUNCE_MS);
  }
}

// Guarded so the module is importable outside a browser (tests, non-DOM).
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => setConnectionState('offline'));
  window.addEventListener('online', () => setConnectionState('connected'));
}
