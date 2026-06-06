// Pure rules for async assignments (tareas) — no DOM, no backend. Extracted from
// views/studentTask.js so the gating (closed / past-due / attempts) is testable
// and identical across drivers.

/** Public codes are matched upper-cased and trimmed. */
export function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

/** Has the due date passed? `now` may be ms or a Date/ISO. No due date → never. */
export function isPastDue(dueAt, now = Date.now()) {
  if (!dueAt) return false;
  const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
  return new Date(dueAt).getTime() < nowMs;
}

/** Attempts still available (maxAttempts defaults to 1). Never negative. */
export function attemptsRemaining(maxAttempts, taken) {
  const max = maxAttempts ?? 1;
  return Math.max(0, max - (taken || 0));
}

/**
 * Can this student start an attempt? Mirrors views/studentTask.js order:
 * not found → closed → past due → no attempts left.
 * @returns {{ allowed: boolean, reason: 'notFound'|'closed'|'pastDue'|'noAttemptsLeft'|null }}
 */
export function assignmentGate(assignment, taken, now = Date.now()) {
  if (!assignment) return { allowed: false, reason: 'notFound' };
  if (assignment.status === 'closed') return { allowed: false, reason: 'closed' };
  if (isPastDue(assignment.due_at, now)) return { allowed: false, reason: 'pastDue' };
  if (attemptsRemaining(assignment.max_attempts, taken) <= 0) return { allowed: false, reason: 'noAttemptsLeft' };
  return { allowed: true, reason: null };
}
