// SEMILLA DE EQUIPOS — dueño único.
//
// kernel/session/memory.js (Memoria) y teamsMachine.js (Equipos por turnos)
// reimplementaban la MISMA `seedTeams` letra por letra, con una única
// diferencia: teamsMachine añade `members: []` para el roster de la sala en
// vivo (barrido B5, 2026-09-02).

/**
 * Construye el array inicial de equipos a partir de `opts.teams`:
 * - array de nombres → un equipo por nombre
 * - número → esa cantidad de equipos, nombrados «Equipo N»
 * - nada → dos equipos por defecto
 * @param {{teams?: string[]|number}} opts
 * @param {{withMembers?: boolean}} [flags]  `withMembers`: añade `members: []` (roster de Equipos en vivo).
 */
export function seedTeams(opts, { withMembers = false } = {}) {
  const names = Array.isArray(opts.teams) ? opts.teams
    : (typeof opts.teams === 'number' ? Array.from({ length: opts.teams }, (_, i) => `Equipo ${i + 1}`)
      : ['Equipo 1', 'Equipo 2']);
  return names.map((name, i) => ({
    id: 't' + (i + 1), name, score: 0,
    ...(withMembers ? { members: [] } : {}),
  }));
}
