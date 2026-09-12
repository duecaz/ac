// EL PLAN DEL ANFITRIÓN, APLICADO AL ESTADO — dueño único.
//
// `core/livePhases.js` DECIDE qué debe pasar (`planTransition`: un parche, un
// settle, el fin, o que la acción no vale). Llevarlo al estado era el mismo
// bloque tecleado dos veces (liveMachine.js y teamsMachine.js), y lo único que
// de verdad cambia entre las dos máquinas es la rama `settle` —una puntúa, la
// otra distingue juez de automático— y la rotación de turno de Equipos.
//
// Por eso aquí vive SOLO la parte común: `invalid` lanza, `end` cierra la sala,
// `patch` mueve fase/estado/cursor. El `settle` NO se toca: cada máquina se
// queda su rama, que es la que tiene sentido propio.
import { PHASES } from '../../core/livePhases.js';

/**
 * @typedef {import('../contracts/session.js').LivePhase} LivePhase
 * @typedef {import('../contracts/session.js').RoomPatch} RoomPatch
 * @typedef {import('../contracts/session.js').RoomStatus} RoomStatus
 * @typedef {import('../contracts/session.js').TransitionPlan} TransitionPlan
 */

/**
 * LO MÍNIMO DEL ESTADO que este aplicador toca: las tres cosas que mueve un
 * plan. Lo cumplen `LiveState` y `TeamsState` sin saber la una de la otra.
 * @typedef {Object} EstadoConducible
 * @property {RoomStatus} status
 * @property {LivePhase} phase
 * @property {number} currentItem
 */

/**
 * Aplica al estado la parte COMÚN de un plan del anfitrión.
 * @param {EstadoConducible} state
 * @param {TransitionPlan} plan
 * @returns {boolean} true si el plan quedó aplicado; false = es un `settle` y lo
 *   resuelve la máquina (cada una tiene la suya).
 * @throws {Error} si el plan es `invalid` (la acción no valía en esta fase).
 */
export function aplicarPlan(state, plan) {
  if (plan.type === 'invalid') throw new Error(plan.reason);
  if (plan.type === 'end') { state.status = 'ended'; state.phase = PHASES.ENDED; return true; }
  if (plan.type === 'settle') return false;
  const pa = /** @type {RoomPatch} */ (plan.patch);
  if (pa.status) state.status = pa.status;
  if (pa.phase) state.phase = pa.phase;
  if (pa.current_item !== undefined) state.currentItem = pa.current_item;
  return true;
}
