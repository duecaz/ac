// Registro de errores del cliente — SIN backend externo. El stack es PocketBase
// y no hay tabla de logs remota, así que los errores se guardan en un anillo
// local (localStorage) y se vuelcan a la consola. Best-effort, sin red.
import { lsGet, lsSet } from './ls.js';

const RING_KEY = 'ww.errlog';
const RING_MAX = 30; // conserva los últimos N errores
let lastSent = 0;

export function logClientError({ message, stack, page }) {
  // Throttle: como mucho uno cada 2 s para evitar bucles.
  const now = Date.now();
  if (now - lastSent < 2000) return;
  lastSent = now;
  const entry = {
    message: String(message || '').slice(0, 4000),
    stack: stack ? String(stack).slice(0, 8000) : null,
    page: page || location.pathname,
    url: location.href,
    at: new Date().toISOString(),
  };
  try { console.warn('[client-error]', entry.message, entry.stack || ''); } catch {}
  try {
    const ring = JSON.parse(lsGet(RING_KEY) || '[]');
    ring.push(entry);
    while (ring.length > RING_MAX) ring.shift();
    lsSet(RING_KEY, JSON.stringify(ring));
  } catch { /* localStorage lleno / no disponible: ignora */ }
}

export function installErrorHandlers(page) {
  window.addEventListener('error', (e) => {
    logClientError({ message: e.message, stack: e.error?.stack, page });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    logClientError({ message: r?.message || String(r), stack: r?.stack, page });
  });
}
