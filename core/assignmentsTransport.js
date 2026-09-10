// Assignments (tareas) transport facade. Views import these so the backend
// (local | pocketbase) is chosen by getAssignments() and call sites stay
// identical regardless of the active driver.
import { getAssignments } from '../adapters/index.js';

/** @typedef {import('../kernel/contracts/dataPort.js').AssignmentsPort} AssignmentsPort */

/**
 * Pide el método al adaptador ACTIVO y lo llama con los mismos argumentos: la
 * firma que sale es la del contrato, así que quien llama sigue tipado.
 * @template {keyof AssignmentsPort} K
 * @param {K} method
 * @returns {AssignmentsPort[K]}
 */
const call = (method) => /** @type {AssignmentsPort[K]} */ (
  /** @param {unknown[]} args */
  async (...args) => {
    const drv = await getAssignments();
    const fn = /** @type {((...a: unknown[]) => Promise<unknown>)|undefined} */ (drv[method]);
    if (typeof fn !== 'function') throw new Error(`assignments backend no soporta "${method}"`);
    return fn(...args);
  });

export const createAssignment = call('createAssignment');
export const listAssignmentsForActivity = call('listAssignmentsForActivity');
export const findAssignmentByCode = call('findAssignmentByCode');
export const closeAssignment = call('closeAssignment');
export const rotateAssignmentCode = call('rotateAssignmentCode');
export const listAttempts = call('listAttempts');
export const countOwnAttempts = call('countOwnAttempts');
export const recordAttempt = call('recordAttempt');
