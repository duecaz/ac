// LAS ESCENAS DE LOS JUEGOS DE INICIAL — el decorado que rodea a la figura.
//
// POR QUÉ (dueño, 2026-09-18). La hoja de Colorear era un cuadrado blanco con
// el animal en medio: «un fondo de campo, bosque, escuela o algo». Y enseguida
// la condición que lo define todo: «para que los alumnos pinten también, si no
// tendrían que pintar ese fondo blanco nada más».
//
// Por eso el decorado es LÍNEA, no un dibujo ya coloreado ni un degradado: si
// el fondo viniera pintado, el niño solo podría colorear la figura y el resto
// sería un adorno que le quita sitio. Así el suelo, el sol, los árboles y la
// ventana del aula son tan pintables como el elefante — la hoja entera es
// trabajo, que es justo lo que es una lámina de colorear de verdad.
//
// EL TRAZO ES MÁS FINO que el de la figura (1,6 contra 2) a propósito: el
// decorado tiene que quedar DETRÁS a la vista, o compite con el protagonista.
// No se usa opacidad para eso — un trazo gris claro se pierde en un proyector
// descalibrado, y además al pintarlo por debajo el color sí se ve entero.
//
// DOS VARIANTES DE LA MISMA ESCENA (§21b: una geometría, dos lecturas).
// `escenaDe(tema)` es la de LÍNEA (Colorear). `escenaColorDe(tema)` es la
// COLOREADA PLANA para el Rompecabezas: cielo y suelo rellenos y las formas
// cerradas con su color, sin cambiar ni un punto. La pide una medida, no un
// gusto: el recorte del aire no arregla la FORMA (un sol es redondo y las
// esquinas del cuadrado quedan al 4 % de tinta, medido en 39 de 51 dibujos), y
// lo que hacen los rompecabezas de verdad es que la imagen LLENE el marco. Las
// formas que llevan color lo DECLARAN con `data-fill` en el propio dato: en la
// variante de línea ese atributo es inerte (el `fill="none"` manda), en la
// coloreada se convierte en el `fill`. Una sola lista de formas; dos salidas.
//
// CADA ESQUINA TIENE LO SUYO, a propósito. Medido (sonda de piezas 3×3, v1.51.711):
// con el sol a la izquierda y la nube a la derecha pero el mismo prado abajo,
// 49 de 51 dibujos daban DOS piezas casi idénticas (las dos de abajo, o las dos
// de arriba en las figuras redondas). En el rompecabezas cada esquina tiene que
// ser una pieza distinta o el niño no puede saber cuál va dónde: arriba a la
// izquierda una cosa (sol · ventana), arriba a la derecha otra (nube · reloj),
// abajo a la izquierda otra (flores · seta · pelota) y abajo a la derecha otra
// (valla · arbusto · maceta). Los elementos viven en los bordes (x<30 o x>70)
// porque el centro es de la figura.
//
// Van como texto y no como ficheros sueltos: son cinco fragmentos de unas pocas
// líneas, se prueban en Node sin red, y ahorran una segunda petición justo en el
// arranque del juego. Lienzo 0 0 100 100, el mismo del banco; el SUELO está a
// y=78, que es la línea sobre la que el player apoya la figura.

/** La altura del suelo en el lienzo de 100×100. La comparten los players para
 *  apoyar la figura encima en vez de dejarla flotando. */
export const SUELO = 78;

const T = 'fill="none" stroke="#222" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

/** Los colores planos de cada tema, para la variante coloreada: el cielo (o la
 *  pared), el suelo (o la mesa) y el de las formas cerradas que no declaran el
 *  suyo. Planos y claros: la figura de OpenMoji va encima y tiene que mandar.
 *  @type {Record<string, {cielo: string, suelo: string}>} */
const PALETA = {
  animales:   { cielo: '#cfe9ff', suelo: '#a8dc8a' },
  naturaleza: { cielo: '#d6ecff', suelo: '#9ccf7a' },
  frutas:     { cielo: '#fff3d6', suelo: '#e8b86d' },
  transporte: { cielo: '#d9ecff', suelo: '#8f8f8f' },
  cosas:      { cielo: '#fbe7d8', suelo: '#c9a27a' },
};

// Piezas sueltas que se repiten entre escenas: UNA escritura (§21b).
const SOL = `
    <circle ${T} data-fill="#ffd54f" cx="15" cy="15" r="7"/>
    <path ${T} d="M15 4v-3M15 29v-3M26 15h3M1 15h3M23 7l2-2M5 23l2-2M23 23l2 2M5 7l2-2"/>`;
/** @param {number} x @param {number} y */
const NUBE = (x, y) => `
    <path ${T} data-fill="#ffffff" d="M${x} ${y}q4 -5 8 0 5 -1 5 4h-18q0 -5 5 -4z"/>`;
