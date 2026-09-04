// EL BANCO DE DIBUJOS — compartido por Colorear y Rompecabezas (§21b: un banco,
// un dueño). Vive en `core/` y no junto a los SVG porque una PLANTILLA solo puede
// importar de core/contenido (`tests/layers.test.mjs`): `assets/` es capa de
// arranque y el índice nació allí — cuatro imports cruzaban la capa.
// Los SVG siguen en `assets/juegos/dibujos/`.
//
// un contrato). Cada SVG trae sus zonas ya cerradas (`<... data-zona data-color>`,
// viewBox 0 0 100 100, trazo negro uniforme): Colorear las pinta blanco y deja que
// el niño elija el color; Rompecabezas las muestra con `data-color`, el "bonito",
// y las recorta en piezas. El contrato es SAGRADO porque lo leen los dos: si
// cambia la forma de un SVG (añadir/quitar zonas), este índice tiene que decirlo
// o el juego que ya no lo lee se descoloca en silencio — por eso `zonas` es un
// DATO verificado, no una etiqueta (tests/colorear.test.mjs lo contrasta contra
// el fichero real).
export const DIBUJOS = [
  { nombre: 'casa',      label: 'Casa',      archivo: 'casa.svg',      zonas: 4 },
  { nombre: 'pez',       label: 'Pez',       archivo: 'pez.svg',       zonas: 4 },
  { nombre: 'flor',      label: 'Flor',      archivo: 'flor.svg',      zonas: 5 },
  { nombre: 'coche',     label: 'Coche',     archivo: 'coche.svg',     zonas: 5 },
  { nombre: 'globo',     label: 'Globos',    archivo: 'globo.svg',     zonas: 4 },
  { nombre: 'gato',      label: 'Gato',      archivo: 'gato.svg',      zonas: 4 },
  { nombre: 'sol',       label: 'Sol',       archivo: 'sol.svg',       zonas: 5 },
  { nombre: 'mariposa',  label: 'Mariposa',  archivo: 'mariposa.svg',  zonas: 5 },
];

/** Ruta del SVG de un dibujo del banco, relativa a la RAÍZ del sitio (para
 *  `fetch` desde el player, igual que otros assets estáticos). `null` si el
 *  nombre no está en el banco — quien llama decide el respaldo (el primero). */
export function rutaDibujo(nombre) {
  const d = DIBUJOS.find(x => x.nombre === nombre);
  return d ? `assets/juegos/dibujos/${d.archivo}` : null;
}
