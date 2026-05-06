// Connection state banner. Shows a sticky message when realtime/network drops.
// Subscribed to from transport/live.js subscribeRoom (system events).
// On transition back to 'connected', flashes a brief green toast.
import { toast } from './toast.js';

let _state = 'connected';
let _bannerEl = null;

function ensureBanner() {
  if (_bannerEl) return _bannerEl;
  _bannerEl = document.createElement('div');
  _bannerEl.id = 'ww-conn-banner';
  _bannerEl.className = 'd-none position-fixed start-50 translate-middle-x';
  _bannerEl.style.cssText = 'top:60px;z-index:1040;border-radius:999px;padding:.4rem 1rem;font-size:.875rem;box-shadow:0 4px 12px rgba(0,0,0,.2)';
  document.body.appendChild(_bannerEl);
  return _bannerEl;
}

export function setConnectionState(state) {
  const prev = _state;
  _state = state;
  const b = ensureBanner();
  if (state === 'connected') {
    b.className = 'd-none position-fixed start-50 translate-middle-x';
    if (prev !== 'connected') toast('Conexión recuperada.', 'success', 2000);
    return;
  }
  const cfg = {
    reconnecting: { cls: 'bg-warning text-dark', html: '<span class="spinner-border spinner-border-sm me-1"></span> Reconectando…' },
    offline:      { cls: 'bg-danger text-white',  html: '<i class="bi bi-wifi-off"></i> Sin conexión' },
    error:        { cls: 'bg-danger text-white',  html: '<i class="bi bi-exclamation-triangle-fill"></i> Conexión perdida' }
  }[state] || { cls: 'bg-secondary text-white', html: state };
  b.className = `position-fixed start-50 translate-middle-x ${cfg.cls}`;
  b.style.top = '60px'; b.style.zIndex = 1040; b.style.borderRadius = '999px'; b.style.padding = '.4rem 1rem';
  b.innerHTML = cfg.html;
}

export function getConnectionState() { return _state; }

// Wire window online/offline.
window.addEventListener('offline', () => setConnectionState('offline'));
window.addEventListener('online', () => setConnectionState('connected'));
