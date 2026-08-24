// EL MARCO A PANTALLA COMPLETA, PARA MEDIR — uno solo, para las redes que lo usan.
//
// Varias redes miden cosas que SOLO se rompen cuando el marco es grande: el
// marcador del duelo que no crecía con la arena, y la calculadora que se
// dispersaba cuando sobraba ancho. En la ventana de siembra ninguna de las dos
// se ve, así que hay que agrandar el marco a propósito.
//
// Estaba escrito DOS VECES en `matrix-smoke`, y con él la invariante que
// importa: se pone y SE QUITA. La primera versión usaba `page.addStyleTag()`,
// que no se puede retirar — el marco se quedaba forzado para todo lo que se
// midiera después en esa misma página, y las redes de detrás (el espejo del
// marcador, el reparto del marco) medían un montaje que no existe. Con la
// hoja atada a un `id`, quitarla es una línea; teniéndola aquí, no se puede
// olvidar en el segundo sitio.
//
// LÍMITE DECLARADO: esto NO reproduce el fullscreen real del producto —
// `styles/player.css` le añade `padding: 5vmin` al contenido cuando el marco
// está de verdad en `:fullscreen`. Lo que se mide aquí es «el marco tiene mucho
// sitio», que es la condición que destapa los topes fijos, no la maqueta exacta
// del aula. Para lo que se toca con el dedo está el hit-testing del botón de la
// esquina, que sí usa el marco real.

const ID = 'ww-sonda-marco-lleno';

const CSS = '#ww-frame{position:fixed!important;inset:0!important;width:100vw!important;' +
  'height:100vh!important;max-width:none!important;aspect-ratio:auto!important;z-index:9999}';

/**
 * Agranda el marco a toda la ventana, ejecuta `medir()` y lo deja como estaba.
 *
 * @param {import('playwright').Page} page
 * @param {() => Promise<T>} medir  qué medir con el marco lleno
 * @param {number} [espera=350]  ms para que el layout se asiente antes de medir
 * @returns {Promise<T>}
 * @template T
 */
export async function conMarcoLleno(page, medir, espera = 350) {
  await page.evaluate(({ id, css }) => {
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }, { id: ID, css: CSS });
  await page.waitForTimeout(espera);
  try {
    return await medir();
  } finally {
    // En `finally`: si la medición falla, la hoja se retira igual. Si no, un
    // fallo aquí contaminaría en silencio TODO lo que se mida después.
    await page.evaluate(id => document.getElementById(id)?.remove(), ID);
    await page.waitForTimeout(250);
  }
}
