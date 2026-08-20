// MODELO `words` — palabras, y qué hace falta para que una palabra JUEGUE.
//
// Dos plantillas comparten este modelo y no piden lo mismo:
//   · Sopa de Letras guarda CADENAS sueltas y coloca ella al generar la rejilla.
//   · Crucigrama guarda FICHAS `{word, clue, row, col, dir}`: sin sitio en la
//     rejilla, la palabra no existe para el juego.
//
// Este fichero existe porque ese «sin sitio no existe» estaba escrito CUATRO
// veces —el player, el preview del editor, el payload de ronda y el revisor— y
// las copias ya habían empezado a divergir (unas exigían `word`, otras no). Es
// justo el fallo que el revisor advierte de sí mismo: si el guardián y el player
// no comparten la regla, el guardián aprueba lo que el player luego descarta en
// silencio, y el profe ve «No hay palabras configuradas» con la lista llena.
//
// Capa CONTENIDO: lo puede importar el core, el kernel y cualquier plantilla.

/** ¿Es una ficha de crucigrama (con pista) o una palabra suelta de la sopa? */
export function esFicha(w) {
  return !!w && typeof w === 'object' && 'clue' in w;
}

/** ¿Tiene sitio en la rejilla? Es la vara que usa el juego para dejarla entrar. */
export function palabraColocada(w) {
  return !!w && typeof w === 'object' && w.row != null && w.col != null && !!w.dir;
}

/** Lo que el crucigrama puede jugar: ficha con palabra Y con sitio. */
export function palabraJugable(w) {
  return palabraColocada(w) && !!w.word;
}
