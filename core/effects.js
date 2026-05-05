// Visual effects driven by game events. Today: confetti at podium.
// Lazy-loads canvas-confetti from CDN so it never blocks initial paint.
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

async function podiumBurst() {
  const c = await getConfetti();
  if (!c) return;
  // Three staggered bursts for a podium feel.
  c({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  setTimeout(() => c({ particleCount: 80, spread: 100, origin: { x: 0.2, y: 0.7 } }), 250);
  setTimeout(() => c({ particleCount: 80, spread: 100, origin: { x: 0.8, y: 0.7 } }), 500);
}

async function correctBurst() {
  const c = await getConfetti();
  if (!c) return;
  c({ particleCount: 35, spread: 50, origin: { y: 0.7 }, ticks: 80 });
}

onGame(GameEvents.PODIUM, podiumBurst);
onGame(GameEvents.ANSWER_CORRECT, correctBurst);
