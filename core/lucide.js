// ICONOS LUCIDE, EN LÍNEA — y en UN solo sitio.
//
// El dueño lo pidió así (2026-08-15: «usa iconos lucide») y se pegan como SVG
// en vez de cargar la librería: la app no depende de la red —la misma lección
// que la CDN de Bootstrap y las webfonts—, y con la clase delante un icono que
// no llega es un mando invisible.
//
// Vivían dentro de `core/textCorrectionRound.js` (lápiz y borrador). Al pedir
// el dueño un reloj y un «maximizar» de Lucide (2026-09-02, con maqueta), el
// ayudante de `svgLucide` iba a quedar tecleado en tres módulos: es justo lo
// que caza el barrido B5 (§21b). Aquí es UNO.
//
// `stroke="currentColor"` deja que el color lo ponga el token del skin (§3), y
// `width/height` en `em` que el icono crezca con la letra del mando que lo
// aloja — sin CSS que acordarse de añadir en cada sitio nuevo.
// Fuente: lucide.dev · licencia ISC.

const D = {
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  eraser: '<path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/>',
  // `timer` (cronómetro con pulsador) y no `clock` (esfera con agujas): el dato
  // es «cuánto queda de ESTA frase», no la hora. Se lee de un vistazo a 3 m.
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  // Las cuatro ESQUINAS, no las cuatro flechas en diagonal: es el icono de
  // «expandir» que reconoce cualquiera de un vídeo, y el que traía la maqueta.
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  minimize: '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
};

/** SVG en línea de un icono de Lucide, listo para meter en una plantilla.
 *  @param {keyof typeof D} nombre
 *  @param {{clase?: string}} [o]  clase extra, si el sitio la necesita.
 *  @returns {string} el `<svg>`; cadena vacía si el nombre no existe (nunca
 *         rompe la pantalla por un icono, pero se ve que falta). */
export function lucide(nombre, { clase = '' } = {}) {
  const d = D[nombre];
  if (!d) return '';
  // `1em`: el icono crece con la letra del mando que lo aloja, sin CSS que
  // acordarse de añadir en cada sitio nuevo.
  return `<svg class="ww-ico${clase ? ' ' + clase : ''}" width="1em" height="1em"`
    + ` viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"`
    + ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}

/** Los nombres disponibles — lo usan los tests para no citar un icono que no
 *  existe (un icono que no llega es un mando invisible). */
export const ICONOS = Object.keys(D);
