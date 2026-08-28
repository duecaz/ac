// Registro de errores del cliente — SIN backend externo. El stack es PocketBase
// y no hay tabla de logs remota, así que los errores se guardan en un anillo
// local (localStorage) y se vuelcan a la consola. Best-effort, sin red.
import { lsGet, lsSet } from './ls.js';
import { toast } from './toast.js';
import { clock } from './clock.js';

const RING_KEY = 'ww.errlog';
const RING_MAX = 30; // conserva los últimos N errores
let lastSent = 0;
let storageWarned = false;

/** Lee el anillo de errores recientes (más nuevo al final). Para el panel admin. */
export function recentErrors() {
  try { return JSON.parse(lsGet(RING_KEY) || '[]'); } catch { return []; }
}

/** Vacía el anillo de errores. */
export function clearErrors() { lsSet(RING_KEY, '[]'); }

function logClientError({ message, stack, page }) {
  // Throttle: como mucho uno cada 2 s para evitar bucles.
  const now = clock.now();
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
  // Aviso al usuario cuando localStorage se llena (emitido por core/ls.js).
  // Una sola vez por sesión para no insistir; el dato no se guardó.
  window.addEventListener('ww:storage-full', () => {
    logClientError({ message: 'localStorage lleno: no se pudo guardar', page });
    if (storageWarned) return;
    storageWarned = true;
    try {
      toast('Almacenamiento del navegador lleno. Exporta tus actividades a JSON y borra la caché para liberar espacio.', 'warning', 8000);
    } catch { /* sin DOM aún: el aviso queda en el log */ }
  });
  // R6 — FALLAR EN SILENCIO ESTÁ PROHIBIDO. `core/results.js` emite este evento
  // cuando la cola de resultados se llena y descarta los más antiguos; se emitía
  // desde el primer día y NADIE lo escuchaba (auditoría v1.51.397), así que el
  // alumno perdía resultados exactamente en silencio — lo que el evento existía
  // para evitar. Ahora se dice, y queda en el registro para el reporte.
  window.addEventListener('ww:results-dropped', (e) => {
    const n = e?.detail?.dropped || 0;
    logClientError({ message: `cola de resultados llena: ${n} resultado(s) descartado(s)`, page });
    try {
      toast(`Se han perdido ${n} resultado(s) sin enviar: el dispositivo lleva demasiado tiempo sin conexión. Conéctate para que los pendientes suban.`, 'warning', 9000);
    } catch { /* sin DOM: queda en el log */ }
  });
}
