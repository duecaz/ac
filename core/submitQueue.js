// Offline-resilient submit queue for the student. If submitAnswer fails
// (network), enqueue and flush on online or on next attempt. Persisted in
// localStorage so a refresh during a flaky moment still recovers.
import { submitAnswer as transportSubmit } from './transport/live.js';

const KEY = 'ww.submitQueue';

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function save(q) { localStorage.setItem(KEY, JSON.stringify(q)); }

export async function submit(sessionId, playerId, itemIndex, value, msTaken) {
  // Try direct first.
  try {
    await transportSubmit(sessionId, playerId, itemIndex, value, msTaken);
    return { queued: false };
  } catch (e) {
    // Enqueue and retry later.
    const q = load();
    q.push({ sessionId, playerId, itemIndex, value, msTaken, ts: Date.now(), err: e.message });
    save(q);
    return { queued: true, error: e.message };
  }
}

export async function flush() {
  const q = load();
  if (!q.length) return 0;
  let ok = 0;
  const remaining = [];
  for (const item of q) {
    try {
      await transportSubmit(item.sessionId, item.playerId, item.itemIndex, item.value, item.msTaken);
      ok++;
    } catch {
      remaining.push(item);
    }
  }
  save(remaining);
  return ok;
}

export function pendingCount() { return load().length; }

window.addEventListener('online', () => { flush().catch(() => {}); });
