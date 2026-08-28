// MANTENIMIENTO — expulsar a un jugador, purgar salas viejas (§25 CAPACIDAD) y
// los pings no-op del puerto (aquí no hace falta tabla de presencia: el estado
// vive en la propia fila de PocketBase).
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';

/**
 * Fábrica de la sección de mantenimiento. `deps`:
 *   - pbFetch: cliente HTTP con reintentos.
 *   - COLL, ANS, PLR, CLM: nombres de las cuatro colecciones en vivo.
 *   - playersReady(): ¿existe la colección `live_players`?
 *   - load(sessionId)/saveState(sessionId, engine): sección rooms (rama blob heredada).
 */
export function createMantenimientoSection({ pbFetch, COLL, ANS, PLR, CLM, playersReady, load, saveState }) {
  return {
    async kickPlayer(sessionId, playerId) {
      if (await playersReady()) {
        await pbFetch(`/api/collections/${PLR}/records/${playerId}`, { method: 'DELETE' }).catch(() => {});
        return;
      }
      const { engine } = await load(sessionId);
      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
      await saveState(sessionId, engine);
    },

    // ── §25 CAPACIDAD — retención de salas ──────────────────────────────────
    // Una sala en vivo dura 20 minutos y sus filas viven para siempre: sala,
    // respuestas, jugadores y credenciales. Pasada la retención son basura (el
    // informe que importa ya está en `results`). El DUEÑO de estas colecciones
    // es este adaptador (§21), así que la purga vive aquí y el panel solo la
    // PIDE. `dryRun` cuenta sin borrar: el profe ve qué se va antes de decidir.
    // No toca `results` ni `assignment_attempts` — el registro del profe sobre
    // sus alumnos no caduca por nosotros.
    async purgeOldLive(cutoffIso, { dryRun = true } = {}) {
      const out = { cutoff: cutoffIso, dryRun, sessions: 0, answers: 0, players: 0, claims: 0, errors: [] };
      const older = pbFilterParam(`created < '${pbEscape(cutoffIso)}'`);
      // Las salas primero: sus ids son el filtro de lo que cuelga.
      let sessions = [];
      try {
        const res = await pbFetch(`/api/collections/${COLL}/records?filter=${older}&perPage=200&fields=id`);
        sessions = res?.items || [];
      } catch (e) { out.errors.push(`salas: ${e.message}`); return out; }
      out.sessions = sessions.length;
      if (!sessions.length) return out;

      // Hijas de esas salas (una pasada por sala: los filtros con 200 ids
      // encadenados con || revientan el largo de la URL).
      const childCounts = { [ANS]: 'answers', [PLR]: 'players', [CLM]: 'claims' };
      for (const s of sessions) {
        const f = pbFilterParam(`session='${pbEscape(s.id)}'`);
        for (const [coll, key] of Object.entries(childCounts)) {
          try {
            const res = await pbFetch(`/api/collections/${coll}/records?filter=${f}&perPage=500&fields=id`);
            const rows = res?.items || [];
            out[key] += rows.length;
            if (!dryRun) {
              for (const r of rows) {
                await pbFetch(`/api/collections/${coll}/records/${r.id}`, { method: 'DELETE' })
                  .catch(e => out.errors.push(`${coll}/${r.id}: ${e.message}`));
              }
            }
          } catch (e) { out.errors.push(`${coll}: ${e.message}`); }
        }
        if (!dryRun) {
          await pbFetch(`/api/collections/${COLL}/records/${s.id}`, { method: 'DELETE' })
            .catch(e => out.errors.push(`sala ${s.id}: ${e.message}`));
        }
      }
      return out;
    },

    async pingPresence() { /* state is in PB record, no presence table needed */ },
    async pingHost() { /* no-op */ },
  };
}
