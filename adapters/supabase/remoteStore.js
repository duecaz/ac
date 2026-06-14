// Supabase RemoteStore — persistencia remota tras el contrato RemoteStore.
// BANCO COMPARTIDO: las actividades se guardan SIN dueño (author_id = null) y
// listActivities trae lo que la RLS permite ver (público/sin dueño). No hay
// stamping de autor ni filtrado por identidad aquí.
import { getClient } from '../../core/supabase.js';

export function createSupabaseRemoteStore() {
  return {
    async saveActivity(a) {
      const sb = await getClient();
      // BANCO COMPARTIDO: las actividades NO tienen dueño (author_id = null), así
      // cualquiera las ve/edita por URL y NO dependen de la identidad anónima del
      // navegador (sobreviven a limpiar la caché). visibility al menos 'unlisted'
      // para que sean compartibles.
      a.author = null;
      const { error } = await sb.from('activities').upsert({
        id: a.id, data: a,
        visibility: a.visibility === 'public' ? 'public' : 'unlisted',
        author_id: null,
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
      // BANCO COMPARTIDO: traemos todo lo que la RLS permite ver (público/unlisted
      // + sin dueño + propio). Sin filtrar por identidad → tras limpiar la caché,
      // sync() repuebla el banco y las actividades reaparecen.
      const { data, error } = await sb.from('activities')
        .select('id, data, updated_at').order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({ id: row.id, data: row.data }));
    },

    // Results table. Column mapping lives here (was inline in core/results.js).
    async saveResult(r) {
      const sb = await getClient();
      const { error } = await sb.from('results').insert({
        activity_id: r.activityId || null,
        session_id: r.sessionId || null,
        user_id: r.userId || null,
        player_name: r.playerName || null,
        score_auto: r.scoreAuto ?? null,
        score_final: r.scoreFinal ?? null,
        max_score: r.maxScore ?? null,
        time_used: r.timeUsed ?? null,
        overrides: r.overrides || [],
      });
      if (error) throw error;
    },
  };
}

export default createSupabaseRemoteStore;
