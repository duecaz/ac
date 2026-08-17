// LA FORMA DEL MARCO DE JUEGO — una regla para las cuatro superficies.
//
// El dueño (2026-08-17): «el 4:3 es solo cuando no está en pantalla completa;
// además, ¿cómo están los players de las demás actividades? Eso era solo para el
// caso de tareas: debemos estandarizar». Tenía razón — había cuatro criterios:
//
//   · profe (Individual/VS/Equipos) → la proporción que DECLARA la plantilla;
//   · alumno en vivo y tarea        → 4:3 escrito a mano por mí;
//   · docente en vivo               → sin proporción (crece con su contenido);
//   · pantalla completa             → sin proporción (100vw × 100vh).
//
// El primero y el último ya eran los correctos. La norma queda así:
//
//   1. LA PLANTILLA DECLARA su proporción (`meta.aspectRatio`) y la plataforma
//      OBEDECE, juegue quien juegue (§0: el contenido declara, el modo no
//      adivina). La Ruleta necesita un cuadrado, un texto necesita 16/10 — eso
//      lo sabe la mecánica, no la página que la aloja.
//   2. EL TAMAÑO SALE DEL HUECO: el ancho máximo es `alto libre × proporción`
//      (styles/player.css). Ninguna superficie escribe un alto absoluto.
//   3. PANTALLA COMPLETA SUELTA la proporción, y también los modos que piden más
//      caja (VS/Equipos, `.is-expanded`). La forma es para el marco embebido.
//   4. EL PANEL DEL DOCENTE NO ES UN JUEGO EN UNA PÁGINA: es un tablero de
//      control con pantallas de alturas muy distintas, así que no lleva
//      proporción (ver `caja: false` en core/gameFrame.js).
//
// Este módulo es el punto 1 hecho función: la ESCRIBE una sola vez. Estaba
// duplicada —`views/playerView.js` la generaba y `core/gameFrame.js` la ponía a
// mano—, justo la «segunda verdad» contra la que avisaba el comentario de la
// primera.
import { getTemplate } from './registry.js';

/** Proporción por defecto cuando la plantilla no declara ninguna. */
export const ASPECTO_POR_DEFECTO = '4/3';

/** La proporción DECLARADA por la plantilla de esta actividad. */
export function aspectoDe(activity) {
  return getTemplate(activity?.template)?.meta?.aspectRatio || ASPECTO_POR_DEFECTO;
}

/**
 * El `style` del marco. Va DOS veces y con un solo origen: `aspect-ratio` para
 * el navegador y `--ww-ar` para que el CSS deduzca de ella el ancho máximo a
 * partir del alto libre (styles/player.css).
 * `auto` = la plantilla dice que no tiene forma fija; entonces manda un mínimo
 * para que no colapse a nada.
 */
export function aspectStyle(aspect) {
  if (!aspect || aspect === 'auto') return 'aspect-ratio: auto; min-height: 50vh;';
  return `aspect-ratio: ${aspect}; --ww-ar: (${aspect});`;
}
