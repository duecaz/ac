// EL HUD DEL JUEGO — los INDICADORES flotan en las esquinas, el juego se queda
// con todo el alto.
//
// Nace del inventario de piezas (docs/piezas-por-actividad.md, dueño
// 2026-08-17): «n/total» estaba escrito de SIETE formas distintas y seis
// players repintaban el título de la actividad que ya está en la antesala
// (pantalla de inicio / setup / lobby / ficha de la tarea). Cada franja de
// cabecera robaba un 4-25 % del alto — exactamente lo que le falta a la zona
// de juego en un móvil en vertical.
//
// La regla (decidida con el dueño): un INDICADOR —página, tiempo,
// racha— nunca crea una franja; flota en una esquina, encima del juego, como
// el botón de pantalla completa («como en la actividad Calcular»). Solo una
// HERRAMIENTA que se toca (lápiz/borrador, deshacer, pista) justifica una
// barra (edu-topbar), y solo 3 de las 13 la tienen.
//
// Uso: el player mete `hudHtml({...})` como PRIMER hijo de su raíz — el CSS
// (styles/player.css, `:has(> .edu-hud)`) hace de esa raíz el ámbito de
// posicionamiento, sin pedirle clase. Para actualizar un dato sin re-render:
// `hudSet(root, 'tiempo', '12')` (null/'' lo esconde; el icono lo pone el chip).
//
// El HUD no captura toques (`pointer-events: none`): un globo que pase por
// debajo se sigue pudiendo explotar.
import { escapeHtml } from './html.js';
import { lucide } from './lucide.js';

// El chip del TIEMPO lleva su icono; los demás son solo texto. El icono es del
// CHIP, no del reloj: `core/reloj.js` entrega el número pelado y cada superficie
// donde se pinta decide cómo se ve (antes el «⏱ » viajaba pegado al valor, así
// que el dueño del tiempo mandaba sobre el aspecto de todas a la vez).
const ICONO = { tiempo: () => lucide('timer') };

const chip = (campo, texto) => {
  const ico = ICONO[campo]?.() || '';
  // El valor va en su propio nodo para que `hudSet` lo reescriba sin llevarse
  // por delante el icono (`textContent` sobre el chip entero lo borraría).
  return `<span class="edu-hud__chip${ico ? ' edu-hud__chip--ico' : ''}" data-hud="${campo}"${texto ? '' : ' hidden'}>`
    + `${ico}<span data-hud-val>${escapeHtml(String(texto ?? ''))}</span></span>`;
};

/**
 * Los indicadores del juego, por NOMBRE (no por posición en un markup ad hoc):
 *   pagina «3 / 8» · racha «🔥 3» · extra (p.ej. «Flips: 4») → esquina izquierda
 *   tiempo «12», con su icono de reloj                       → CENTRO
 * Todos opcionales: lo que no se pasa se pinta oculto, listo para `hudSet`.
 * El chip `puntos` («★ 40») SE RETIRÓ (dueño 2026-09-01): el puntaje ya vive en
 * la pantalla de resultado y el HUD no debe competir con el juego — «esa
 * estrella no aporta nada». El reloj va al CENTRO, no a la derecha: la esquina
 * derecha es del botón de pantalla completa y un dato que se mira cada segundo
 * merece el sitio donde el ojo ya está.
 */
export function hudHtml({ pagina, racha, extra, tiempo } = {}) {
  return `<div class="edu-hud" aria-hidden="true">
    <span class="edu-hud__zona">${chip('pagina', pagina)}${chip('racha', racha)}${chip('extra', extra)}</span>
    <span class="edu-hud__zona edu-hud__zona--centro">${chip('tiempo', tiempo)}</span>
  </div>`;
}

/** Actualiza UN indicador dentro de `scope` (Element o selector).
 *  Si una BARRA (edu-topbar) ALOJA el indicador —misma excepción declarada que
 *  el botón de pantalla completa: la barra es la dueña de su franja—, ese chip
 *  manda y el del HUD flotante se queda retirado: el reloj centrado del HUD
 *  caía justo sobre los mandos centrados de la barra (Crucigrama «Reiniciar»,
 *  Pelotas «Deshacer» — lo cazó la matriz al estrenar el centro). */
export function hudSet(scope, campo, texto) {
  const raiz = typeof scope === 'string' ? document.querySelector(scope) : scope;
  const el = raiz?.querySelector(`.edu-topbar [data-hud="${campo}"]`)
          ?? raiz?.querySelector(`.edu-hud [data-hud="${campo}"]`);
  if (!el) return;
  if (texto == null || texto === '') { el.hidden = true; return; }
  el.hidden = false;
  // Al nodo del VALOR si el chip lo tiene (el del tiempo lleva icono delante);
  // al chip entero si no. Una barra que aloje el indicador puede traer el suyo
  // con la misma forma.
  (el.querySelector('[data-hud-val]') || el).textContent = String(texto);
}

// EL RELOJ NO VIVE AQUÍ. Estuvo: `mostrarCrono()` + `cronoHud()` montaban el
// cronómetro sobre el chip `tiempo`, y la cuenta atrás la montaba cada player
// por su cuenta — dos relojes con dos dueños. Ahora hay UNO
// (`core/reloj.js`) y este módulo solo aporta el SITIO donde se pinta: el chip
// `tiempo` del HUD, vía `hudSet`.
