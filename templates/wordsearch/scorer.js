// Scorer for word search VS rounds.
// The player searches the WHOLE board freely (like solo), so a submission is
// correct if `value` is ANY word from the activity's list — not only the word
// at the current cursor. The round only submits words not already found, so each
// correct find advances exactly one segment.
const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

export function scoreWordsearch({ value, item, msTaken, activity }) {
  if (!value) return { correct: false, points: 0 };
  const found = norm(value);
  const words = (activity.content?.words || []).map(norm);
  if (!words.includes(found)) return { correct: false, points: 0 };

  const ppc = activity.scoring?.pointsPerCorrect || 10;
  let points = ppc;

  // Kahoot-style speed bonus
  if (activity.scoring?.mode === 'kahoot') {
    const timerMs = (activity.live?.questionTimer || 30) * 1000;
    const ratio   = Math.max(0, 1 - msTaken / timerMs);
    points += Math.round(ppc * ratio);
  }

  // Length bonus: longer words worth more (+50% for words >6 letters)
  if (found.length > 6) points = Math.round(points * 1.5);

  return { correct: true, points };
}
