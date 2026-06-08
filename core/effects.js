// Visual effects driven by game events. Today: confetti at podium and a
// quick burst on a correct answer. Lazy-loads canvas-confetti from CDN so
// it never blocks initial paint.
//
// Each effect has a cooldown so re-emissions of the same game event in
// quick succession (host_seen_at heartbeats, realtime UPDATE coalescing,
// etc.) don't stack into a strobe.
import { GameEvents, onGame } from './gameEvents.js';

let _confetti = null;
async function getConfetti() {
  if (_confetti) return _confetti;
  try {
    const m = await import('https://esm.sh/canvas-confetti@1.9.3');
    _confetti = m.default || m.confetti || m;
    return _confetti;
  } catch (e) {
    console.warn('[effects] confetti not available:', e.message);
    return null;
  }
}

let _lastPodium = 0;
let _lastCorrect = 0;
const PODIUM_COOLDOWN = 5000;
const CORRECT_COOLDOWN = 800;

async function podiumBurst() {
  const now = Date.now();
  if (now - _lastPodium < PODIUM_COOLDOWN) return;
  _lastPodium = now;
  const c = await getConfetti();
  if (!c) return;
  // Single bright burst from the bottom-center. Looks celebratory without
  // looking like the page is glitching.
  c({ particleCount: 200, spread: 100, startVelocity: 45, origin: { y: 0.6 } });
}

async function correctBurst() {
  const now = Date.now();
  if (now - _lastCorrect < CORRECT_COOLDOWN) return;
  _lastCorrect = now;
  const c = await getConfetti();
  if (!c) return;
  c({ particleCount: 30, spread: 50, origin: { y: 0.7 }, ticks: 60 });
}

onGame(GameEvents.PODIUM, podiumBurst);
onGame(GameEvents.ANSWER_CORRECT, correctBurst);

// Manual trigger for views that drive feedback themselves (e.g. VS, which
// opts out of the global ANSWER_CORRECT burst and fires this only when the
// teacher enables "confeti por pregunta").
export function answerConfetti() { return correctBurst(); }
