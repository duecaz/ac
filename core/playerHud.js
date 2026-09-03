// LA CABECERA DEL JUEGO — una, igual en las trece.
//
// TRES TRATAMIENTOS PARA LA MISMA FRANJA (medido el 2026-09-03, montando las 13
// en el navegador):
//   · 9 plantillas → los indicadores FLOTABAN sobre el juego y el botón de
//     pantalla completa vivía en la esquina del marco;
//   · Tildes y Comas → una BANDA con todo dentro (página · herramienta · reloj ·
//     pantalla completa), la que pidió el dueño con maqueta;
//   · Crucigrama y Pelotas → mezcla: la página flotando, el reloj alojado en su
//     barra propia, el botón en la esquina.
// Los mismos cuatro datos en tres sitios según la actividad. El dueño lo dijo
// corto: «solo estás parchando, piensa mejor» — arreglar la franja en dos de
// trece ES el parche.
//
// LA REGLA, aquí y en ningún otro sitio: **el juego tiene UNA cabecera**, y en
// ella viven, siempre en el mismo orden:
//     [herramientas de la plantilla] [página · racha · extra] … [RELOJ] … [⛶]
// La plantilla aporta SOLO sus herramientas (3 de 13 las tienen); lo demás lo
// pone esta cabecera. El reloj va centrado y GRANDE en las trece: si el número
// merece leerse desde el fondo del aula en Tildes, lo merece en el Quiz.
//
// POR QUÉ AHORA SÍ SE DIBUJA, si la ley §3b0 decía «los indicadores nunca crean
// franja»: aquella decisión (2026-08-17) buscaba ganar alto, y el alto YA se
// gastaba. `styles/player.css` reservaba `max(30px, 6.5cqmin)` arriba en cuanto
// el reloj estaba visible, para que los chips flotantes no taparan el juego. La
// franja estaba pagada y no se dibujaba: se veía un chip suelto encima del
// juego en vez de una cabecera. Lo que la ley prohibía —y sigue prohibiendo— es
// la CABECERA CON TÍTULO, que robaba entre el 4 % y el 25 % del alto.
//
// EL ASPECTO LO PONE LA SUPERFICIE QUE HAY DEBAJO, por tokens: `--cab-tinta` y
// `--cab-fondo` (por defecto los del marco). Tildes y Comas los apuntan a los
// del PAPEL, y por eso su cabecera es la banda de arriba de la hoja sin una
// sola regla duplicada. La lección ya nos costó dos capturas: lo que se dibuja
// encima de una superficie se lee con la tinta de esa superficie.
//
// Uso: el player mete `cabeceraHtml({...})` como PRIMER hijo de su raíz. Para
// actualizar sin re-render: `hudSet(root, 'pagina', '3 / 8')` y
// `relojSet(root, '12', pct)`.
import { escapeHtml } from './html.js';
import { lucide } from './lucide.js';
import { fullscreenButtonHtml } from './fullscreen.js';

// UNA sola forma de poner icono a un indicador: lo declara AQUÍ el chip, nunca
// lo hornea el llamante en el valor. El «⏱» viajaba pegado dentro de
// `core/reloj.js` (el dueño del TIEMPO mandando sobre el aspecto de dos
// superficies) y el «🔥» lo horneaba cada player en su cadena — dos mecanismos
// para lo mismo. El GLIFO se elige aquí y se razona: el reloj es de Lucide
// (mando, monocromo, crece con la letra); la racha se queda en EMOJI a
// propósito —es una celebración, no un mando: el naranja se ve desde el fondo
// del aula y un contorno gris no dice «vas lanzado».
const ICONO = { tiempo: lucide('timer'), racha: '🔥' };

/** UN indicador, con lo que le toque (icono incluido). El valor va en su propio
 *  nodo para que `hudSet` lo reescriba sin llevarse por delante el icono
 *  (`textContent` sobre el chip entero lo borraría).
 *  INTERNA: llegó a exportarse cuando dos barras propias —la de Pelotas y la del
 *  Crucigrama— alojaban el reloj y lo copiaban a mano. Con UNA cabecera para las
 *  trece ya nadie construye un chip por su cuenta; lo cazó §30 al primer intento
 *  («nadie lo nombra fuera de su fichero»), que es la señal de que la
 *  unificación llegó de verdad. */
