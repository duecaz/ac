// Ranking de la biblioteca pública (S2). PURO y testeable: sin DOM ni red.
// "Destacadas" = más ❤ likes (de profes logueados), desempate por nº de partidas
// jugadas y, por último, frescura (updatedAt). El cálculo de likes/plays se hace
// aparte (agregación client-side en v1; upgrade a contadores con pb_hooks cuando
// la biblioteca crezca — ver docs/historico/handoff-biblioteca-publica.md).

/**
 * @param {Array<{id:string, updatedAt?:string}>} activities  actividades públicas
 * @param {Record<string, number>} [likesById]  id → nº de likes
 * @param {Record<string, number>} [playsById]  id → nº de partidas
 * @param {number} [limit]  cuántas devolver (0 = todas)
 * @returns {Array} las actividades ordenadas por score, recortadas a `limit`
 */
export function computeFeatured(activities, likesById = {}, playsById = {}, limit = 8) {
  const scored = (activities || []).map(a => ({
    a,
    likes: likesById[a.id] || 0,
    plays: playsById[a.id] || 0,
  }));
  scored.sort((x, y) =>
    (y.likes - x.likes) ||
    (y.plays - x.plays) ||
    String(y.a.updatedAt || '').localeCompare(String(x.a.updatedAt || '')));
  const out = scored.map(x => x.a);
  return limit > 0 ? out.slice(0, limit) : out;
}

// Cuenta likes por actividad a partir de las filas {activity, user} de PB.
export function tallyLikes(rows) {
  const by = {};
  for (const r of rows || []) { const id = r.activity; if (id) by[id] = (by[id] || 0) + 1; }
  return by;
}
