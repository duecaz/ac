// Supabase ha sido retirado. Toda la app usa PocketBase.
// Este stub mantiene la interfaz para no romper imports existentes.
import { getAnonId } from './state.js';

export async function getClient() { return null; }

export async function ensureAuth() {
  return { id: getAnonId() };
}
