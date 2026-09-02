// EL AZAR DEL JUEGO — inyectable, igual que `core/clock.js` es el reloj.
//
// En producción `azar.random()` === `Math.random()`. En un test o en una
// herramienta se reemplaza por una fuente sembrada:
//   import { azar, semilla } from '../core/azar.js';
//   const restaurar = semilla(7);   // barajados reproducibles
//   …
//   restaurar();
//
// POR QUÉ existe: `tools/shots.mjs` compara la MISMA pantalla entre dos
// versiones píxel a píxel. Quiz baraja sus opciones en cada montaje, así que
// dos capturas de un árbol IDÉNTICO cantaban ~2.500 píxeles de cambio. El
// apaño fue sembrar la ACTIVIDAD (`rules.shuffleOptions:false`) — un remiendo
// que conoce el ajuste de UNA plantilla, apaga la mecánica que se quería
// fotografiar y no sirve para las otras doce. Con el azar inyectado se siembra
// la FUENTE: la herramienta ve exactamente lo que ve la clase, dos veces igual.
//
// Lo que NO entra aquí: el confeti (`core/effects.js`), las partículas
// (`core/soloAnimations.js`), los IDs (`core/ids.js`), los PIN de sala y de
// tarea, y el jitter de reconexión. Ninguno es CONTENIDO que el alumno juegue,
// y un PIN reproducible sería un fallo, no una virtud.
export const azar = {
  random: () => Math.random(),
};

// Fisher–Yates. Devuelve EL MISMO array (quien necesite conservar el original
// pasa una copia). Dueño único del barajado: estuvo escrito a mano en quiz,
// memory, match, el mazo de Equipos y el tablero de las Pelotas.
//
// `fuente` existe para el caso de las Pelotas: su tablero se SIEMBRA aparte
// para que los dos jugadores del duelo reciban el MISMO reparto (si no, no es
// justo). Ese azar no es el de la partida en curso, así que no puede salir del
// primitivo global — se pasa.
export function shuffle(a, fuente) {
  const dado = fuente || (() => azar.random());
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(dado() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * PRNG mulberry32, puro y determinista: misma semilla → misma secuencia.
 * Dueño único (barrido B5, 2026-09-02) — el generador de la sopa de letras
 * (`templates/wordsearch/generator.js`) lo reimplementaba letra por letra,
 * violando la regla `azar-primitivo` (un solo generador sembrado en el
 * proyecto). Ojo: NO siembra el primitivo global `azar` — devuelve la
 * función `rand()` suelta, para quien necesite su PROPIO generador
 * determinista por contenido (p.ej. la sopa: misma actividad → mismo
 * tablero en los dos móviles del VS) sin tocar el azar de la partida.
 * @param {number} seed
 * @returns {() => number} rand() en [0,1)
 */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Siembra `azar` con un generador determinista (mulberry32) y devuelve la
 * función que lo restaura. Pensado para tests y herramientas; no se usa en
 * producción.
 * @param {number} n semilla
 * @returns {() => void} restaurar
 */
export function semilla(n = 1) {
  const previo = azar.random;
  azar.random = mulberry32(n);
  return () => { azar.random = previo; };
}
