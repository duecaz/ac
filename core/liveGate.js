// LA PUERTA DE UNA PREGUNTA EN VIVO — cuándo se puede tocar, en UN sitio y PURO.
//
// Dos instantes de la sala mandan sobre la pregunta: `answers_open_at` (hasta
// cuándo solo se LEE, R-1) y `deadline` (cuándo cierra). Decidir "¿esto se puede
// tocar ya?" estaba escrito dentro del render de `views/studentLive.js` como una
// resta suelta (`openAtMs > clock.now()`), sin tope ninguno.
//
// EL CINTURÓN (lo que esta función añade): aunque el reloj falle, la puerta
// nunca puede quedarse cerrada más de lo configurado.
//   · La espera se ACOTA a la ventana de lectura de la actividad. Un móvil
//     atrasado 25 s pintó «Preparados… 34» sobre una lectura de 10 s y se comió
//     la pregunta entera («sin respuesta · 0 puntos»). Con tope, lo peor que
//     puede pasar es empezar tarde — pero JUGAR.
//   · Si la pregunta ya CERRÓ, no se espera: no tiene sentido hacer leer a nadie
//     una pregunta que ya no admite respuesta.
// Es defensa en profundidad: la corrección de verdad es `core/serverNow.js`
// (que el desfase no exista). Esto es lo que salva la clase el día que la
// corrección no esté disponible — sin servidor, con la cabecera ilegible, o con
// un aparato que derive a mitad de partida.
//
// Vigilada por `tests/liveGate.test.mjs`.

/**
 * @param {object} o
 * @param {number} o.openAtMs    instante en que se abren las respuestas (0 = sin ventana).
 * @param {number} [o.deadlineMs] instante de cierre (0 = sin cierre).
 * @param {number} o.now         AHORA, en la misma referencia que los instantes
 *                               (o sea: `serverNow()`, nunca el reloj del aparato).
 * @param {number} [o.readMs=0]  ventana de lectura configurada, el TOPE de la espera.
 * @returns {{reading: boolean, waitMs: number, closed: boolean}}
 *          `waitMs` es cuánto hay que esperar DE VERDAD (ya acotado): el que
 *          pinta la cuenta atrás debe usar esto, no la resta cruda.
 */
export function questionGate({ openAtMs = 0, deadlineMs = 0, now, readMs = 0 }) {
  const closed = !!deadlineMs && now >= deadlineMs;
  if (closed || !openAtMs) return { reading: false, waitMs: 0, closed };
  const bruto = openAtMs - now;
  // El tope: nunca esperar más que la lectura declarada por la actividad. Si la
  // actividad no declara lectura (readMs = 0) no hay ventana que respetar.
  const waitMs = Math.max(0, Math.min(bruto, readMs));
  return { reading: waitMs > 0, waitMs, closed: false };
}
