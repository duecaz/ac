// RITMO DE JUEGO — las pausas que definen cómo se SIENTE la app, con nombre y en
// un solo sitio (antes eran setTimeouts mágicos enterrados en cada vista).
// Regla: si añades una pausa de juego nueva, se declara aquí; el flujo interno de
// LIVE (heartbeats, polls, countdowns del host) tiene su propio ritmo en hostLive.

export const FLASH_MS = 700;        // destello verde/rojo tras responder (VS)
export const RACE_FLASH_MS = 350;   // destello corto entre preguntas de carrera (alumno live)
export const COVER_MS = 1100;       // Memoria: cuánto se ven las dos cartas falladas
export const WIN_HOLD_MS = 1500;    // VS: la animación celebra al ganador antes del podio
export const CONFETTI_ENCORE_MS = [900, 1700];  // ráfagas extra de confeti tras el podio
export const WRONG_FLASH_MS = 380;  // Sopa: destello rojo de una selección fallida
export const GRADE_HOLD_MS = 1100;  // Emparejar/Diagrama: ver la corrección antes del resultado

// ── RED DE SEGURIDAD DE REFRESCO EN VIVO ─────────────────────────────────────
// El host se pinta con los eventos de realtime, pero un evento se puede perder
// (móvil que suspende, SSE cortado). Estos son los repintados de respaldo, no el
// ritmo normal: si se ven "saltos" de progreso en clase, es esto. Estaban como
// literales sueltos dentro de hostLive, cada pantalla con el suyo.
export const RACE_POLL_MS = 5000;   // carrera libre: lista de progreso por alumno
export const BOARD_POLL_MS = 2000;  // tablero compartido: se mueve más, refresca antes

// Ventana de una pregunta en vivo, en ms (default 20s, piso 5s). ÚNICA fuente:
// la usan el deadline del host, la barra de cuenta atrás del alumno y el
// denominador del bonus de velocidad (core/scoring/award.js). Antes iban
// por separado y award.js OMITÍA el piso de 5 → el bonus mentía con timers < 5s.
export function questionWindowMs(activity) {
  return Math.max(5, activity?.live?.questionTimer || 20) * 1000;
}

// R-1 · VENTANA DE LECTURA (docs/estudio-bucles-live.md, ficha 1b). Segundos en
// los que la pregunta se ve pero NO se puede responder. Sin ella, enunciado y
// opciones aparecen a la vez y el bonus de velocidad premia al que hace clic
// antes de leer. 0 = comportamiento anterior (retrocompatible).
export const READ_SECONDS_DEFAULT = 3;
export const READ_SECONDS_MAX = 30;
export function readSeconds(activity) {
  const v = activity?.live?.readSeconds;
  const n = (v === undefined || v === null) ? READ_SECONDS_DEFAULT : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(READ_SECONDS_MAX, Math.round(n));
}
export function readWindowMs(activity) { return readSeconds(activity) * 1000; }

// R-3 · TIEMPO POR PREGUNTA (docs/estudio-bucles-live.md ficha 1). Había UNA
// ventana para toda la actividad: una de comprensión lectora y un "2+2" no
// pueden compartir cronómetro. Ahora cada ítem PUEDE declarar sus segundos
// (`item.seconds`) y, si no lo hace, hereda el de la actividad — así el
// contenido antiguo se comporta EXACTAMENTE igual y no hace falta migrar nada
// (§24: campo opcional, sin transformación).
//
// OJO — quien usa esto: el HOST (para fijar el instante de cierre) y el SCORER
// (el bonus de velocidad divide por la ventana; con una ventana equivocada el
// bonus se calcula mal en silencio). El ALUMNO no lo necesita: lee los
// INSTANTES de la sala, así que la ventana no viaja en el snapshot.
export const ITEM_SECONDS_MIN = 5;
export const ITEM_SECONDS_MAX = 300;
export function itemSeconds(activity, item) {
  const raw = Number(item?.seconds);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(ITEM_SECONDS_MAX, Math.max(ITEM_SECONDS_MIN, Math.round(raw)));
  }
  return questionWindowMs(activity) / 1000;   // el de la actividad (defecto 20)
}
export function itemWindowMs(activity, item) { return itemSeconds(activity, item) * 1000; }

// Tiempo de reloj en «m:ss» — ÚNICO formateador del repo (antes esta misma
// aritmética estaba copiada en el ticker, en dos vistas de vivo y en el
// cronómetro de Ordena las Pelotas). `round` se elige por caso: una CUENTA ATRÁS
// usa `Math.ceil` (mostrar 0:00 con un segundo aún por correr miente), y el
// tiempo TRANSCURRIDO usa `Math.floor`/`Math.round`.
export function mmss(ms, round = Math.round) {
  const s = Math.max(0, round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
