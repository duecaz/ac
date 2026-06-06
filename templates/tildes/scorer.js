// Pure per-passage scoring for the session formats (VS / Equipos-auto / Solo).
// A whole passage is ONE round: correct iff the set of positions the student
// accented exactly matches the answer key (positions with a 'tilde' mark).
// `value` is an array of character positions the student marked.
export function scoreTildesSubmission({ value, item, activity }) {
  const expected = new Set((item?.marks || []).filter(m => m.kind === 'tilde').map(m => m.pos));
  const got = new Set(Array.isArray(value) ? value.map(Number) : []);
  const correct = expected.size === got.size && [...expected].every(p => got.has(p));
  const scoring = activity?.scoring || {};
  const points = correct ? (item?.points || scoring.pointsPerCorrect || 1) : 0;
  return { correct, points };
}
