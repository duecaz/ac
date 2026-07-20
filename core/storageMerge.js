// Pure merge logic for storage.sync — the offline-first "last-write-wins"
// reconciliation between the local cache and the backend. Extracted so the rule
// that decides which copy wins is unit-testable without localStorage.

/**
 * Merge backend rows into a local activity map. Remote wins when it is newer or
 * equal by updatedAt (ties favour remote so a synced edit settles), and brand
 * new remote rows are added. Local-only rows are preserved.
 *
 * EXCEPCIÓN (P1-4): una entrada local con `_unsynced` (edición aún NO subida) es
 * intocable. Su `updatedAt` puede ser MENOR por reloj desincronizado entre
 * dispositivos, pero es la copia buena; dejar que el remoto la pisara por LWW de
 * reloj de pared borraba la edición en silencio. Se conserva hasta que suba (y
 * el flag se limpie), momento en que futuros sync la mergean con normalidad.
 *
 * @param {Record<string, Object>} localMap   id → activity (the local cache)
 * @param {{id:string, data:Object}[]} remoteRows  backend rows
 * @param {(data:Object)=>Object} migrate      normaliser applied to remote data
 * @returns {Record<string, Object>} a NEW merged map (inputs untouched)
 */
export function mergeRemote(localMap, remoteRows, migrate) {
  const map = { ...(localMap || {}) };
  for (const row of remoteRows || []) {
    const remote = migrate(row.data || {});
    const local = map[row.id];
    if (local?._unsynced) continue; // no pisar una edición local pendiente de subir
    if (!local || (remote.updatedAt || '') >= (local.updatedAt || '')) {
      map[row.id] = remote;
    }
  }
  return map;
}
