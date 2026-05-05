// Upload to the public 'media' bucket. Returns the public URL.
import { getClient, ensureAuth } from './supabase.js';

export async function uploadMedia(file) {
  if (!file) throw new Error('no file');
  if (file.size > 5 * 1024 * 1024) throw new Error('Archivo > 5 MB');
  await ensureAuth();
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
