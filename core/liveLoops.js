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

/** Cómo se llama cada uno para el docente, qué hace en una frase, y CÓMO SE GANA.
 *  `win` es la regla del juego en una línea: vive aquí (no en tres MD copiados,
 *  que ya divergieron una vez) y de aquí la saca `tools/docgen.mjs` para escribir
 *  los cuadros de CLAUDE.md, docs/leyes.md §26 y docs/modos-de-juego.md §9.4. */
export const LOOP_LABELS = {
  rounds: { label: 'Rondas juntas', hint: 'Toda la clase en la misma pregunta, tú marcas el ritmo.',
            win: 'más puntos', advance: 'el profe o el reloj', ends: 'al agotar las preguntas' },
  race:   { label: 'Carrera libre', hint: 'Cada alumno avanza a su ritmo; tú ves quién va por dónde.',
            win: '**terminar primero con todas bien** (empate ⇒ hora de meta)', advance: 'cada alumno',
            ends: 'política declarada: todos · primeros N · tiempo' },
  board:  { label: 'Tablero',       hint: 'Un mismo tablero que cada alumno resuelve.',
            win: 'avanzar más en el tablero', advance: 'cada alumno', ends: 'igual que la carrera' },
  claim:  { label: 'Pedir la palabra', hint: 'Los alumnos piden turno y tú das los puntos.',
            win: 'los puntos que da el docente', advance: 'el profe (a quien pide turno)',
            ends: 'lo cierra el docente' },
};

/** Cómo se calculan los puntos de cada bucle, en una frase (para los cuadros).
 *  La REGLA ejecutable es `pointsModeFor` + el scorer de la plantilla; esto es
 *  su traducción a castellano, en el mismo sitio para que no diverja. */
export const LOOP_POINTS = {
  rounds: 'Kahoot: base×500 + bonus por velocidad',
  race:   '**planos**: el puntaje ES el nº de aciertos',
  board:  'escala propia de la plantilla (Pelotas: 0-1000 por eficiencia)',
  claim:  'manuales (+10/+50), sin clave de respuesta',
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

/** MODELO DE PUNTOS de un bucle — la regla "carrera ⇒ plano" vive AQUÍ y solo
 *  aquí. Antes estaba cableada como `mode: 'race'` en tres llamadores distintos
 *  (el settle del motor, el estimador del alumno y el re-scoring del host), cada
 *  uno con un comentario pidiendo que los otros dos no cambiaran. Es el valor
 *  que reciben los scorers como `mode` (ver core/scoring/award.js `useKahoot`).
 *  - `rounds`/`claim` → 'live': toda la clase abre la pregunta en el MISMO
 *    instante, así que comparar velocidades es justo (bonus Kahoot).
 *  - `race`/`board`  → 'race': cada alumno va a su ritmo; la velocidad ya se
 *    mide por cuándo terminas, y medirla dos veces premiaba al que madruga. */
export function pointsModeFor(loop) {
  return (loop === 'race' || loop === 'board') ? 'race' : 'live';
}

/**
 * ¿SUPERA esta respuesta el ítem en CARRERA? La ley §26 dice que en carrera un
 * fallo VUELVE A LA COLA, y de ahí sale la premisa del podio: todo el que
 * termina lo hace con TODAS bien, así que el puntaje no ordena y manda la hora
 * de meta (`core/liveRank.js`).
 *
 * Esa premisa era FALSA para Tildes y Comas. Su scorer da crédito por marca
 * (`correct: net > 0`), así que una hoja con una tilde de tres puestas se daba
 * por superada: el alumno "terminaba" con la mitad hecha y el podio lo ordenaba
 * junto al que lo hizo todo bien, separados solo por el reloj.
 *
 * En carrera la vara es COMPLETA: `perfect` cuando el scorer lo dice (nada
 * omitido y nada de más) y, para los scorers de todo-o-nada que no lo declaran,
 * su propio `correct`. En los demás bucles no aplica: ahí la pregunta se abre
 * una vez y no se re-encola nada.
 */
export function racePassed(result) {
  if (!result) return false;
  return result.perfect ?? !!result.correct;
}

/**
 * ¿Esta FILA de respuesta cuenta como ítem SUPERADO en carrera? La versión
 * para el HOST de `racePassed`: re-puntúa con la clave (que el host sí tiene)
 * y aplica LA MISMA vara que el móvil. Existió una divergencia real: el host
 * contaba el avance con `scoreSubmission().correct` —para Tildes, `net>0`— así
 * que una hoja 3/4 le contaba como terminada, cerraba la sala con la política
 * "terminan todos", y el alumno veía "¡Ganaste!" encima del aviso de que su
 * hoja volvía a la cola (encontrado en prueba real, v1.51.386). Dos varas para
 * la misma pregunta es exactamente lo que esta función elimina.
 *
 * Si no se puede puntuar (fila vieja sin ítem, scorer que lanza), se cae al
 * veredicto guardado en la fila — mejor un dato viejo que inventar uno.
 */
export function racePassedRow(tpl, row, item, activity, loop) {
  // Sin ítem no hay qué re-puntuar (fila de una sesión vieja, índice fuera de
  // rango): vale el veredicto guardado. OJO: no basta confiar en el catch —
  // los scorers de marcas no lanzan con ítem ausente, devuelven "todo mal".
  if (item == null) return row.correct === true;
  try {
    return racePassed(tpl.scoreSubmission({
      value: row.value, item, activity, mode: pointsModeFor(loop),
    }));
  } catch {
    return row.correct === true;
  }
}
