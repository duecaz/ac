// CRONÓMETRO POR FECHA LÍMITE — el reloj compartido de los modos con deadline
// (Live: pregunta, auto-avance, carrera).
//
// Antes cada sitio se lo montaba: `setInterval(…, 250)` + `Date.now()` + limpieza
// a mano, repetido en hostLive (pregunta, cuenta atrás de auto-avance, carrera) y
// en studentLive. Cinco relojes distintos para la misma idea, ninguno testeable
// con tiempo congelado (usaban Date.now() en vez de core/clock.js).
//
// Es el hermano de `createCountdown` (core/soloTimer.js): aquél cuenta una
// DURACIÓN desde ahora (el temporizador por ítem del modo Individual); éste
// cuenta hasta un INSTANTE que manda el servidor, que es lo que necesita Live
// para que host y alumnos vean lo mismo.
import { serverNow } from './serverNow.js';
import { mmss } from './timings.js';

/**
 * @param {object}   o
 * @param {number|string|Date} o.deadline  instante final (ms, ISO o Date).
 * @param {number}  [o.totalMs]   ventana completa, para el porcentaje del tick.
 * @param {number}  [o.everyMs=250]  cada cuánto avisa.
 * @param {(t:{remainMs:number,remainSec:number,pct:number})=>void} [o.onTick]
 * @param {()=>void} [o.onExpire]  una sola vez, al llegar a 0.
 * @param {()=>boolean} [o.while]  si devuelve false, el ticker se detiene solo
 *        (p.ej. "mientras la fase siga siendo 'question'"): evita que un reloj
 *        zombi repinte encima de la pantalla siguiente.
 * @param {Function} [o.setIntervalFn] @param {Function} [o.clearIntervalFn]
 *        scheduler inyectable → tests deterministas (y ctx.setInterval de las
 *        vistas, que ya limpia al cambiar de ruta).
 * @returns {{ stop: () => void }}
 */
export function startDeadlineTicker({
  deadline, totalMs = 0, everyMs = 250,
  onTick, onExpire, while: keepGoing,
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
} = {}) {
  const endMs = deadline instanceof Date ? deadline.getTime()
    : typeof deadline === 'number' ? deadline
    : deadline ? new Date(deadline).getTime() : NaN;
  if (!Number.isFinite(endMs)) return { stop() {} };   // sin deadline → no hay reloj

  let handle = null, expired = false;
  const stop = () => { if (handle != null) { clearIntervalFn(handle); handle = null; } };

  const tick = () => {
    if (keepGoing && !keepGoing()) return stop();
    const remainMs = Math.max(0, endMs - serverNow());
    const pct = totalMs > 0 ? Math.max(0, Math.min(100, 100 * remainMs / totalMs)) : 0;
    onTick?.({ remainMs, remainSec: Math.ceil(remainMs / 1000), pct });
    if (remainMs <= 0 && !expired) { expired = true; stop(); onExpire?.(); }
  };

  tick();                       // pinta ya, sin esperar al primer intervalo
  if (!expired) handle = setIntervalFn(tick, everyMs);
  return { stop };
}

/**
 * Cronómetro ASCENDENTE desde un instante de inicio (el "3:07" de las carreras y
 * del tablero compartido, donde no hay límite sino tiempo transcurrido).
 * Tercera forma de reloj del proyecto, junto a `createCountdown` (duración) y
 * `startDeadlineTicker` (hasta un instante).
 * @returns {{ stop: () => void }}
 */
export function startElapsedTicker({
  since, everyMs = 1000, onTick, while: keepGoing,
  setIntervalFn = setInterval, clearIntervalFn = clearInterval,
} = {}) {
  const startMs = since instanceof Date ? since.getTime()
    : typeof since === 'number' ? since
    : since ? new Date(since).getTime() : NaN;
  let handle = null;
  const stop = () => { if (handle != null) { clearIntervalFn(handle); handle = null; } };
  const tick = () => {
    if (keepGoing && !keepGoing()) return stop();
    // `since` es el `started_at` de la SALA (lo estampó el profe) → hora común.
    const elapsedSec = Number.isFinite(startMs) ? Math.max(0, Math.floor((serverNow() - startMs) / 1000)) : 0;
    onTick?.({ elapsedSec, label: mmss(elapsedSec * 1000, Math.floor) });
  };
  tick();
  handle = setIntervalFn(tick, everyMs);
  return { stop };
}
