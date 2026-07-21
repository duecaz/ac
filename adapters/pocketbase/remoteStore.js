// PocketBase RemoteStore — persiste actividades y resultados en pb.lanube.uno.
// Usa la REST API directamente (sin SDK) para mantener zero-dependency.
//
// IDs: la app usa IDs como 'act_aBcDeFgHiJ' (con underscore) y UUIDs con
// guiones. PocketBase v0.23+ exige ^[a-zA-Z0-9]+$ y EXACTAMENTE 15 chars (ni
// más ni menos). Se stripean los chars inválidos, se recorta si sobra y se
// rellena con '0' si falta. El id original siempre se guarda dentro de `data`,
// así que recortar no impide reconstruirlo al leer (fromId prefiere data.id).
import { PB_URL } from '../../pocketbase.config.js';
import { lsGet, lsSet } from '../../core/ls.js';
import { getAuthToken, getAuthUserId } from '../../core/auth.js';
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';

function toId(id) {
  const s = (id || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return s.length > 15 ? s.slice(0, 15) : s.padEnd(15, '0');
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
  // Firma la petición con el token del profe si hay sesión (Fase 0 seguridad PB).
  // Con las reglas AÚN públicas esto es un no-op funcional; posiciona las reglas
  // por-autor. Si el token está expirado y PB responde 401/403, reintentamos SIN
  // auth (fallback anónimo) para no romper guardadas que hoy funcionan. Cuando el
  // usuario aplique las reglas por-autor, el reintento anónimo también fallará y el
  // error se propaga (el profe verá que debe volver a entrar) — que es lo correcto.
  const doFetch = async (withAuth) => {
    const headers = {};
    // Only set Content-Type for requests that send a JSON body (POST/PATCH).
    // Sending Content-Type on GET/DELETE causes 400 on PocketBase.
    if (reqBody && typeof reqBody === 'string') headers['Content-Type'] = 'application/json';
    const token = withAuth ? getAuthToken() : null;
    if (token) headers['Authorization'] = token;
    if (extraHeaders) Object.assign(headers, extraHeaders);
    return fetch(`${PB_URL}${path}`, {
      method: method || 'GET',
      headers,
      ...(reqBody !== undefined ? { body: reqBody } : {}),
      ...rest,
    });
  };
  let r = await doFetch(true);
  if ((r.status === 401 || r.status === 403) && getAuthToken()) {
    r = await doFetch(false); // fallback anónimo (reglas aún públicas)
  }
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
//
// Es un CACHE de optimizacion, no estado critico: perder una entrada solo cuesta
// un PATCH→404→POST extra. Por eso: (a) va por ls.js (un fallo de cuota emite
// `ww:storage-full` en vez de perderse en silencio), y (b) tiene TOPE — antes
// crecia sin limite con cada actividad jamas sincronizada (riesgo de cuota real
// a largo plazo). Re-add al final + slice(-MAX) = LRU barato.
const SYNCED_KEY = 'ww.pb.synced';
const SYNCED_MAX = 500;
function getSynced() {
  try { return new Set(JSON.parse(lsGet(SYNCED_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveSynced(s) {
  lsSet(SYNCED_KEY, JSON.stringify([...s].slice(-SYNCED_MAX)));
}
function markSynced(pbId) {
  const s = getSynced(); s.delete(pbId); s.add(pbId);
  saveSynced(s);
}
function unmarkSynced(pbId) {
  const s = getSynced(); s.delete(pbId);
  saveSynced(s);
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
      // Marca de propietario (Fase 1 seguridad PB): el id del profe autenticado.
      // Vacío si no hay sesión — la regla por-autor es tolerante con owner='' para
      // no bloquear actividades legadas (ver docs/handoff-seguridad-pb.md).
      const owner = getAuthUserId();
      if (owner) payload.owner = owner;

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

    // ownerId (opcional): filtra por owner en el servidor → "Mis actividades"
    // no arrastra la biblioteca pública entera (S1.4). Sin él, trae todas (uso legado).
    async listActivities(ownerId = null) {
      const filter = ownerId ? `&filter=${pbFilterParam(`owner='${pbEscape(ownerId)}'`)}` : '';
      const rec = await pbFetch(`/api/collections/activities/records?perPage=200${filter}`);
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
