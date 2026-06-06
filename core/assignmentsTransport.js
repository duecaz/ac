// Assignments (tareas) transport facade. Views import these instead of
// core/transport/assignments.js directly, so the backend (local | supabase) is
// chosen by getAssignments() and call sites stay identical.
import { getAssignments } from '../adapters/index.js';

const call = (method) => async (...args) => {
  const drv = await getAssignments();
  if (typeof drv[method] !== 'function') throw new Error(`assignments backend no soporta "${method}"`);
  return drv[method](...args);
};

export const createAssignment = call('createAssignment');
export const listAssignmentsForActivity = call('listAssignmentsForActivity');
export const findAssignmentByCode = call('findAssignmentByCode');
export const closeAssignment = call('closeAssignment');
export const rotateAssignmentCode = call('rotateAssignmentCode');
export const listAttempts = call('listAttempts');
export const countOwnAttempts = call('countOwnAttempts');
export const recordAttempt = call('recordAttempt');
