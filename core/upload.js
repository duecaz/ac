// Upload to the public 'media' bucket. Returns the public URL.
// Validates MIME and extension against a whitelist.
import { getClient, ensureAuth } from './supabase.js';

const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm'
};

export async function uploadMedia(file) {
  if (!file) throw new Error('no file');
  if (file.size > 5 * 1024 * 1024) throw new Error('Archivo > 5 MB');
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error(`Tipo no permitido: ${file.type || 'desconocido'}`);
  await ensureAuth();
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  // Path: <userId>/<uuid>.<safeExt>. RLS on storage.objects requires the
  // first path segment to equal auth.uid().
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