const chipHtml = (campo, texto) => {
  const ico = ICONO[campo] || '';
  const clase = campo === 'tiempo' ? 'edu-cab__reloj' : 'edu-cab__chip';
  return `<span class="${clase}" data-hud="${campo}"${texto ? '' : ' hidden'}>`
    + `${ico}<span data-hud-val>${escapeHtml(String(texto ?? ''))}</span></span>`;
};

/**
 * LA CABECERA. Todos los campos son opcionales: lo que no se pasa se pinta
 * oculto y listo para `hudSet` (así el player no tiene que re-renderizar para
 * estrenar un indicador a mitad de partida).
 *
 * @param {object}  o
 * @param {string} [o.pagina]        «3 / 8»
 * @param {string} [o.racha]         «3» (el 🔥 lo pone el chip)
 * @param {string} [o.extra]         «Flips: 4»
 * @param {string} [o.tiempo]        «12» (el icono lo pone el chip)
 * @param {string} [o.herramientas]  HTML YA ESCAPADO de la plantilla: lápiz/
 *        borrador, Aa/Deshacer, Pista/Reiniciar. Solo lo que se TOCA — un
 *        indicador no va aquí, va por su nombre.
 * @param {boolean} [o.fullscreen]   ¿la cabecera aloja el botón de pantalla
 *        completa? Sí cuando ESTA cabecera manda en el marco (Individual,
 *        Tarea). En el duelo se montan DOS rondas en un marco: ninguna lo aloja
 *        y el mando sigue siendo la esquina del marco, que es UNA.
 * @param {boolean} [o.progreso]     barra de agotamiento bajo la cabecera. Solo
 *        tiene sentido con CUENTA ATRÁS: un cronómetro ascendente no agota nada
 *        y una barra quieta desinforma. La llena `relojSet`.
 */
export function cabeceraHtml({ pagina, racha, extra, tiempo, herramientas = '',
                               fullscreen = true, progreso = false } = {}) {
  return `<header class="edu-cabecera">
    ${herramientas ? `<span class="edu-cab__mandos">${herramientas}</span>` : ''}
    <span class="edu-cab__datos">${chipHtml('pagina', pagina)}${chipHtml('racha', racha)}${chipHtml('extra', extra)}</span>
    ${chipHtml('tiempo', tiempo)}
    ${fullscreen ? fullscreenButtonHtml({ inline: true }) : ''}
  </header>${progreso ? '<div class="edu-cab__barra" data-progreso><i></i></div>' : ''}`;
}

/** Actualiza UN indicador dentro de `scope` (Element o selector). */
export function hudSet(scope, campo, texto) {
  const raiz = typeof scope === 'string' ? document.querySelector(scope) : scope;
  const el = raiz?.querySelector(`[data-hud="${campo}"]`);
  if (!el) return;
  if (texto == null || texto === '') { el.hidden = true; return; }
  el.hidden = false;
  (el.querySelector('[data-hud-val]') || el).textContent = String(texto);
}

/** El reloj y su barra, que son el MISMO dato: el número dice cuánto queda y la
 *  barra dice cuánto se ha ido, que es lo que se capta sin leer. Se pintan
 *  juntos porque `core/reloj.js` los entrega juntos (`pintar(valor, pct)`) y
 *  separarlos fue justo lo que dejó la barra viviendo solo en Tildes.
 *  `pct` va por `transform`, NO por `width`: animar el ancho relayoutea la
 *  página en cada fotograma mientras corre el reloj — medido en una pizarra 4K
 *  con la CPU frenada 12x, 19 fps EN REPOSO con `width` y 60 con `transform`. */
export function relojSet(scope, valor, pct) {
  hudSet(scope, 'tiempo', valor);
  const raiz = typeof scope === 'string' ? document.querySelector(scope) : scope;
  const barra = raiz?.querySelector('[data-progreso] i');
  if (barra && pct != null) barra.style.transform = `scaleX(${Math.max(0, Math.min(100, pct)) / 100})`;
}

// EL RELOJ NO SE CUENTA AQUÍ. Estuvo: `mostrarCrono()` + `cronoHud()` montaban
// el cronómetro sobre el chip `tiempo`, y la cuenta atrás la montaba cada player
// por su cuenta — dos relojes con dos dueños. Ahora hay UNO (`core/reloj.js`) y
// este módulo solo aporta el SITIO donde se pinta.
