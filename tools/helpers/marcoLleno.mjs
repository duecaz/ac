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
// EL PADDING DEL FULLSCREEN REAL VA INCLUIDO. La primera versión solo estiraba el
// marco, y aquí quedó escrito como límite: «no reproduce el fullscreen real, que
// añade `padding: 5vmin`». Ese límite se cobró un fallo — con el padding los
// paneles son más estrechos y la cabecera de la calculadora dejaba de caber en su
// fila, cosa que la sonda sin padding no veía en ninguna medida. Un límite
// declarado sigue siendo un agujero: si se puede cerrar, se cierra.

const ID = 'ww-sonda-marco-lleno';

const CSS =
  '#ww-frame{position:fixed!important;inset:0!important;width:100vw!important;' +
  'height:100vh!important;max-width:none!important;aspect-ratio:auto!important;z-index:9999}' +
  // Espejo de `styles/player.css` (`.ww-player-frame:fullscreen .vs-main` y
  // `.ww-scaffold`). Si allí cambia el valor, aquí también.
  '#ww-frame .vs-main,#ww-frame .ww-scaffold{padding:5vmin!important}';

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
