// QUÉ ES UN EQUIPO — dueño único (antes `teamsSeed.js`, que solo sembraba).
//
// kernel/session/memory.js (Memoria) y teamsMachine.js (Equipos por turnos) son
// DOS bucles distintos sobre los MISMOS equipos, y cada uno reimplementaba letra
// por letra la siembra, «de quién es el turno», la rotación y la clasificación
// final (barridos B5 · 2026-09-02 y T5 · 2026-09-12). La siembra tenía una sola
// diferencia: Equipos añade `members: []` para el roster de la sala en vivo.

/**
 * UN MIEMBRO del roster de Equipos en vivo (solo para mostrarlo).
 * @typedef {Object} TeamMember
 * @property {string} id
 * @property {string} [userId]
 * @property {string} name
 */

/**
 * UN EQUIPO. `members` solo existe cuando se pide el roster (`withMembers`).
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name
 * @property {number} score
 * @property {TeamMember[]} [members]
 */

/**
 * LO MÍNIMO DEL ESTADO para saber de quién es el turno: los dos bucles guardan
 * los equipos y un índice dentro de ellos.
 * @template {Team} T
 * @typedef {Object} EstadoPorTurnos
 * @property {T[]} teams
 * @property {number} turn
 */

/**
 * Construye el array inicial de equipos a partir de `opts.teams`:
 * - array de nombres → un equipo por nombre
 * - número → esa cantidad de equipos, nombrados «Equipo N»
 * - nada → dos equipos por defecto
 * @param {{teams?: string[]|number}} opts
 * @param {{withMembers?: boolean}} [flags]  `withMembers`: añade `members: []` (roster de Equipos en vivo).
 * @returns {Team[]}
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

/**
 * DE QUIÉN ES EL TURNO. `null` si no hay equipos (estado hidratado a medias):
 * quien llame decide qué hacer, pero nadie se cae leyendo `.id` de nada.
 * @template {Team} T
 * @param {EstadoPorTurnos<T>} state
 * @returns {T|null}
 */
export const equipoActivo = (state) => state.teams[state.turn] || null;

/**
 * PASA EL TURNO al siguiente equipo (circular).
 * @param {EstadoPorTurnos<Team>} state
 */
export const pasarTurno = (state) => {
  state.turn = (state.turn + 1) % state.teams.length;
};

/**
 * LA CLASIFICACIÓN de los equipos, de más a menos puntos. No muta el array
 * original (los dos bucles lo pintan mientras se sigue jugando).
 * @param {Team[]} teams
 * @returns {{rank: number, name: string, score: number, id: string}[]}
 */
export const clasificacion = (teams) =>
  [...teams].sort((a, b) => b.score - a.score)
    .map((t, i) => ({ rank: i + 1, name: t.name, score: t.score, id: t.id }));
