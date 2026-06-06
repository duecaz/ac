// Pure merge logic for storage.sync — the offline-first "last-write-wins"
// reconciliation between the local cache and the backend. Extracted so the rule
// that decides which copy wins is unit-testable without localStorage.

/**
 * Merge backend rows into a local activity map. Remote wins when it is newer or
 * equal by updatedAt (ties favour remote so a synced edit settles), and brand
 * new remote rows are added. Local-only rows are preserved.
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
    if (!local || (remote.updatedAt || '') >= (local.updatedAt || '')) {
      map[row.id] = remote;
    }
  }
  return map;
}