/** @param {number} x @param {number} y */
const FLOR = (x, y) => `
    <path ${T} d="M${x} ${y}v-8"/>
    <circle ${T} data-fill="#ff8fab" cx="${x}" cy="${y - 10}" r="3"/>`;

/** @type {Record<string, string>} */
const ESCENAS = {
  // CAMPO — sol, nube, colinas; abajo flores a la izquierda y una valla a la
  // derecha. El suelo ondula un poco: una raya recta de lado a lado parece un
  // error de imprenta, no un prado.
  animales: `
    <path ${T} d="M0 ${SUELO}q14 -6 27 0t27 0 27 -1 19 1"/>${SOL}${NUBE(74, 14)}
    <path ${T} d="M8 ${SUELO}v-5M11 ${SUELO}v-7M14 ${SUELO}v-4"/>${FLOR(8, 96)}${FLOR(16, 97)}
    <path ${T} d="M92 ${SUELO}v-12"/>
    <circle ${T} data-fill="#6cbf5a" cx="92" cy="59" r="7"/>
    <path ${T} d="M80 96v-12M88 96v-12M96 96v-12M76 87h22M76 92h22"/>`,
  // BOSQUE — un árbol grande a la izquierda, nube y pájaro a la derecha; abajo
  // una seta a la izquierda y un arbusto a la derecha.
  naturaleza: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M12 ${SUELO}v-14"/>
    <path ${T} data-fill="#6cbf5a" d="M12 64q-10 0 -10 -9 0 -8 7 -9 0 -9 9 -9t9 9q7 1 7 9 0 9 -10 9z"/>${SOL}${NUBE(76, 12)}
    <path ${T} d="M70 26q3 -3 6 0M76 26q3 -3 6 0"/>
    <path ${T} d="M11 96v-6h4v6"/>
    <path ${T} data-fill="#ff6b6b" d="M6 90q7 -9 14 0z"/>
    <path ${T} data-fill="#6cbf5a" d="M80 96q-3 -8 4 -9 2 -5 7 -3 5 -2 6 4 4 3 0 8z"/>
    <path ${T} d="M2 ${SUELO}q6 -4 12 0"/>`,
  // MESA — la fruta sobre una mesa con mantel; arriba un tarro en su balda a la
  // izquierda y una ventana a la derecha; debajo de la mesa, las patas, con una
  // cesta a la izquierda y un taburete a la derecha.
  frutas: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M6 ${SUELO}l4 16M94 ${SUELO}l-4 16"/>
    <path ${T} d="M0 ${SUELO}q8 5 16 0t16 0 16 0 16 0 16 0 16 0"/>
    <path ${T} d="M4 22h22"/>
    <path ${T} data-fill="#bfe3ff" d="M9 22v-9q0 -2 2 -2h6q2 0 2 2v9z"/>
    <path ${T} d="M7 40h2"/>
    <rect ${T} data-fill="#ff8fab" x="4" y="41" width="8" height="14" rx="1"/>
    <rect ${T} data-fill="#bfe3ff" x="72" y="8" width="20" height="18" rx="2"/>
    <path ${T} d="M82 8v18M72 17h20"/>
    <path ${T} data-fill="#d9a066" d="M14 96q0 -6 4 -6h6q4 0 4 6z"/>
    <path ${T} d="M76 90h14M78 90v6M88 90v6"/>`,
  // CARRETERA — sol y nube arriba; una señal a la izquierda, un semáforo a la
  // derecha; en la calzada la raya discontinua (se pinta como todo) y abajo
  // una piedra a la derecha.
  transporte: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M0 ${SUELO + 14}h100"/>
    <path ${T} d="M8 ${SUELO + 7}h10M30 ${SUELO + 7}h10M52 ${SUELO + 7}h10M74 ${SUELO + 7}h10"/>${SOL}${NUBE(74, 14)}
    <path ${T} d="M12 ${SUELO}v-14"/>
    <rect ${T} data-fill="#ffffff" x="6" y="56" width="12" height="8" rx="1"/>
    <path ${T} d="M90 ${SUELO}v-22"/>
    <rect ${T} data-fill="#555555" x="86" y="40" width="8" height="16" rx="2"/>
    <circle ${T} data-fill="#ff6b6b" cx="90" cy="44" r="1.6"/>
    <circle ${T} data-fill="#ffd54f" cx="90" cy="48" r="1.6"/>
    <circle ${T} data-fill="#6cbf5a" cx="90" cy="52" r="1.6"/>
    <path ${T} data-fill="#9a9a9a" d="M84 98q0 -4 5 -4t5 4z"/>`,
  // AULA — ventana a la izquierda, reloj a la derecha; abajo una pelota a la
  // izquierda y una maceta a la derecha; el zócalo de la pared. «Escuela»,
  // que era una de las tres que pidió el dueño.
  cosas: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M0 ${SUELO + 6}h100"/>
    <rect ${T} data-fill="#bfe3ff" x="6" y="10" width="22" height="20" rx="2"/>
    <path ${T} d="M17 10v20M6 20h22"/>
    <circle ${T} data-fill="#ffffff" cx="86" cy="18" r="7"/>
    <path ${T} d="M86 18v-4M86 18h3"/>
    <rect ${T} data-fill="#ffe08a" x="4" y="44" width="12" height="10" rx="1"/>
    <path ${T} d="M6 52l3 -4 2 2 3 -3"/>
    <circle ${T} data-fill="#ff6b6b" cx="12" cy="91" r="5"/>
    <path ${T} d="M7 91q5 -3 10 0"/>
    <path ${T} data-fill="#d9a066" d="M84 ${SUELO}v-9h8v9"/>
    <path ${T} data-fill="#6cbf5a" d="M88 ${SUELO - 9}q-7 -2 -6 -9 6 0 6 6 0 -7 6 -7 1 8 -6 10z"/>
    <path ${T} d="M84 96h8"/>`,
};

