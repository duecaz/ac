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
import { getAuthUserId } from '../../core/auth.js';
import { signedFetch, pbJson } from '../../core/pbHttp.js';
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

// El wrapper JSON (firma + parseo seguro + error { status, pb }) vive UNA vez
// en core/pbHttp.js. Alias local para no tocar los ~20 llamadores.
const pbFetch = (path, opts) => pbJson(path, opts);

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

    // ── BIBLIOTECA PÚBLICA (ley de datos §21) ────────────────────────────────
    // Portada, Explorar y el perfil de autor pedían las actividades públicas con
    // su PROPIO `fetch` a la colección, cada uno con su filtro y su normalización
    // (tres copias que ya habían divergido en el escapado de la comilla simple).
    // Aquí está el único lector: `opts` = { language, owner, limit }.
    //
    // Devuelve la fila NORMALIZADA: `{ id, data, language, tags, updated_at }`.
    // `data` es la actividad tal cual la guardó el profe; `id` prioriza el del
    // contenido (el que usan los enlaces #/play/:id) con respaldo al de PB.
    //
    // Sin `sort=-updated` A PROPÓSITO: la colección puede no tener el campo PB
    // `updated` (según cómo se creara) y ese sort rompía la consulta entera. Se
    // ordena aquí por el `updatedAt` que vive DENTRO del contenido, que siempre
    // está — así ninguna vista tiene que acordarse.
    async listPublicActivities({ language = '', owner = '', limit = 120 } = {}) {
      const parts = [`visibility='public'`];
      if (language) parts.push(`language='${pbEscape(language)}'`);
      if (owner) parts.push(`owner='${pbEscape(owner)}'`);
      const rec = await pbFetch(`/api/collections/activities/records`
        + `?filter=${pbFilterParam(parts.join(' && '))}&perPage=${Number(limit) || 120}`);
      const rows = (rec?.items || []).map(row => ({
        id: row.data?.id || row.id,
        data: row.data || {},
        language: row.language || 'es',
        tags: row.tags || [],
        updated_at: row.data?.updatedAt || row.updated || '',
      }));
      rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return rows;
    },

    /** Cuántas actividades tiene cada dueño (panel de Profesores). Solo lee el
     *  campo `owner`: ni contenido ni títulos salen del servidor para esto. */
    async countActivitiesByOwner() {
      const rec = await pbFetch('/api/collections/activities/records?perPage=500&fields=owner');
      const out = new Map();
      for (const row of rec?.items || []) {
        const o = row.owner || '';
        if (o) out.set(o, (out.get(o) || 0) + 1);
      }
      return out;
    },

    /** DIAGNÓSTICO de `#/admin`: la lista con el TAMAÑO del payload medido. Vive
     *  aquí porque `core/dbDiag.js` lo hacía con su propio fetch a la colección
     *  (ley de datos §21); necesita el texto crudo para poder pesarlo, así que no
     *  puede pasar por pbFetch (que ya lo parsea). */
    async probeActivitiesPayload(fields = 'id,title,template,content,tags,visibility,language,updatedAt') {
      const r = await signedFetch(`${PB_URL}/api/collections/activities/records?perPage=500&fields=${encodeURIComponent(fields)}`);
      const txt = await r.text();
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let items = [];
      try { items = JSON.parse(txt).items || []; } catch { items = []; }
      return { items, bytes: txt.length };
    },

    // Idempotente por `qid` (deuda D): la cola de results reintenta tras un ACK
    // perdido, y sin clave el reintento duplicaba la fila. El índice único
    // parcial (qid != '') convierte el reintento en un 400 que aquí significa
    // "ya estaba guardado" → éxito, no error.
    async saveResult(r) {
      try {
        await postResult(r);
      } catch (e) {
        if (e?.status === 400 && r._qid) {
          const dup = await pbFetch(`/api/collections/results/records?filter=${pbFilterParam(`qid='${pbEscape(r._qid)}'`)}&perPage=1&fields=id`).catch(() => null);
          if (dup?.items?.length) return;   // el primer envío SÍ llegó
        }
        throw e;
      }

      function postResult(r) {
        return pbFetch('/api/collections/results/records', {
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
          qid:         r._qid || '',
        }),
        });
      }
    },

    async listResults(activityId) {
      const where = activityId ? `filter=${pbFilterParam(`activity_id='${pbEscape(toId(activityId))}'`)}&` : '';
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
