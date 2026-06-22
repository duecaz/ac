// PocketBase RemoteStore — persiste actividades y resultados en pb.lanube.uno.
// Usa la REST API directamente (sin SDK) para mantener zero-dependency.
//
// IDs: la app usa IDs como 'act_aBcDeFgHiJ' (con underscore) y UUIDs con
// guiones. PocketBase v0.23+ exige ^[a-zA-Z0-9]+$ y mínimo 15 chars.
// Se stripean los chars inválidos y se rellena con '0' hasta 15 si es más corto.
import { PB_URL } from '../../pocketbase.config.js';

function toId(id) {
  const s = (id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return s.length >= 15 ? s : s.padEnd(15, '0');
}

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
  const { headers: extraHeaders, body: reqBody, method, ...rest } = opts;
  const headers = {};
  // Only set Content-Type for requests that send a JSON body (POST/PATCH).
  // Sending Content-Type on GET/DELETE causes 400 on PocketBase.
  if (reqBody && typeof reqBody === 'string') headers['Content-Type'] = 'application/json';
  if (extraHeaders) Object.assign(headers, extraHeaders);
  const r = await fetch(`${PB_URL}${path}`, {
    method: method || 'GET',
    headers,
    ...(reqBody !== undefined ? { body: reqBody } : {}),
    ...rest,
  });
  if (r.status === 204) return null;
  // PocketBase always speaks JSON. If the body fails to parse, a gateway /
  // proxy / network-policy page intercepted the request — surface it as a
  // PocketBase error so callers handle every failure uniformly (instead of an
  // opaque SyntaxError from r.json()).
  const text = await r.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch {
      throw Object.assign(
        new Error(`PocketBase error ${r.status}: respuesta no-JSON`),
        { status: r.status, pb: { raw: text.slice(0, 200) } }
      );
    }
  }
  if (!r.ok) throw Object.assign(
    new Error(body?.message || `PocketBase error ${r.status}`),
    { status: r.status, pb: body }
  );
  return body;
}

// Track which PocketBase IDs are known to exist so we can skip the
// PATCH→404→POST dance after the first successful sync.
const SYNCED_KEY = 'ww.pb.synced';
function getSynced() {
  try { return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || '[]')); }
  catch { return new Set(); }
}
function markSynced(pbId) {
  try {
    const s = getSynced(); s.add(pbId);
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...s]));
  } catch { }
}
function unmarkSynced(pbId) {
  try {
    const s = getSynced(); s.delete(pbId);
    localStorage.setItem(SYNCED_KEY, JSON.stringify([...s]));
  } catch { }
}

export function createPocketbaseRemoteStore() {
  return {
    async saveActivity(a) {
      const pbId = toId(a.id);
      // Strip the internal sync flag; everything else is the activity content.
      const { _unsynced, ...cleanData } = a;
      const payload = {
        id: pbId,
        data: cleanData,
        visibility: a.visibility === 'public' ? 'public' : 'unlisted',
        tags: a.tags || [],
        language: a.language || 'es',
      };

      if (getSynced().has(pbId)) {
        // Record is known to exist in PB → PATCH directly, no 404 in console.
        try {
          await pbFetch(`/api/collections/activities/records/${pbId}`, {
            method: 'PATCH', body: JSON.stringify(payload),
          });
        } catch (e) {
          if (e.status !== 404) throw e;
          // Was deleted from PB externally — recreate.
          unmarkSynced(pbId);
          await pbFetch('/api/collections/activities/records', {
            method: 'POST', body: JSON.stringify(payload),
          });
          markSynced(pbId);
        }
      } else {
        // Unknown state: try PATCH first; 404 means it doesn't exist yet → POST.
        try {
          await pbFetch(`/api/collections/activities/records/${pbId}`, {
            method: 'PATCH', body: JSON.stringify(payload),
          });
        } catch (e) {
          if (e.status !== 404) throw e;
          await pbFetch('/api/collections/activities/records', {
            method: 'POST', body: JSON.stringify(payload),
          });
        }
        markSynced(pbId);
      }
    },

    async deleteActivity(id) {
      const pbId = toId(id);
      try {
        await pbFetch(`/api/collections/activities/records/${pbId}`, { method: 'DELETE' });
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      unmarkSynced(pbId);
    },

    async getActivity(id) {
      try {
        const pbId = toId(id);
        const rec = await pbFetch(`/api/collections/activities/records/${pbId}`);
        if (!rec) return null;
        markSynced(pbId);
        return rec.data ?? null;
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },

    async listActivities() {
      const rec = await pbFetch('/api/collections/activities/records?perPage=200');
      return (rec?.items || []).map(row => {
        markSynced(row.id);
        return { id: fromId(row.id, row.data?.id), data: row.data };
      });
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
      const where = activityId ? `filter=(activity_id="${toId(activityId)}")&` : '';
      // Orden por `created` (autodate de PocketBase). Si la colección se creó por
      // API en PB ≥0.23 puede no tener ese campo → el sort da error; en ese caso
      // reintentamos sin orden para no romper la lectura.
      try {
        const rec = await pbFetch(`/api/collections/results/records?${where}sort=-created&perPage=200`);
        return rec?.items || [];
      } catch (e) {
        const rec = await pbFetch(`/api/collections/results/records?${where}perPage=200`);
        return rec?.items || [];
      }
    },
  };
}

export default createPocketbaseRemoteStore;
