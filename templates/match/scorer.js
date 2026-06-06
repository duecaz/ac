// Per-pair matching score for the session formats (VS / Equipos-auto): each
// pair becomes a "what matches X?" round; correct iff the chosen value equals
// the pair's right side. Pure.
export function scoreMatchSubmission({ value, item, activity }) {
  const correct = String(value) === String(item?.right ?? '');
  const scoring = activity?.scoring || {};
  return { correct, points: correct ? (item?.points || scoring.pointsPerCorrect || 1) : 0 };
}
