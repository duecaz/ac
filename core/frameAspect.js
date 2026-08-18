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
 * El `style` del marco: SOLO variables, nunca `aspect-ratio` directo.
 *
 * Las dos formas de la misma proporción, con un solo origen:
 *   · `--ww-ar-css` la aplica `styles/player.css` (`aspect-ratio: var(...)`);
 *   · `--ww-ar` es la forma numérica para el `calc()` del ancho máximo.
 *
 * POR QUÉ NO SE ESCRIBE `aspect-ratio` AQUÍ: un estilo en línea gana a
 * cualquier hoja, y eso convertía la proporción en una JAULA — en un móvil de
 * 390x844 el marco 4/3 medía 358x269, o sea el 29 % de la pantalla, con 445 px
 * de alto muerto debajo (medido). Con la proporción en una variable, el CSS
 * puede soltarla donde toca: pantalla completa, VS/Equipos y **ventana
 * claramente vertical**. La plantilla sigue DECLARANDO (§0); lo que cambia es
 * que la plataforma puede obedecer con criterio en vez de a rajatabla.
 * `auto` = la plantilla dice que no tiene forma fija; entonces manda un mínimo
 * para que no colapse a nada.
 */
export function aspectStyle(aspect) {
  if (!aspect || aspect === 'auto') return '--ww-ar-css: auto; min-height: 50vh;';
  return `--ww-ar-css: ${aspect}; --ww-ar: (${aspect});`;
}
