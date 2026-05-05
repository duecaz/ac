// Logs uncaught errors to public.client_errors via REST. Best-effort, fire-and-forget.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.config.js';

let lastSent = 0;

export function logClientError({ message, stack, page }) {
  // Throttle: at most one per 2s to avoid loops.
  const now = Date.now();
  if (now - lastSent < 2000) return;
  lastSent = now;
  try {
    fetch(`${SUPABASE_URL}/rest/v1/client_errors`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        message: String(message || '').slice(0, 4000),
        stack: stack ? String(stack).slice(0, 8000) : null,
        page: page || location.pathname,
        url: location.href,
        user_agent: navigator.userAgent
      })
    }).catch(() => {});
  } catch {}
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
