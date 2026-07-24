// RITMO DE JUEGO — las pausas que definen cómo se SIENTE la app, con nombre y en
// un solo sitio (antes eran setTimeouts mágicos enterrados en cada vista).
// Regla: si añades una pausa de juego nueva, se declara aquí; el flujo interno de
// LIVE (heartbeats, polls, countdowns del host) tiene su propio ritmo en hostLive.

export const FLASH_MS = 700;        // destello verde/rojo tras responder (VS)
export const RACE_FLASH_MS = 350;   // destello corto entre preguntas de carrera (alumno live)
export const COVER_MS = 1100;       // Memoria: cuánto se ven las dos cartas falladas
export const WIN_HOLD_MS = 1500;    // VS: la animación celebra al ganador antes del podio
export const CONFETTI_ENCORE_MS = [900, 1700];  // ráfagas extra de confeti tras el podio

// Ventana de una pregunta en vivo, en ms (default 20s, piso 5s). ÚNICA fuente:
// la usan el deadline del host, la barra de cuenta atrás del alumno y el
// denominador del bonus de velocidad Kahoot (core/scoring/award.js). Antes iban
// por separado y award.js OMITÍA el piso de 5 → el bonus mentía con timers < 5s.
export function questionWindowMs(activity) {
  return Math.max(5, activity?.live?.questionTimer || 20) * 1000;
}
