// ENLACE EXCLUSIVO 1:1 — dueño único.
//
// diagram/player.js y match/player.js reimplementaban el mismo `setLink`
// (Map `a → b`, exclusivo por ambos lados) letra por letra (barrido B5,
// 2026-09-02). Aquí solo vive el estado del Map; el refresco visual y el
// resto del drag siguen en cada player.

/**
 * Enlaza `aId` con `bId` de forma EXCLUSIVA: si `aId` ya tenía otro destino, o
 * si algún otro `a` apuntaba a `bId`, esos enlaces se rompen antes de crear el
 * nuevo. Muta `map` in-place.
 * @param {Map<string,string>} map
 * @param {string} aId
 * @param {string} bId
 */
export function setExclusiveLink(map, aId, bId) {
  map.delete(aId);
  for (const [a, b] of [...map]) if (b === bId) map.delete(a);
  map.set(aId, bId);
}
