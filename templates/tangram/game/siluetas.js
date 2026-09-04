// Las siluetas del tangram, en coordenadas del CUADRADO UNIDAD (mismo sistema
// que las piezas de piezas.js — nada de px, §3). Cada silueta es la UNIÓN de
// una SOLUCIÓN construida por ARISTAS COMPLETAS (o medias aristas: una pieza
// más pequeña cubre solo un tramo del borde de otra) — nunca colocada a ojo —
// así la conexidad es CIERTA por construcción y `mascara.js` compara siempre
// lo mismo, la unión de polígonos, tanto para la silueta como para lo que el
// jugador va dejando caer.
//
// SOLO DOS FIGURAS (2026-09-04, decisión del dueño tras revisar capturas):
// «cuadrado» (la disección clásica del cuadrado) y «casa» (cuerpo + tejado a
// dos aguas + chimenea + suelo con dos escalones), con las coordenadas EXACTAS
// que dio el dueño (√2 exacto, no 1.414) — cuerpo↔tejado con arista completa,
// chimenea↔tejado y cuerpo↔suelo con MEDIA arista (apoyados en un TRAMO del
// borde del vecino, no en el borde entero). Verificado con game/mascara.js:
// 1 sola componente, área total = 1, `estaResuelto()` da true con esta
// solución. §30: un catálogo con figuras que no se leen como su nombre es
// dato que no sirve — se retiraron las otras 8 en vez de dejarlas «ocultas»
// o comentadas.
//
// DEUDA ABIERTA: faltan gato · barco · cisne · conejo · pez · árbol. Hacen
// falta LÁMINAS DE REFERENCIA con coordenadas (o una imagen clara para
// transcribir a mano sobre esta misma rejilla de 1/4 y √2/4) — un intento sin
// referencia visual, solo por prueba y error, no dio figuras reconocibles.
// Entran por esta misma estructura (`solucion` con aristas/medias aristas +
// `poligonos` derivados) en cuanto alguien aporte esas coordenadas.

export const SILUETAS = {
  cuadrado: {
    nombre: 'Cuadrado',
    bbox: { minx: 0, maxx: 1, miny: 0, maxy: 1.25 },
    solucion: [
      { pieza: 'grande1', x: 0.5, y: 0.5, rot: 225, flip: false },
      { pieza: 'grande2', x: 0.5, y: 0.5, rot: 135, flip: false },
      { pieza: 'mediano', x: 1, y: 0.5, rot: 180, flip: false },
      { pieza: 'pequeno1', x: 0.75, y: 0.75, rot: 315, flip: false },
      { pieza: 'pequeno2', x: 0.75, y: 0.75, rot: 225, flip: false },
      { pieza: 'paralelogramo', x: 1, y: 1, rot: 225, flip: true },
      { pieza: 'cuadrado', x: 0.25, y: 0.75, rot: 45, flip: false },
    ],
    poligonos: [
      [[0.5, 0.5], [0, 0], [1, 0]],
      [[0.5, 0.5], [0, 1], [0, 0]],
      [[1, 0.5], [0.5, 0.5], [1, 0]],
      [[0.75, 0.75], [1, 0.5], [1, 1]],
      [[0.75, 0.75], [0.5, 0.5], [1, 0.5]],
      [[1, 1], [0.75, 0.75], [0.25, 0.75], [0.5, 1]],
      [[0.25, 0.75], [0.5, 1], [0.25, 1.25], [0, 1]],
    ],
  },
  casa: {
    nombre: 'Casa',
    bbox: { minx: -0.146446609, maxx: 1.103553391, miny: -1.060660172, maxy: 0.25 },
    solucion: [
      { pieza: 'grande1', x: 0.707106781, y: 0, rot: 180, flip: false },
      { pieza: 'grande2', x: 0, y: -0.707106781, rot: 0, flip: false },
      { pieza: 'mediano', x: 0.353553391, y: -1.060660172, rot: 45, flip: false },
      { pieza: 'cuadrado', x: 0.707106781, y: -0.353553391, rot: 0, flip: false },
      { pieza: 'paralelogramo', x: 0.103553391, y: 0, rot: 45, flip: true },
      { pieza: 'pequeno1', x: 0.103553391, y: 0, rot: 45, flip: false },
      { pieza: 'pequeno2', x: 0.853553391, y: 0.25, rot: 225, flip: false },
    ],
    poligonos: [
      [[0.707106781, 0], [0, 0], [0.707106781, -0.707106781]],
      [[0, -0.707106781], [0.707106781, -0.707106781], [0, 0]],
      [[0.353553391, -1.060660172], [0.707106781, -0.707106781], [0, -0.707106781]],
      [[0.707106781, -0.353553391], [1.060660172, -0.353553391], [1.060660172, 0], [0.707106781, 0]],
      [[0.103553391, 0], [0.353553391, 0.25], [0.853553391, 0.25], [0.603553391, 0]],
      [[0.103553391, 0], [0.353553391, 0.25], [-0.146446609, 0.25]],
      [[0.853553391, 0.25], [0.603553391, 0], [1.103553391, 0]],
    ],
  },
};

export const ORDEN_SILUETAS = Object.keys(SILUETAS);
