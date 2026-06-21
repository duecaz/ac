// Scorer for word search VS rounds.
// `item` is the word string (from content.words[itemIndex]).
// `value` is the found word string or null (skipped / timed out).
export function scoreWordsearch({ value, item, msTaken, activity }) {
  if (!value) return { correct: false, points: 0 };
  const found  = String(value).toUpperCase().replace(/\s+/g, '');
  const target = String(item  || '').toUpperCase().replace(/\s+/g, '');
  const correct = found === target;
  if (!correct) return { correct: false, points: 0 };

  const ppc = activity.scoring?.pointsPerCorrect || 10;
  let points = ppc;

  // Kahoot-style speed bonus
  if (activity.scoring?.mode === 'kahoot') {
    const timerMs = (activity.live?.questionTimer || 30) * 1000;
    const ratio   = Math.max(0, 1 - msTaken / timerMs);
    points += Math.round(ppc * ratio);
  }

  // Length bonus: longer words worth more (+50% for words >6 letters)
  if (target.length > 6) points = Math.round(points * 1.5);

  return { correct: true, points };
}
