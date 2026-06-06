// Supabase assignments driver — wraps the existing transport module behind the
// same surface as the local driver, so the facade can switch backends.
import * as a from '../../core/transport/assignments.js';

export function createSupabaseAssignments() {
  return {
    createAssignment: a.createAssignment,
    listAssignmentsForActivity: a.listAssignmentsForActivity,
    findAssignmentByCode: a.findAssignmentByCode,
    closeAssignment: a.closeAssignment,
    rotateAssignmentCode: a.rotateAssignmentCode,
    listAttempts: a.listAttempts,
    countOwnAttempts: a.countOwnAttempts,
    recordAttempt: a.recordAttempt,
  };
}

export default createSupabaseAssignments;
