// EL BANCO DE LÁMINAS — compartido por Colorear y Rompecabezas (§21b: un banco,
// un dueño). Vive en `core/` y no junto a los SVG porque una PLANTILLA solo puede
// importar de core/contenido (`tests/layers.test.mjs`): `assets/` es capa de
// arranque y el índice nació allí — cuatro imports cruzaban la capa.
// Los SVG están en `assets/juegos/dibujos/`.
//
// DE DÓNDE SALEN (v1.51.704). Antes eran ocho dibujos hechos a mano por un
// agente y el dueño los vio: «Gato» era un círculo con dos triángulos. Ahora son
// 43 láminas de OPENMOJI (openmoji.org, CC BY-SA 4.0), importadas con
// `node tools/importar-dibujos.mjs` y agrupadas en TEMAS CERRADOS — un tema se
// elige entero, no se rebusca dibujo a dibujo. Créditos y licencia en
// `assets/juegos/dibujos/CREDITOS.md`.
//
// EL CONTRATO CAMBIÓ, Y ES EL NÚCLEO DEL ASUNTO. Antes cada SVG traía sus zonas
// cerradas (`data-zona` + `data-color`) porque la mecánica era TOCAR una zona y
// que se rellenara sola. Las láminas de OpenMoji son `fill="none"` con trazo:
// línea pura, sin una sola región rellenable. No es un defecto del banco — es
// lo que es una lámina para colorear de verdad, y es la razón por la que se
// pinta A MANO ALZADA: el pincel no necesita zonas, así que cualquier lámina
// dibujada por una persona entra sin conversión ninguna.
//
// Por eso aquí ya no hay `zonas`: no hay nada que contar. Lo que el juego
// necesita de este índice es el NOMBRE (para la ruta), la ETIQUETA (para el
// profe) y el TEMA (para que elegir entre 43 no sea un muro).

/** @typedef {{nombre: string, label: string, archivo: string, tema: string}} Dibujo */

/** Los temas, en el orden en que se ofrecen. Es DATO y no una lista suelta en la
 *  vista: el editor los pinta en este orden y el test comprueba que todas las
 *  láminas caen en uno declarado. */
export const TEMAS = [
  { id: 'animales',   label: 'Animales' },
  { id: 'frutas',     label: 'Frutas y verduras' },
  { id: 'naturaleza', label: 'Naturaleza' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'cosas',      label: 'Cosas' },
];

/** @type {Dibujo[]} */
export const DIBUJOS = [
  // animales
  { nombre: 'mariposa', label: 'Mariposa', archivo: 'mariposa.svg', tema: 'animales' },
  { nombre: 'gato', label: 'Gato', archivo: 'gato.svg', tema: 'animales' },
  { nombre: 'perro', label: 'Perro', archivo: 'perro.svg', tema: 'animales' },
  { nombre: 'pez', label: 'Pez', archivo: 'pez.svg', tema: 'animales' },
  { nombre: 'tortuga', label: 'Tortuga', archivo: 'tortuga.svg', tema: 'animales' },
  { nombre: 'abeja', label: 'Abeja', archivo: 'abeja.svg', tema: 'animales' },
  { nombre: 'elefante', label: 'Elefante', archivo: 'elefante.svg', tema: 'animales' },
  { nombre: 'leon', label: 'León', archivo: 'leon.svg', tema: 'animales' },
  { nombre: 'rana', label: 'Rana', archivo: 'rana.svg', tema: 'animales' },
  { nombre: 'pinguino', label: 'Pingüino', archivo: 'pinguino.svg', tema: 'animales' },
  { nombre: 'caracol', label: 'Caracol', archivo: 'caracol.svg', tema: 'animales' },
  { nombre: 'buho', label: 'Búho', archivo: 'buho.svg', tema: 'animales' },
  // frutas
  { nombre: 'manzana', label: 'Manzana', archivo: 'manzana.svg', tema: 'frutas' },
  { nombre: 'platano', label: 'Plátano', archivo: 'platano.svg', tema: 'frutas' },
  { nombre: 'fresa', label: 'Fresa', archivo: 'fresa.svg', tema: 'frutas' },
  { nombre: 'uvas', label: 'Uvas', archivo: 'uvas.svg', tema: 'frutas' },
  { nombre: 'zanahoria', label: 'Zanahoria', archivo: 'zanahoria.svg', tema: 'frutas' },
  { nombre: 'sandia', label: 'Sandía', archivo: 'sandia.svg', tema: 'frutas' },
  { nombre: 'pera', label: 'Pera', archivo: 'pera.svg', tema: 'frutas' },
  { nombre: 'pina', label: 'Piña', archivo: 'pina.svg', tema: 'frutas' },
  // naturaleza
  { nombre: 'flor', label: 'Flor', archivo: 'flor.svg', tema: 'naturaleza' },
  { nombre: 'arbol', label: 'Árbol', archivo: 'arbol.svg', tema: 'naturaleza' },
  { nombre: 'sol', label: 'Sol', archivo: 'sol.svg', tema: 'naturaleza' },
  { nombre: 'estrella', label: 'Estrella', archivo: 'estrella.svg', tema: 'naturaleza' },
  { nombre: 'hoja', label: 'Hoja', archivo: 'hoja.svg', tema: 'naturaleza' },
  { nombre: 'nube', label: 'Nube', archivo: 'nube.svg', tema: 'naturaleza' },
  { nombre: 'girasol', label: 'Girasol', archivo: 'girasol.svg', tema: 'naturaleza' },
  { nombre: 'cactus', label: 'Cactus', archivo: 'cactus.svg', tema: 'naturaleza' },
  // transporte
  { nombre: 'coche', label: 'Coche', archivo: 'coche.svg', tema: 'transporte' },
  { nombre: 'autobus', label: 'Autobús', archivo: 'autobus.svg', tema: 'transporte' },
  { nombre: 'bicicleta', label: 'Bicicleta', archivo: 'bicicleta.svg', tema: 'transporte' },
  { nombre: 'avion', label: 'Avión', archivo: 'avion.svg', tema: 'transporte' },
  { nombre: 'tren', label: 'Tren', archivo: 'tren.svg', tema: 'transporte' },
  { nombre: 'cohete', label: 'Cohete', archivo: 'cohete.svg', tema: 'transporte' },
  { nombre: 'barco', label: 'Barco', archivo: 'barco.svg', tema: 'transporte' },
  { nombre: 'tractor', label: 'Tractor', archivo: 'tractor.svg', tema: 'transporte' },
  // cosas
  { nombre: 'casa', label: 'Casa', archivo: 'casa.svg', tema: 'cosas' },
  { nombre: 'globo', label: 'Globo', archivo: 'globo.svg', tema: 'cosas' },
  { nombre: 'regalo', label: 'Regalo', archivo: 'regalo.svg', tema: 'cosas' },
  { nombre: 'osito', label: 'Osito', archivo: 'osito.svg', tema: 'cosas' },
  { nombre: 'camiseta', label: 'Camiseta', archivo: 'camiseta.svg', tema: 'cosas' },
  { nombre: 'paraguas', label: 'Paraguas', archivo: 'paraguas.svg', tema: 'cosas' },
  { nombre: 'reloj', label: 'Reloj', archivo: 'reloj.svg', tema: 'cosas' },
];

