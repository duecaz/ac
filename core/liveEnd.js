// POLÍTICA DE FIN de los bucles a ritmo del alumno (carrera y tablero).
//
// El problema que cierra (docs/estudio-bucles-live.md, ficha 2 C-1): en rondas
// el juego tiene final propio —se acaban las preguntas—, pero la carrera y el
// tablero **no terminan nunca solos**: siguen hasta que el profe pulsa
// "Terminar", aunque los 30 hayan acabado hace dos minutos. Y el primero que
// termina se queda mirando un "esperando…" sin saber si faltan diez segundos o
// diez minutos.
//
// Aquí se declara CUÁNDO acaba, con tres formas y una sola implementación para
// los dos bucles:
//   · 'all'    — cuando TODOS terminan (por defecto: nadie se queda a medias)
//   · 'firstN' — cuando terminan los N primeros (competición corta)
//   · 'time'   — al llegar un instante (el profe pone el reloj)
// En los tres casos el profe conserva su botón de cortar: la política decide
// cuándo se cierra SOLA, no le quita el mando.
//
// El instante de 'time' viaja como INSTANTE en la fila de la sala (§26 ficha
// 1b) — nunca como un temporizador local.
//
// Módulo PURO: entra el estado, sale la decisión y la frase para el alumno.

export const END_POLICIES = ['all', 'firstN', 'time'];

export const DEFAULT_POLICY = 'all';
export const DEFAULT_FIRST_N = 3;
export const DEFAULT_MINUTES = 10;
export const MAX_MINUTES = 90;

/** Lee la política de la fila de la sala, con valores por defecto sanos. */
export function endPolicyOf(session) {
  const policy = END_POLICIES.includes(session?.end_policy) ? session.end_policy : DEFAULT_POLICY;
  const nRaw = Number(session?.end_n);
  const n = Number.isFinite(nRaw) && nRaw >= 1 ? Math.round(nRaw) : DEFAULT_FIRST_N;
  const deadlineMs = session?.deadline ? Date.parse(String(session.deadline).replace(' ', 'T')) : NaN;
  return { policy, n, deadlineMs: Number.isFinite(deadlineMs) ? deadlineMs : null };
}

/**
 * ¿Debe cerrarse sola la partida?
 * @param {object} o
 * @param {'all'|'firstN'|'time'} o.policy
 * @param {number} o.n          para 'firstN'
 * @param {number|null} o.deadlineMs para 'time'
 * @param {number} o.now        `clock.now()` — inyectado, nada de reloj propio
 * @param {number} o.players    jugadores en la sala
 * @param {number} o.finished   cuántos han terminado ya
 */
export function shouldEnd({ policy, n, deadlineMs, now, players = 0, finished = 0 }) {
  if (policy === 'time') return !!deadlineMs && now >= deadlineMs;
  // Sin jugadores no se cierra sola: una sala recién abierta tendría 0 de 0 y
  // se auto-terminaría antes de que entrara nadie.
  if (players <= 0) return false;
  if (policy === 'firstN') return finished >= Math.min(n, players);
  return finished >= players;   // 'all'
}

/**
 * Qué se le dice al alumno que YA terminó, en vez de un "esperando…" mudo.
 * Devuelve `{ text, showClock }`: si `showClock`, la vista pinta la cuenta
 * atrás con el instante de la sala (no con un contador propio).
 */
export function waitingInfo({ policy, n, players = 0, finished = 0 }) {
  if (policy === 'time') {
    return { text: 'La carrera termina cuando se acabe el tiempo.', showClock: true };
  }
  // `players <= 0` = quien pregunta no sabe cuántos hay (el ALUMNO no lee la
  // lista de jugadores): se dice la REGLA, sin inventar un número.
  const known = players > 0;
  if (policy === 'firstN') {
    if (!known) return { text: `Termina cuando acaben los ${n} primeros.`, showClock: false };
    const left = Math.max(0, Math.min(n, players) - finished);
    return {
      text: left > 0
        ? `Termina cuando acaben ${left} ${left === 1 ? 'compañero más' : 'compañeros más'}.`
        : 'Terminando…',
      showClock: false,
    };
  }
  if (!known) return { text: 'Termina cuando acaben todos.', showClock: false };
  const left = Math.max(0, players - finished);
  return {
    text: left > 0
      ? `Faltan ${left} ${left === 1 ? 'compañero' : 'compañeros'} por terminar.`
      : 'Terminando…',
    showClock: false,
  };
}
