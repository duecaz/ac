// Backend-aware identity. Supabase fue retirado, así que no hay SDK ni login
// anónimo remoto: en cualquier backend usamos el anon id persistido
// (localStorage), de modo que SOLO/ASYNC/LIVE funcionan también offline.
import { getAnonId } from './state.js';

export async function ensureIdentity() {
  try { return { id: getAnonId() }; } catch { return { id: 'local-anon' }; }
}
