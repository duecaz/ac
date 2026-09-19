// CARGAR la imagen del rompecabezas — «nombre del banco → data: URL lista para
// jugar». Es UNA función (§21b) porque la necesitan igual el PLAYER (el
// tablero) y el EDITOR (las miniaturas de los legados, que prometen enseñar
// «lo que se va a jugar»): cada uno tenía su copia de fetch → escena → pipeline
// y ya divergían (el editor no medía la caja). Vive aparte de `game/imagen.js`
// porque ese módulo es PURO (Node lo prueba) y aquí hace falta el navegador:
// `getBBox()` y `fetch`.
import { rutaDibujoPuzzle, rutaDibujo, temaDe } from '../../core/bancoDibujos.js';
import { registrarFalloDeRed } from '../../core/errorLog.js';
import { mensajeDe } from '../../core/frontera.js';
import { escenaColorDe } from '../../core/escenasDibujo.js';
import { svgParaPuzzle, tieneZonas } from './game/imagen.js';

/**
 * La caja envolvente REAL de un SVG, medida por el navegador: se monta en un
 * contenedor oculto (oculto por `visibility`, no por `display:none` — sin
 * caja de layout `getBBox()` devuelve ceros), se lee `getBBox()` del `<svg>`
 * raíz —en unidades de usuario, es decir, en coordenadas del `viewBox`, con
 * las transformaciones de los hijos ya aplicadas (las láminas de OpenMoji
 * llevan un `scale(1.38889)`, que un parser del texto no vería)— y se quita.
 * El texto es un asset propio del sitio (`assets/juegos/dibujos/`), no
 * contenido del usuario.
 * @param {string} texto
 * @returns {import('./game/imagen.js').Bbox|null}
 */
function cajaDeSvg(texto) {
  const cont = document.createElement('div');
  cont.style.cssText = 'position:absolute;visibility:hidden;width:100px;height:100px;overflow:hidden;';
  cont.innerHTML = texto;
  document.body.appendChild(cont);
  try {
    const svg = cont.querySelector('svg');
    const b = svg instanceof SVGGraphicsElement ? svg.getBBox() : null;
    // Una caja sin área (SVG vacío o sin pintar) no sirve para recortar:
    // mejor sin caja (viaja tal cual) que un viewBox de lado cero.
    return b && b.width > 0 && b.height > 0
      ? { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height }
      : null;
  } finally {
    cont.remove();
  }
}

/**
 * La imagen que juega el rompecabezas para un dibujo del banco, o `null` si el
 * nombre no está en ningún banco (contenido viejo) o la red falla: quien
 * llama decide cómo lo dice (el player pinta su aviso, R6).
 *
 * El banco legado (con zonas `data-color`) trae la caja en el texto; las
 * láminas de OpenMoji no, y se mide con `cajaDeSvg`. Lo discrimina el propio
 * texto (`tieneZonas`), no de qué lista salió el nombre. En los dos casos la
 * figura se compone sobre el DECORADO de su tema (§8d del handoff: la imagen
 * llena el marco, o las esquinas del tablero son piezas en blanco).
 * @param {string} nombre @returns {Promise<string|null>}
 */
export async function imagenDe(nombre) {
  const ruta = rutaDibujoPuzzle(nombre) ?? rutaDibujo(nombre, 'color');
  if (!ruta) return null;
  // El fallo se DICE dos veces y no es repetir: quien llama pinta el aviso para
  // el niño («no se pudo cargar el dibujo»), y esto deja la URL y el código en
  // el registro, que es lo que viaja en el informe de QA. Sin la segunda, un
  // compañero reportó «ya no está el molde para poner las piezas» con un 404 en
  // la consola y el informe decía «errores: ninguno registrado» (ronda
  // 2026-09-18): la nota no se podía accionar porque no nombraba el fichero.
  /** @type {Response} */
  let res;
  try {
    res = await fetch(ruta);
  } catch (e) {
    registrarFalloDeRed(ruta, mensajeDe(e));
    return null;
  }
  if (!res.ok) { registrarFalloDeRed(ruta, `HTTP ${res.status}`); return null; }
  const texto = await res.text();
  return svgParaPuzzle(texto, {
    caja: tieneZonas(texto) ? null : cajaDeSvg(texto),
    escena: escenaColorDe(temaDe(nombre)),
  });
}
