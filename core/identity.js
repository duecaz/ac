// Backend-aware identity. On the local backend there is no Supabase: we just use
// the persisted anon id (localStorage) and never load the SDK, so SOLO/ASYNC/LIVE
// work fully offline. On supabase we sign in anonymously as before.
import { backendName } from '../adapters/index.js';
import { getAnonId } from './state.js';

export async function ensureIdentity() {
  if (backendName() === 'local') {
    try { return { id: getAnonId() }; } catch { return { id: 'local-anon' }; }
  }
  const { ensureAuth } = await import('./supabase.js');
  return ensureAuth();
}
