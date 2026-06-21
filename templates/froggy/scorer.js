import { scoreQuizSubmission } from '../quiz/scorer.js';

export { scoreQuizSubmission as scoreFroggy };

// How many lily pads to jump forward given answer speed and current streak.
// Returns an integer 1–6.
export function jumpPads(msTaken, timerSecs, streak) {
  const fast = timerSecs > 0
    ? msTaken < timerSecs * 400          // under 40% of timer
    : msTaken < 2500;
  const base  = 1 + (fast ? 1 : 0);
  const mult  = streak >= 10 ? 3
              : streak >= 5  ? 2
              : streak >= 3  ? 1.5
              : 1;
  return Math.max(1, Math.ceil(base * mult));
}

// Label shown on the frog for each streak tier.
export function streakLabel(streak) {
  if (streak >= 10) return '👑';
  if (streak >=  5) return '⚡';
  if (streak >=  3) return '🔥';
  return '';
}
