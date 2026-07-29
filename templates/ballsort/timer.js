// Lightweight wall-clock timer for elapsed gameplay time.
// clock.now() (core/clock.js), no performance.now(): el reloj inyectable del
// proyecto → el tiempo de juego es congelable en tests como el resto.
import { clock } from '../../core/clock.js';

export function createTimer() {
  let startedAt = null;
  let stoppedAt = null;
  return {
    start() { startedAt = clock.now(); stoppedAt = null; },
    stop()  { stoppedAt = clock.now(); return this.elapsedMs(); },
    reset() { startedAt = null; stoppedAt = null; },
    elapsedMs() {
      if (startedAt == null) return 0;
      const end = stoppedAt ?? clock.now();
      return Math.max(0, Math.round(end - startedAt));
    }
  };
}

export function formatMs(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
