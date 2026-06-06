// Result persistence. Goes through the selected backend adapter (DataPort /
// RemoteStore) — NOT Supabase directly — so results are captured on any backend
// (local, supabase, pocketbase) and survive offline. Fail-soft: a backend error
// never interrupts gameplay.
import { getRemoteStore } from '../adapters/index.js';

export async function saveResult(r) {
  try {
    const rs = await getRemoteStore();
    await rs.saveResult(r);
  } catch (e) {
    console.warn('[results] save failed:', e.message);
  }
}
