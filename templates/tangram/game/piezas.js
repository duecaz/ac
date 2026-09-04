// Las SIETE piezas clásicas del tangram, en proporciones exactas sobre el
// CUADRADO UNIDAD (lado 1, área 1). Cada pieza es un polígono LOCAL —el
// vértice del ángulo recto (o una esquina, en cuadrado/paralelogramo— vive en
// el origen (0,0): es el punto que `transformarPieza` rota y que la colocación
// {x,y} traslada. El COLOR es DATO (§3): lo pinta `player.js` inline vía
// `fill`, nunca CSS.
//
// Proporción base: t = √2/4 (cateto del triángulo pequeño = lado del
// cuadrado). De ahí: triángulo mediano cateto 2t, triángulo grande cateto 4t
// (=√2/2), y el paralelogramo con lados t y 2t a 45°. Suma de áreas = 1
// exacta (lo comprueba tests/tangram.test.mjs).
const T = Math.SQRT2 / 4;

// Triángulo rectángulo isósceles: catetos `c` sobre los ejes, ángulo recto en
// el origen (que es el punto que se rota/traslada).
const triangulo = (c) => [[0, 0], [c, 0], [0, c]];

export const PIEZAS = {
  // 2 triángulos GRANDES — cateto 2t (=√2/2), área 1/4 cada uno.
  grande1: { nombre: 'Triángulo grande 1', color: '#e74c3c', puntos: triangulo(2 * T) },
  grande2: { nombre: 'Triángulo grande 2', color: '#3498db', puntos: triangulo(2 * T) },
  // 1 triángulo MEDIANO — cateto t√2 (la hipotenusa del pequeño), área 1/8.
  mediano: { nombre: 'Triángulo mediano', color: '#2ecc71', puntos: triangulo(T * Math.SQRT2) },
  // 2 triángulos PEQUEÑOS — cateto t, área 1/16 cada uno.
  pequeno1: { nombre: 'Triángulo pequeño 1', color: '#f1c40f', puntos: triangulo(T) },
  pequeno2: { nombre: 'Triángulo pequeño 2', color: '#9b59b6', puntos: triangulo(T) },
  // CUADRADO — lado t, área 1/8. Esquina (no ángulo recto de triángulo) en el origen.
  cuadrado: { nombre: 'Cuadrado', color: '#e67e22', puntos: [[0, 0], [T, 0], [T, T], [0, T]] },
  // PARALELOGRAMO — lados t y 2t a 45°, área 1/8. Es la ÚNICA pieza donde el
  // volteo (doble toque) cambia algo visible: sin voltear es un paralelogramo
  // "hacia la derecha"; volteado, su espejo.
  paralelogramo: {
    nombre: 'Paralelogramo', color: '#1abc9c',
    puntos: [[0, 0], [T, 0], [2 * T, T], [T, T]],
  },
};

export const ORDEN_PIEZAS = ['grande1', 'grande2', 'mediano', 'pequeno1', 'pequeno2', 'cuadrado', 'paralelogramo'];

/** Área (shoelace) de un polígono simple — usada por el test de proporciones
 *  y por quien quiera validar una pieza nueva sin rasterizar nada. */
export function areaPoligono(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
