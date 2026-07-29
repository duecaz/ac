// QUÉ PERSISTE CADA MODO — política declarada en UN solo sitio.
//
// Antes esta decisión vivía dispersa: `results.js` tenía un `opts.mode !==
// 'async-tracked'` suelto (y como Tarea no pasaba ese modo, cada tarea se
// guardaba DOBLE), mientras VS y Equipos no guardaban nada sin que nadie lo
// hubiera decidido — simplemente nadie lo escribió. Aquí está el cuadro
// completo, y `trySaveResult` lo LEE en vez de improvisar.
//
// `results`  → fila en la colección `results` (historial del jugador).
// `attempts` → fila en `assignment_attempts` (la escribe el contenedor de Tarea).
// `live`     → filas en `live_answers` + el blob de la sala (lo escribe el host).
export const PERSIST = {
  // Individual: el shell guarda el resultado al terminar.
  solo:             { results: true,  attempts: false, live: false },
  // Tarea: el intento lo registra views/studentTask.js (recordAttempt). NO debe
  // escribir además en `results` — eso era el guardado doble.
  'async-tracked':  { results: false, attempts: true,  live: false },
  // Live (alumno): las respuestas van a `live_answers`; el veredicto lo pone el
  // host al liquidar. El player no guarda nada por su cuenta.
  'live-student':   { results: false, attempts: false, live: true },
  // VS y Equipos: pizarra COMPARTIDA sin identidad de alumno (dos jugadores o
  // equipos en una misma pantalla). Hoy NO persisten POR DISEÑO: una fila de
  // `results` quedaría atribuida al dispositivo del profe y no hay ninguna vista
  // que la muestre (Reportes solo cubre Live). Si algún día se quiere historial
  // de duelos, el orden correcto es: primero la vista que lo lee, luego activar
  // aquí `results: true` — no al revés.
  vs:               { results: false, attempts: false, live: false },
  teams:            { results: false, attempts: false, live: false },
};

// Modo por defecto cuando el caller no declara ninguno: Individual.
export const DEFAULT_MODE = 'solo';

/** ¿Este modo guarda una fila en `results`? Un modo desconocido no guarda
 *  (fail-safe: mejor no escribir que escribir basura atribuida a nadie). */
export function savesResult(mode) {
  const key = mode || DEFAULT_MODE;
  return PERSIST[key]?.results === true;
}
