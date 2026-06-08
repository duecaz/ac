// Connection state banner. Shows a sticky message when realtime/network drops.
// Subscribed to from transport/live.js subscribeRoom (system events).
//
// Debounced: Supabase Realtime cycles CLOSED → SUBSCRIBED several times a
// minute during normal heartbeats. Without debounce the user sees the
// "Reconectando…" banner blink and a "Conexión recuperada" toast every time
// even with a perfect connection. We hold off showing anything until the
// disconnected state has lasted at least DEBOUNCE_MS.
import { toast } from './toast.js';

const DEBOUNCE_MS = 1500;

let _state = 'connected';
let _displayed = false;        // is the banner currently visible?
let _bannerEl = null;
let _debounceTimer = null;

function ensureBanner() {
  if (_bannerEl) return _bannerEl;
  _bannerEl = document.createElement('div');
  _bannerEl.id = 'ww-conn-banner';
  _bannerEl.className = 'd-none position-fixed start-50 translate-middle-x';
  _bannerEl.style.cssText = 'top:60px;z-index:1040;border-radius:999px;padding:.4rem 1rem;font-size:.875rem;box-shadow:0 4px 12px rgba(0,0,0,.2)';
  document.body.appendChild(_bannerEl);
  return _bannerEl;
}

function showBanner(state) {
  const b = ensureBanner();
  const cfg = {
    reconnecting: { cls: 'bg-warning text-dark', html: '<span class="spinner-border spinner-border-sm me-1"></span> Reconectando…' },
    offline:      { cls: 'bg-danger text-white',  html: '<i class="bi bi-wifi-off"></i> Sin conexión' },
    error:        { cls: 'bg-danger text-white',  html: '<i class="bi bi-exclamation-triangle-fill"></i> Conexión perdida' }
  }[state] || { cls: 'bg-secondary text-white', html: state };
  b.className = `position-fixed start-50 translate-middle-x ${cfg.cls}`;
  b.style.top = '60px'; b.style.zIndex = 1040; b.style.borderRadius = '999px'; b.style.padding = '.4rem 1rem';
  b.innerHTML = cfg.html;
  _displayed = true;
}

function hideBanner() {
  const b = ensureBanner();
  b.className = 'd-none position-fixed start-50 translate-middle-x';
  _displayed = false;
}

export function setConnectionState(state) {
  if (state === 'connected') {
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
    if (_displayed) {
      hideBanner();
      toast('Conexión recuperada.', 'success', 2000);
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
