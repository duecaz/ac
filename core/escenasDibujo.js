// LAS ESCENAS DE COLOREAR — el decorado que rodea a la lámina.
//
// POR QUÉ (dueño, 2026-09-18). La hoja era un cuadrado blanco con el animal en
// medio: «un fondo de campo, bosque, escuela o algo». Y enseguida la condición
// que lo define todo: «para que los alumnos pinten también, si no tendrían que
// pintar ese fondo blanco nada más».
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
// Van como texto y no como ficheros sueltos: son cinco fragmentos de unas pocas
// líneas, se prueban en Node sin red, y ahorran una segunda petición justo en el
// arranque del juego. Lienzo 0 0 100 100, el mismo del banco; el SUELO está a
// y=78, que es la línea sobre la que el player apoya la figura.

/** La altura del suelo en el lienzo de 100×100. La comparte el player para
 *  apoyar la figura encima en vez de dejarla flotando. */
export const SUELO = 78;

const T = 'fill="none" stroke="#222" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

/** @type {Record<string, string>} */
const ESCENAS = {
  // CAMPO — sol, colinas y matas. El suelo ondula un poco: una raya recta de
  // lado a lado parece un error de imprenta, no un prado.
  animales: `
    <path ${T} d="M0 ${SUELO}q14 -6 27 0t27 0 27 -1 19 1"/>
    <circle ${T} cx="16" cy="15" r="7"/>
    <path ${T} d="M16 4v-3M16 29v-3M27 15h3M2 15h3M24 7l2-2M6 23l2-2M24 23l2 2M6 7l2-2"/>
    <path ${T} d="M8 ${SUELO}v-5M11 ${SUELO}v-7M14 ${SUELO}v-4"/>
    <path ${T} d="M86 ${SUELO}v-5M89 ${SUELO}v-7M92 ${SUELO}v-4"/>
    <path ${T} d="M70 14q4 -5 8 0 5 -1 5 4h-18q0 -5 5 -4z"/>`,
  // BOSQUE — dos árboles a los lados, que dejan el centro libre para la figura.
  naturaleza: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M10 ${SUELO}v-14M10 64q-9 0 -9 -8 0 -7 6 -8 0 -8 8 -8t8 8q6 1 6 8 0 8 -9 8z"/>
    <path ${T} d="M90 ${SUELO}v-11M90 67q-7 0 -7 -6 0 -5 5 -6 0 -6 6 -6t6 6q5 1 5 6 0 6 -7 6z"/>
    <path ${T} d="M42 12q4 -5 8 0 5 -1 5 4h-18q0 -5 5 -4z"/>
    <path ${T} d="M2 ${SUELO}q6 -4 12 0M86 ${SUELO}q6 -4 12 0"/>`,
  // MESA — la fruta se colorea sobre una mesa con mantel, no flotando.
  frutas: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M6 ${SUELO}l4 16M94 ${SUELO}l-4 16"/>
    <path ${T} d="M0 ${SUELO}q8 5 16 0t16 0 16 0 16 0 16 0 16 0"/>
    <path ${T} d="M14 ${SUELO - 4}h10M76 ${SUELO - 4}h10"/>
    <path ${T} d="M38 10q5 -6 10 0 6 -1 6 5h-22q0 -6 6 -5z"/>`,
  // CARRETERA — horizonte, calzada y dos postes. La discontinua va en el suelo,
  // así que el que pinta puede darle color a la raya igual que a todo.
  transporte: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M0 ${SUELO + 14}h100"/>
    <path ${T} d="M8 ${SUELO + 7}h10M30 ${SUELO + 7}h10M52 ${SUELO + 7}h10M74 ${SUELO + 7}h10"/>
    <path ${T} d="M12 ${SUELO}v-14h8"/>
    <path ${T} d="M88 ${SUELO}v-10"/>
    <path ${T} d="M62 12q4 -5 8 0 5 -1 5 4h-18q0 -5 5 -4z"/>`,
  // AULA — ventana, planta y el zócalo de la pared. «Escuela», que era una de
  // las tres que pidió el dueño.
  cosas: `
    <path ${T} d="M0 ${SUELO}h100"/>
    <path ${T} d="M0 ${SUELO + 6}h100"/>
    <rect ${T} x="6" y="10" width="22" height="20" rx="2"/>
    <path ${T} d="M17 10v20M6 20h22"/>
    <path ${T} d="M84 ${SUELO}v-9h8v9M88 ${SUELO - 9}q-7 -2 -6 -9 6 0 6 6 0 -7 6 -7 1 8 -6 10z"/>
    <path ${T} d="M62 14h26M62 20h18"/>`,
};

/** El decorado de un tema, o cadena vacía si no hay ninguno (una lámina sin
 *  tema declarado se colorea sobre la hoja limpia, que es un respaldo honrado y
 *  no una pantalla rota).
 *  @param {string|null|undefined} tema @returns {string} */
export const escenaDe = (tema) => (tema && ESCENAS[tema]) || '';

/** Los temas que tienen decorado — lo usa el test para comprobar que no queda
 *  ninguno sin escena. */
export const TEMAS_CON_ESCENA = Object.keys(ESCENAS);
