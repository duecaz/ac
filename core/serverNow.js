// LA HORA COMÚN — §22-5. El reloj del aparato NO decide nada de la sala.
//
// Los instantes de una sala en vivo (`answers_open_at`, `deadline`,
// `started_at`) los escribe UN aparato (el del profe) y los leen OTROS (cada
// móvil). Hasta v1.51.417 cada uno los comparaba contra SU `Date.now()`, así que
// el desfase entre relojes se colaba entero en el juego. Medido con dos
// pantallas y el reloj del alumno desplazado (docs/handoff-reloj-aparatos.md):
//
//   −10 s → el profe ve «Preparados… 9» y el alumno «19» (reporte real de aula)
//   −25 s → al alumno no se le abren las respuestas NUNCA: la pregunta se
//           liquida «sin respuesta · 0 puntos» y él no hizo nada mal
//   +10 s → la ventana de lectura DESAPARECE: responde antes de leer, que es
//           justo lo que R-1 vino a impedir
//
// En un aula lo normal es que los relojes NO coincidan (un Android con la hora
// automática apagada, una pizarra sin sincronizar). Así que la hora la pone el
// SERVIDOR y cada aparato mide su propio desfase contra él.
//
// CÓMO: cada respuesta HTTP de PocketBase trae una cabecera `Date`. Es hora de
// servidor gratis, sin endpoint nuevo ni NTP. Se toma en `core/pbHttp.js`
// (puerta única de todo el tráfico PB) y se guarda la MEDIANA de las últimas
// muestras — una muestra suelta puede caer mal por latencia; la mediana no.
//
// PRECISIÓN: la cabecera tiene resolución de 1 s y se compensa medio viaje de
// ida y vuelta. ±1-2 s es de sobra para ventanas de 10-300 s. No hace falta NTP.
//
// R7 (privacidad de menores): el desfase es un dato del APARATO. Vive en
// memoria, no se persiste, no viaja al profe y no entra en ningún informe.
//
// SIN SERVIDOR (backend local, dev, tests) no hay muestras → desfase 0 →
// `serverNow()` es exactamente `clock.now()`. Nada cambia de comportamiento.
import { clock } from './clock.js';

const MAX_MUESTRAS = 5;
let muestras = [];
let offsetMs = 0;

function recalcular() {
  if (!muestras.length) { offsetMs = 0; return; }
  const orden = [...muestras].sort((a, b) => a - b);
  offsetMs = orden[Math.floor(orden.length / 2)];   // mediana
}

/**
 * Registra una muestra de hora de servidor. La llama `core/pbHttp.js` en CADA
 * respuesta: un móvil que se SUSPENDE (pantalla bloqueada en clase) puede
 * derivar mientras duerme, así que medir una vez al entrar no basta.
 *
 * @param {string|number|Date|null} fecha  la cabecera `Date` de la respuesta.
 * @param {object} [o]
 * @param {number} [o.enviadoMs]  `clock.now()` justo ANTES de la petición.
 * @param {number} [o.recibidoMs] `clock.now()` justo DESPUÉS (default: ahora).
 */
export function noteServerDate(fecha, { enviadoMs, recibidoMs } = {}) {
  const servidorMs = fecha instanceof Date ? fecha.getTime()
    : typeof fecha === 'number' ? fecha
    : fecha ? Date.parse(fecha) : NaN;
  if (!Number.isFinite(servidorMs)) return;          // sin cabecera o ilegible
  const t1 = Number.isFinite(recibidoMs) ? recibidoMs : clock.now();
  const t0 = Number.isFinite(enviadoMs) ? enviadoMs : t1;
  // La cabecera se selló en algún punto entre t0 y t1: el mejor estimador es el
  // centro, que descuenta medio viaje de red.
  const local = t0 + (t1 - t0) / 2;
  muestras.push(servidorMs - local);
  if (muestras.length > MAX_MUESTRAS) muestras.shift();
  recalcular();
}

/** La hora de AHORA según el servidor. Úsala para TODO lo que se compare con un
 *  instante de la sala; `clock.now()` sigue siendo el reloj del aparato (para
 *  medir duraciones locales, colas, anti-spam…). */
export function serverNow() { return clock.now() + offsetMs; }

/** Desfase de ESTE aparato en ms (servidor − aparato). Para diagnóstico. */
export function serverOffsetMs() { return offsetMs; }

/** Olvida lo medido. Solo para tests (y para un cambio de backend). */
export function resetServerClock() { muestras = []; offsetMs = 0; }