/** El decorado de LÍNEA de un tema, o cadena vacía si no hay ninguno (una
 *  lámina sin tema declarado se colorea sobre la hoja limpia, que es un
 *  respaldo honrado y no una pantalla rota).
 *  @param {string|null|undefined} tema @returns {string} */
export const escenaDe = (tema) => (tema && ESCENAS[tema]) || '';

/** El MISMO decorado, coloreado plano: cielo y suelo rellenos, y cada forma
 *  con `data-fill` pintada de su color. Sin tema, cadena vacía (el
 *  rompecabezas juega entonces la figura sola sobre el tablero, como antes).
 *  @param {string|null|undefined} tema @returns {string} */
export function escenaColorDe(tema) {
  const linea = escenaDe(tema);
  const paleta = tema ? PALETA[tema] : undefined;
  if (!linea || !paleta) return '';
  const formas = linea.replace(/fill="none"([^>]*?)data-fill="(#[0-9a-f]{6})"/g, 'fill="$2"$1');
  return `<rect x="0" y="0" width="100" height="100" fill="${paleta.cielo}"/>`
    + `<rect x="0" y="${SUELO}" width="100" height="${100 - SUELO}" fill="${paleta.suelo}"/>`
    + formas;
}

/** Los temas que tienen decorado — lo usa el test para comprobar que no queda
 *  ninguno sin escena. */
export const TEMAS_CON_ESCENA = Object.keys(ESCENAS);

// ── La figura sobre su escena ────────────────────────────────────────────
// La composición es UNA para los dos juegos (§21b): Colorear la usaba con un
// `<g transform="translate scale(0.7)">` y el puzzle con un `<svg>` anidado al
// 72 %; dos dueños de «dónde se apoya la figura» que ya no coincidían.

/** El lado de la figura dentro del lienzo 100×100 de la escena. */
const LADO_FIGURA = 72;
/** Dónde vive la figura: centrada, con aire a los lados y los pies en el
 *  SUELO (`preserveAspectRatio` alinea por abajo). Es un dato de composición,
 *  no de estilo: no es CSS ni px. */
export const CAJA_FIGURA = { x: (100 - LADO_FIGURA) / 2, y: SUELO - LADO_FIGURA, w: LADO_FIGURA, h: LADO_FIGURA };

/**
 * Compone la figura (un SVG completo) sobre la escena (un fragmento de SVG en
 * el lienzo 0 0 100 100), devolviendo un SVG completo. Puro: el `<svg>` de la
 * figura se ANIDA con su `viewBox` tal cual — así un recorte previo del
 * viewBox sigue mandando y no se reescribe ni una coordenada del dibujo. Sin
 * escena, o con una figura sin `<svg>` reconocible, la figura viaja tal cual
 * (contra-prueba en tests/puzzle.test.mjs).
 * @param {string} figuraSvg
 * @param {string} escena
 * @returns {string}
 */
export function componerEscena(figuraSvg, escena) {
  if (!escena) return figuraSvg;
  const m = String(figuraSvg ?? '').match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!m) return figuraSvg;
  const vb = (m[1].match(/viewBox\s*=\s*"([^"]*)"/) || [])[1] || '0 0 100 100';
  const { x, y, w, h } = CAJA_FIGURA;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
    + escena
    + `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}" preserveAspectRatio="xMidYMax meet">${m[2]}</svg>`
    + `</svg>`;
}
