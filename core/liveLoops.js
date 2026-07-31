// LEY §26 · EL CATÁLOGO DE BUCLES EN VIVO, DECLARADO.
//
// El hallazgo del estudio D7 (docs/estudio-bucles-live.md): el sistema ejecuta
// CUATRO bucles pero solo tres estaban declarados, y dos no los elegía la
// plantilla — la carrera la elegía el profe en un `<select>` fijo (se ofrecía
// incluso donde no tiene sentido) y "pedir la palabra" se decidía mirando el
// NOMBRE de la plantilla dentro de la vista:
//
//     const isQL = activity.template === 'question-live' || activity.template === 'wheel';
//
// Eso es la capa de MODO conociendo plantillas concretas, justo lo que prohíbe
// la ley §0. Aquí la plantilla DECLARA qué bucles soporta y el lobby se
// construye de esa declaración: el catálogo deja de ser teoría y pasa a ser lo
// que el profe ve.
//
// Módulo PURO: entra una plantilla, sale su lista de bucles.

/** Los bucles que existen. Añadir uno es una DECISIÓN (docs/leyes.md §26 +
 *  su ficha en docs/estudio-bucles-live.md), no un `if` en una vista. */
export const LIVE_LOOPS = ['rounds', 'race', 'board', 'claim'];

/** Cómo se llama cada uno para el docente, y qué hace en una frase. */
export const LOOP_LABELS = {
  rounds: { label: 'Rondas juntas', hint: 'Toda la clase en la misma pregunta, tú marcas el ritmo.' },
  race:   { label: 'Carrera libre', hint: 'Cada alumno avanza a su ritmo; tú ves quién va por dónde.' },
  board:  { label: 'Tablero',       hint: 'Un mismo tablero que cada alumno resuelve.' },
  claim:  { label: 'Pedir la palabra', hint: 'Los alumnos piden turno y tú das los puntos.' },
};

/** La fase de sala en la que corre cada bucle (congelada, §26). */
export const LOOP_PHASE = { rounds: 'question', race: 'race', board: 'race', claim: 'question-live' };

/**
 * Bucles que soporta una plantilla, desde su `meta.play.live`.
 * Acepta la forma NUEVA (lista) y la heredada (string) para que una plantilla
 * sin migrar siga funcionando: 'rounds' | 'board' | 'none'.
 * @returns {string[]} vacío = no se puede jugar en vivo
 */
export function loopsOf(T) {
  const v = T?.meta?.play?.live;
  const raw = Array.isArray(v) ? v : (v ? [v] : []);
  return raw.filter(x => LIVE_LOOPS.includes(x));
}

/** ¿Soporta este bucle? (lo que sustituye a mirar el nombre de la plantilla) */
export function supportsLoop(T, loop) { return loopsOf(T).includes(loop); }

/** El bucle con el que arranca el lobby: el primero que declara la plantilla. */
export function defaultLoop(T) { return loopsOf(T)[0] || null; }

/** ¿Este bucle deja al profe elegir quién avanza? Solo las rondas: en carrera y
 *  tablero avanza cada alumno, y en "pedir la palabra" manda el docente siempre. */
export function hasAdvanceChoice(loop) { return loop === 'rounds'; }
