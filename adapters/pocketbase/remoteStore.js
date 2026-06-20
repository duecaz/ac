// PocketBase RemoteStore — persiste actividades y resultados en pb.lanube.uno.
// Usa la REST API directamente (sin SDK) para mantener zero-dependency.
//
// IDs: la app usa IDs como 'act_aBcDeFgHiJ' (con underscore) y UUIDs con
// guiones. PocketBase exige IDs ^[a-zA-Z0-9]+$, así que se stripean todos los
// caracteres no-alfanuméricos.
import { PB_URL } from '../../pocketbase.config.js';

function toId(id) { return (id || '').replace(/[^a-zA-Z0-9]/g, ''); }

function fromId(pbId, originalId) {
  // Prefer the original id stored inside the data blob; this is the fallback.
  if (originalId) return originalId;
  // act_XXXXXXXXXX → stored as actXXXXXXXXXX (10 alphanum chars after 'act')
  if (/^act[a-zA-Z0-9]{10}$/.test(pbId)) return `act_${pbId.slice(3)}`;
  // UUID without dashes (32 hex) → restore standard format
  if (/^[0-9a-f]{32}$/i.test(pbId))
    return `${pbId.slice(0,8)}-${pbId.slice(8,12)}-${pbId.slice(12,16)}-${pbId.slice(16,20)}-${pbId.slice(20)}`;
  return pbId;
}

async function pbFetch(path, opts = {}) {
  const { headers: extraHeaders, body, method, ...rest } = opts;
  const headers = {};
  // Only set Content-Type for requests that send a JSON body (POST/PATCH).
  // Sending Content-Type on GET/DELETE causes 400 on PocketBase.
  if (body && typeof body === 'string') headers['Content-Type'] = 'application/json';
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const r = await fetch(`${PB_URL}${path}`, {
    method: method || 'GET',
    headers,
    ...(body !== undefined ? { body } : {}),
    ...rest,
  });
  if (r.status === 204) return null;
  const body = await r.json();
  if (!r.ok) throw Object.assign(
    new Error(body.message || `PocketBase error ${r.status}`),
    { status: r.status, pb: body }
  );
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

    // Uploads a preview blob and returns the public URL, or null on failure.
    // Called by storage.js after a successful save.
    async uploadPreview(id, blob) {
      const pbId = toId(id);
      const fd = new FormData();
      fd.append('preview', blob, 'preview.jpg');
      const r = await fetch(`${PB_URL}/api/collections/activities/records/${pbId}`, {
        method: 'PATCH',
        body: fd,
      });
      if (!r.ok) return null;
      const data = await r.json();
      return data.preview
        ? `${PB_URL}/api/files/activities/${pbId}/${data.preview}`
        : null;
    },

    async deleteActivity(id) {
      try {
        await pbFetch(`/api/collections/activities/records/${toId(id)}`, { method: 'DELETE' });
      } catch (e) {
        if (e.status !== 404) throw e;
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
        id: fromId(row.id, row.data?.id),
        data: row.data,
      }));
    },

    async saveResult(r) {
      await pbFetch('/api/collections/results/records', {
        method: 'POST',
        body: JSON.stringify({
          activity_id: toId(r.activityId || ''),
          session_id:  r.sessionId  || null,
          user_id:     r.userId     || null,
          player_name: r.playerName || null,
          score_auto:  r.scoreAuto  ?? null,
          score_final: r.scoreFinal ?? null,
          max_score:   r.maxScore   ?? null,
          time_used:   r.timeUsed   ?? null,
          overrides:   r.overrides  || [],
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
