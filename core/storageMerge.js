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
 * TOMBSTONES (P1-1): un id borrado localmente cuyo DELETE remoto aún no confirmó
 * NO debe reintroducirse desde el remoto. `tombstones` (Set de ids) bloquea esa
 * resurrección; sin ello, borrar offline / con blip / cerrando la pestaña dejaba
 * la fila viva en PB y el siguiente sync la re-añadía.
 *
 * LO ÚNICO que este merge MIRA de una fila: el sello del LWW y la marca de
 * «aún sin subir». La firma entra ANCHA (`object`) porque el normalizador lo
 * pone el llamador (`core/storage.js`), y aquí se estrecha a lo que se lee.
 * @typedef {{_unsynced?: boolean, updatedAt?: string}} FilaFusionable
 *
 * @param {Record<string, object>} localMap   id → activity (the local cache)
 * @param {{id:string, data:object}[]} remoteRows  backend rows
 * @param {(data:object)=>object} migrate      normaliser applied to remote data
 * @param {Set<string>|null} [tombstones]      ids borrados pendientes de confirmar
 * @returns {Record<string, object>} a NEW merged map (inputs untouched)
 */
export function mergeRemote(localMap, remoteRows, migrate, tombstones = null) {
  const map = { ...(localMap || {}) };
  for (const row of remoteRows || []) {
    if (tombstones && tombstones.has(row.id)) continue; // borrado pendiente: no resucitar
    const remote = /** @type {FilaFusionable} */ (migrate(row.data || {}));
    const local = /** @type {FilaFusionable|undefined} */ (map[row.id]);
    if (local?._unsynced) continue; // no pisar una edición local pendiente de subir
    if (!local || (remote.updatedAt || '') >= (local.updatedAt || '')) {
      map[row.id] = remote;
    }
  }
  return map;
}
