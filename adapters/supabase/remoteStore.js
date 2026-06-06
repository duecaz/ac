// Supabase RemoteStore — the existing remote persistence logic moved out of
// core/storage.js, now behind the swappable RemoteStore contract. All
// Supabase-specific concerns (auth, author stamping, the activities table,
// author/visibility filtering) live here, nowhere else.
import { getClient } from '../../core/supabase.js';

export function createSupabaseRemoteStore() {
  return {
    async saveActivity(a) {
      const sb = await getClient();
      const { data: { user } } = await sb.auth.getUser();
      const authorId = a.author?.id || user?.id || null;
      // Stamp author info into the JSONB so it round-trips.
      if (authorId && !a.author?.id) a.author = { ...(a.author || {}), id: authorId, signedAt: new Date().toISOString() };
      const { error } = await sb.from('activities').upsert({
        id: a.id, data: a,
        visibility: a.visibility,
        author_id: authorId,
        tags: a.tags || [],
        language: a.language || 'es',
      });
      if (error) throw error;
    },

    async deleteActivity(id) {
      const sb = await getClient();
      const { error } = await sb.from('activities').delete().eq('id', id);
      if (error) throw error;
    },

    async getActivity(id) {
      const sb = await getClient();
      const { data, error } = await sb.from('activities').select('data, visibility').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return data.data || null;
    },

    async listActivities() {
      const sb = await getClient();
      const { data: { user } } = await sb.auth.getUser();
      let q = sb.from('activities').select('id, data, updated_at').order('updated_at', { ascending: false });
      // Owned rows + legacy null-author rows. Public/explore is fetched elsewhere.
      if (user) q = q.or(`author_id.eq.${user.id},author_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(row => ({ id: row.id, data: row.data }));
    },
  };
}

export default createSupabaseRemoteStore;