/** Las láminas de un tema, en el orden del banco. */
/** @param {string} tema @returns {Dibujo[]} */
export const dibujosDe = (tema) => DIBUJOS.filter(d => d.tema === tema);

/** Ruta de una lámina de COLOREAR, relativa a la RAÍZ del sitio (para `fetch`,
 *  igual que otros assets estáticos). `null` si el nombre no está en el banco —
 *  quien llama decide el respaldo (la primera).
 *
 *  Dos variantes del mismo dibujo: `'linea'` es el contorno sobre el que se
 *  pinta y `'color'` la ilustración terminada, que se usa en la pantalla de fin
 *  y en las miniaturas donde interesa enseñar el resultado. */
/** @param {string|null|undefined} nombre @param {'linea'|'color'} [variante] @returns {string|null} */
export function rutaDibujo(nombre, variante = 'linea') {
  const d = DIBUJOS.find(x => x.nombre === nombre);
  if (!d) return null;
  const f = variante === 'color' ? d.archivo.replace(/\.svg$/, '-color.svg') : d.archivo;
  return `assets/juegos/dibujos/${f}`;
}

// ── EL OTRO BANCO: las láminas CON ZONAS, de Rompecabezas ────────────────────
//
// SE SEPARARON EN v1.51.704, y el motivo es que los dos juegos dejaron de
// querer el mismo arte. Colorear pinta ENCIMA de una línea: cuanto mejor sea la
// ilustración, mejor. Rompecabezas RECORTA la figura en piezas, y para eso
// necesita saber dónde está el dibujo dentro del lienzo — lo deduce de las
// zonas `data-color`, que son las que dejan recortar el aire sobrante y evitan
// piezas vacías. Las láminas de OpenMoji son línea pura y no tienen ninguna.
//
// Compartir un banco que sirve a medias a los dos habría degradado el puzzle en
// silencio (piezas en blanco, recorte sin ajustar) para no tocar una regla. Son
// dos colecciones con dos contratos, y se dicen.
//
// Estas ocho son las originales, dibujadas a mano. Siguen siendo geométricas y
// feas —el mismo problema que el dueño señaló— pero cumplen SU contrato: el
// puzzle funciona. Cambiarlas por arte de verdad pide enseñarle a
// `viewBoxAjustado` a encontrar la figura sin `data-color`, y eso es una tanda
// aparte (docs/handoff-juegos-inicial.md §7e).

/** @type {Dibujo[]} */
export const DIBUJOS_PUZZLE = [
  { nombre: 'casa',     label: 'Casa',     archivo: 'casa.svg',     tema: 'cosas' },
  { nombre: 'pez',      label: 'Pez',      archivo: 'pez.svg',      tema: 'animales' },
  { nombre: 'flor',     label: 'Flor',     archivo: 'flor.svg',     tema: 'naturaleza' },
  { nombre: 'coche',    label: 'Coche',    archivo: 'coche.svg',    tema: 'transporte' },
  { nombre: 'globo',    label: 'Globos',   archivo: 'globo.svg',    tema: 'cosas' },
  { nombre: 'gato',     label: 'Gato',     archivo: 'gato.svg',     tema: 'animales' },
  { nombre: 'sol',      label: 'Sol',      archivo: 'sol.svg',      tema: 'naturaleza' },
  { nombre: 'mariposa', label: 'Mariposa', archivo: 'mariposa.svg', tema: 'animales' },
];

/** Ruta de una lámina CON ZONAS (Rompecabezas). @param {string|null|undefined} nombre @returns {string|null} */
export function rutaDibujoPuzzle(nombre) {
  const d = DIBUJOS_PUZZLE.find(x => x.nombre === nombre);
  return d ? `assets/juegos/dibujos/zonas/${d.archivo}` : null;
}
