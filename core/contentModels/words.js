// MODELO `words` — la lista de palabras de una actividad.
//
// Lo consume la Sopa de Letras, que guarda CADENAS sueltas y coloca ella la
// rejilla al generar. Este fichero es el dueño único del «dónde está la lista»
// del modelo: antes cada sitio que tocaba `content.words` lo tecleaba por su
// cuenta (el player, el preview del editor, el payload de ronda y el revisor) y
// las copias ya habían empezado a divergir.
//
// Capa CONTENIDO: lo puede importar el core, el kernel y cualquier plantilla.

/** LAS PALABRAS DE ESTA ACTIVIDAD, lista para mutar (se siembra `words: []` si
 *  el contenido viene a medias).
 * @param {{content?: unknown}|null|undefined} a @returns {string[]} */
export function palabrasDe(a) {
  const c = /** @type {{words?: string[]}|null|undefined} */ (a?.content);
  if (!c) return [];
  if (!Array.isArray(c.words)) c.words = [];
  return c.words;
}
