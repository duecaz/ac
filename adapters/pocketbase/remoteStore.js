// PocketBase RemoteStore — persiste actividades y resultados en pb.lanube.com.
// Usa la REST API directamente (sin SDK) para mantener zero-dependency.
//
// IDs: la app usa UUIDs con guiones (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
// PocketBase exige IDs alfanuméricos sin guiones, así que los strips al escribir
// y los restaura al leer (32 hex chars → UUID estándar).
import { PB_URL } from '../../pocketbase.config.js';

function toId(uuid) { return (uuid || '').replace(/-/g, ''); }

function fromId(pbId) {
  if (/^[0-9a-f]{32}$/i.test(pbId)) {
    return `${pbId.slice(0,8)}-${pbId.slice(8,12)}-${pbId.slice(12,16)}-${pbId.slice(16,20)}-${pbId.slice(20)}`;
  }
  return pbId;
}

async function pbFetch(path, opts = {}) {
  const { headers: extraHeaders, ...rest } = opts;
  const r = await fetch(`${PB_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    ...rest,
  });
  if (r.status === 204) return null;
  const body = await r.json();
  if (!r.ok) throw Object.assign(new Error(body.message || `PocketBase error ${r.status}`), { status: r.status, pb: body });
  return body;
}

export function createPocketbaseRemoteStore() {
  return {
    async saveActivity(a) {
      const pbId = toId(a.id);
      const payload = {
        id: pbId,
        data: a,
        visibility: a.visibility === 'public' ? 'public' : 'unlisted',
        tags: a.tags || [],
        language: a.language || 'es',
      };
      // Upsert: intenta actualizar; si no existe (404) crea.
      try {
        await pbFetch(`/api/collections/activities/records/${pbId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } catch (e) {
        if (e.status !== 404) throw e;
        await pbFetch('/api/collections/activities/records', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
    },

    async deleteActivity(id) {
      try {
        await pbFetch(`/api/collections/activities/records/${toId(id)}`, { method: 'DELETE' });
      } catch (e) {
        if (e.status !== 404) throw e; // ya borrado → ok
      }
    },

    async getActivity(id) {
      try {
        const rec = await pbFetch(`/api/collections/activities/records/${toId(id)}`);
        return rec?.data ?? null;
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },

    async listActivities() {
      const rec = await pbFetch('/api/collections/activities/records?sort=-updated&perPage=200');
      return (rec?.items || []).map(row => ({
        id: row.data?.id || fromId(row.id),
        data: row.data,
      }));
    },

    async saveResult(r) {
      await pbFetch('/api/collections/results/records', {
        method: 'POST',
        body: JSON.stringify({
          activity_id:  toId(r.activityId || ''),
          session_id:   r.sessionId  || null,
          user_id:      r.userId     || null,
          player_name:  r.playerName || null,
          score_auto:   r.scoreAuto  ?? null,
          score_final:  r.scoreFinal ?? null,
          max_score:    r.maxScore   ?? null,
          time_used:    r.timeUsed   ?? null,
          overrides:    r.overrides  || [],
        }),
      });
    },

    async listResults(activityId) {
      const filter = activityId
        ? `?filter=(activity_id="${toId(activityId)}")&sort=-created`
        : '?sort=-created&perPage=200';
      const rec = await pbFetch(`/api/collections/results/records${filter}`);
      return rec?.items || [];
    },
  };
}

export default createPocketbaseRemoteStore;
