// LEER UNA HOJA DE ESTILOS — una sola lectura, varios vigilantes.
//
// Dos suites vigilan LOS MISMOS ficheros (`themes/*/skin.css`) y hasta hoy cada
// una traía su propio lector:
//   · `tests/temaPorTokens.test.mjs`  — ¿el tema PINTA dentro de una plantilla?
//   · `tests/temaSinMedidas.test.mjs` — ¿el tema MIDE una caja compartida?
// Con dos lectores privados las dos leyes veían hojas distintas, y no en teoría:
// uno saltaba las reglas dentro de `@media`/`@container` y el otro no. Peor aún,
// cada uno tenía su propia idea de QUIÉN RECIBE LA PINTURA («el sujeto» del
// selector) — la definición sobre la que descansa que el ratchet de arcade esté
// en CERO. Dos ratchets que no se ponen de acuerdo en qué miran no son dos redes:
// son una red con un agujero del tamaño de la diferencia.
//
// Aquí vive UNA vez. Si mañana hay que entender selectores escapados o `:is()`,
// se arregla en un sitio y las dos leyes se enteran.

/** Bloques `selector { … }` de una hoja, sin comentarios.
 *  Incluye los que viven dentro de `@media`/`@container`: una regla no deja de
 *  invadir por estar en un breakpoint (era la diferencia entre los dos lectores). */
export function reglas(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    // Un `@media …{` deja el propio at-rule como «selector» con cuerpo vacío;
    // se descarta por no tener propiedades, no por una lista de nombres.
    .map(m => ({
      selector: m[1].trim().replace(/\s+/g, ' '),
      props: m[2].split(';').map(p => p.split(':')[0].trim()).filter(Boolean),
      cuerpo: m[2],
    }))
    .filter(r => !r.selector.startsWith('@'));
}

/** Las clases que aparecen en un trozo de CSS o en un selector. */
export const clasesDe = (txt) =>
  [...txt.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]);

/**
 * EL SUJETO de un selector: el compuesto que de verdad recibe la pintura.
 *
 *   `.ww-lite .vs-arena::before`   → `.vs-arena::before`
 *   `.vs-skin-x .ww-key i`         → `.ww-key`   (si el último no lleva clase,
 *                                                 manda el más cercano que sí)
 *
 * Lo segundo importa: pintar el `<i>` que va DENTRO de una tecla es pintar la
 * tecla, y mirando solo la última parte esa familia entera quedaba invisible.
 *
 * Se le pasa UN selector, no una lista separada por comas: quien lea la hoja
 * debe partir por comas primero (seis invasiones disfrazadas de una es
 * justamente lo que un ratchet no puede permitirse).
 */
export function sujetoDe(sel, relevante) {
  const partes = sel.trim().split(/\s+|>|\+|~/).filter(Boolean);
  // El guard no es paranoia: `lista.map(sujetoDe)` le pasa el ÍNDICE como
  // segundo argumento y el predicado acababa siendo un número. Costó un rojo.
  if (typeof relevante === 'function') {
    // Con predicado, se camina hacia la izquierda hasta el compuesto que de
    // verdad decide. Sin él, `.skin-x .ww-key span.brillo` paraba en `.brillo`
    // —una clase que no es de nadie— y la regla se escapaba entera.
    const hallado = partes.findLast(p => clasesDe(p).some(relevante));
    if (hallado) return hallado;
  }
  return partes.findLast(p => p.includes('.')) ?? partes.at(-1) ?? '';
}

/** Los selectores sueltos de una regla (`a, b, c` → tres). */
export const selectoresDe = (sel) =>
  sel.split(',').map(x => x.trim()).filter(Boolean);
