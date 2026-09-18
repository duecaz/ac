// Las FIGURAS DE PARTIDA del tangram, en coordenadas del CUADRADO UNIDAD
// (mismo sistema que las piezas de piezas.js — nada de px, §3). Desde el
// formato v2 (content.js) la silueta que juega la clase es la UNIÓN de las
// colocaciones que el docente deja en el tablero del editor; este catálogo
// son las figuras con las que se puede EMPEZAR a armar. Cada una es una
// SOLUCIÓN construida por ARISTAS COMPLETAS (o medias aristas: una pieza más
// pequeña cubre solo un tramo del borde de otra) — nunca colocada a ojo —, así
// la conexidad es CIERTA por construcción. Los polígonos y la caja se DERIVAN
// (`poligonosDe` · `bboxDe`, geometria.js): el catálogo los declaraba a mano al
// lado, dos fuentes de la misma verdad (§21b); el test (e) conserva los del
// cuadrado y la casa como oráculo de la derivación.
//
// SOLO DOS FIGURAS (2026-09-04, decisión del dueño tras revisar capturas):
// «cuadrado» (la disección clásica del cuadrado) y «casa» (cuerpo + tejado a
// dos aguas + chimenea + suelo con dos escalones), con las coordenadas EXACTAS
// que dio el dueño (√2 exacto, no 1.414) — cuerpo↔tejado con arista completa,
// chimenea↔tejado y cuerpo↔suelo con MEDIA arista. Verificado con
// game/mascara.js: 1 sola componente, área total = 1, `estaResuelto()` da true
// con esta solución. §30: un catálogo con figuras que no se leen como su
// nombre es dato que no sirve — se retiraron las otras 8 en vez de dejarlas
// «ocultas» o comentadas, y el intento de 2026-09-18 de transcribir gato ·
// barco · pez · árbol se cortó sin ninguna que pasara el juicio visual.
// Desde v1.51.711 el camino para ampliar esto es el EDITOR: se arma la figura
// arrastrando, se MIRA, y sus colocaciones imantadas se copian aquí como
// `solucion`.

/**
 * @typedef {import('./geometria.js').Colocacion} Colocacion
 */
/**
 * Una figura del catálogo: su nombre y la SOLUCIÓN con la que se construyó.
 * @typedef {Object} Silueta
 * @property {string} nombre
 * @property {Colocacion[]} solucion
 */

/** @type {Record<string, Silueta>} */
export const SILUETAS = {
  cuadrado: {
    nombre: 'Cuadrado',
    solucion: [
      { pieza: 'grande1', x: 0.5, y: 0.5, rot: 225, flip: false },
      { pieza: 'grande2', x: 0.5, y: 0.5, rot: 135, flip: false },
      { pieza: 'mediano', x: 1, y: 0.5, rot: 180, flip: false },
      { pieza: 'pequeno1', x: 0.75, y: 0.75, rot: 315, flip: false },
      { pieza: 'pequeno2', x: 0.75, y: 0.75, rot: 225, flip: false },
      { pieza: 'paralelogramo', x: 1, y: 1, rot: 225, flip: true },
      { pieza: 'cuadrado', x: 0.25, y: 0.75, rot: 45, flip: false },
    ],
  },
  casa: {
    nombre: 'Casa',
    solucion: [
      { pieza: 'grande1', x: 0.707106781, y: 0, rot: 180, flip: false },
      { pieza: 'grande2', x: 0, y: -0.707106781, rot: 0, flip: false },
      { pieza: 'mediano', x: 0.353553391, y: -1.060660172, rot: 45, flip: false },
      { pieza: 'cuadrado', x: 0.707106781, y: -0.353553391, rot: 0, flip: false },
      { pieza: 'paralelogramo', x: 0.103553391, y: 0, rot: 45, flip: true },
      { pieza: 'pequeno1', x: 0.103553391, y: 0, rot: 45, flip: false },
      { pieza: 'pequeno2', x: 0.853553391, y: 0.25, rot: 225, flip: false },
    ],
  },
};

export const ORDEN_SILUETAS = Object.keys(SILUETAS);
