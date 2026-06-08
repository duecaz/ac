// Room operations: create via Edge Function, lookup, fetch.
import { getClient, ensureAuth } from '../../core/supabase.js';
import { SUPABASE_URL } from '../../supabase.config.js';

export async function createRoom(activity) {
  await ensureAuth();
  const sb = await getClient();
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/create-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ activity_id: activity.id, activity, rules: activity.rules || {} })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'create-session failed');
  return data; // { id, code }
}

export async function findRoomByCode(code) {
  const sb = await getClient();
  const { data, error } = await sb.from('sessions').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSession(id) {
  const sb = await getClient();
  const { data, error } = await sb.from('sessions').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
