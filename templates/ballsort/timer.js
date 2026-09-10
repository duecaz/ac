// Lightweight wall-clock timer for elapsed gameplay time.
// clock.now() (core/clock.js), no performance.now(): el reloj inyectable del
// proyecto → el tiempo de juego es congelable en tests como el resto.
import { clock } from '../../core/clock.js';

/**
 * @returns {{start: () => void, stop: () => number, reset: () => void, elapsedMs: () => number}}
 */
export function createTimer() {
  /** @type {number|null} */
  let startedAt = null;
  /** @type {number|null} */
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

// El formato «m:ss» es UNO en todo el repo (core/timings.js). Se conserva el
// nombre para no tocar a los llamadores de la plantilla.
export { mmss as formatMs } from '../../core/timings.js';
