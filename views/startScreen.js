// Pantalla de inicio del modo Individual — hoy es la ANTESALA compartida
// (`views/antesala.js`) con la variante de este modo: la actividad se presenta
// con su icono, su título y sus instrucciones, y no se ve el ejercicio hasta
// pulsar Iniciar.
//
// Antes de F4 el modo Individual entraba directo al primer ítem, así que el
// alumno VEÍA el ejercicio antes de empezar y no había un lugar común para el
// título, las instrucciones y los ajustes. Esta pantalla lo estandarizó; desde
// 2026-09-01 lo estandariza para los CUATRO modos, no solo para este (las
// reglas —un solo botón, siempre pantalla completa, instrucciones a la vista—
// viven en la antesala y ya no se deciden aquí).
//
// Contrato:
//   host      elemento/selector del escenario donde se pinta (#ww-player-widget).
//   activity  la actividad a jugar (ya con su tema/preview aplicado).
//   opts:
//     onStart      () => void|Promise. Arranca el juego de verdad. Requerido.
//     frame        elemento del marco a poner en pantalla completa (#ww-frame).
//     onOption·choices  opciones de partida que declara la plantilla.
import { getTemplate } from '../core/registry.js';
import { renderAntesala } from './antesala.js';

export function renderStartScreen(host, activity, opts = {}) {
  const { onStart, onOption, choices } = opts;
  const T = getTemplate(activity?.template);
  return renderAntesala(host, {
    activity, onStart,
    // Opciones de partida de la plantilla: se deciden AQUÍ, al lanzar, no en el
    // editor (core/playOptions.js). UN solo canal — la antesala tenía además un
    // `onOption` suelto que este mismo caller ya envolvía aquí dentro.
    playOpts: T ? { T, activity, choices, onChange: (id, v) => onOption?.(id, v) } : null,
  });
}
