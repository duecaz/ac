// Fullscreen helper. Wrap the toggle for cross-browser quirks.
// requestFullscreen/exitFullscreen devuelven una PROMESA que RECHAZA cuando el
// navegador deniega el permiso (embed en iframe/LMS sin allow="fullscreen",
// gesto no confiable, iOS) o cuando exit se llama fuera de fullscreen. Ese
// rechazo, sin capturar, dispara `unhandledrejection` → el boot-guard de los
// HTML lo trata como crash y REEMPLAZA la app por la pantalla roja de Error.
// Envolvemos en Promise.resolve(...).catch() para que un fullscreen denegado sea
// un no-op silencioso y el juego arranque igual. Devuelve la promesa (ya segura).
import { lucide } from './lucide.js';

export function toggleFullscreen(el) {
  el = el || document.documentElement;
  const p = isFullscreen()
    ? (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    : (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  return Promise.resolve(p).catch(() => {});
}

/** ¿Hay algo a pantalla completa? Exportada porque el prefijo de WebKit no debe
 *  saberlo nadie más: la antesala lo había vuelto a escribir a mano y así el
 *  guard y este módulo podían discrepar el día que uno de los dos cambiara. */
export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * El botón. `corner: true` lo pinta DISCRETO y flotando en la esquina del juego
 * (lo que hace Wordwall). `inline: true` lo entrega DESNUDO —sin caja ni
 * posición propias— para que lo aloje quien ya tiene una barra: la ronda de
 * Tildes/Comas lo mete DENTRO de su barra de herramientas («el botón de pantalla
 * completa está fuera de la barra», dueño 2026-08-15) y ahí una esquina flotante
 * sobraba. Sin ninguno de los dos sale el botón de barra de las pantallas en vivo.
 */
export function fullscreenButtonHtml({ corner = false, inline = false } = {}) {
  const cls = inline ? 'ww-fs-btn ww-fs-btn--inline'
    : corner ? 'ww-fs-btn ww-fs-btn--corner' : 'btn btn-sm btn-outline-light ww-fs-btn';
  // LOS DOS ICONOS, y el estado lo decide el CSS (`:fullscreen`). Antes el JS
  // reemplazaba el SVG en cada `fullscreenchange`… y un player que se re-renderiza
  // (el Quiz, cada pregunta) volvía a nacer con el icono de ENTRAR estando ya en
  // pantalla completa: el mando mentía justo cuando hay que salir. Declarativo
  // no se desincroniza.
  return `<button type="button" class="${cls}" title="Pantalla completa" aria-label="Pantalla completa">`
    + lucide('maximize', { clase: 'ww-fs-ico--in' })
    + lucide('minimize', { clase: 'ww-fs-ico--out' }) + `</button>`;
}

/**
 * Cablea todos los `.ww-fs-btn` de `rootSel`. El botón CAMBIA de icono según el
 * estado REAL: antes decía "Pantalla completa" también estando ya en pantalla
 * completa, así que para salir había que adivinar Esc — en una pizarra táctil no
 * hay Esc. Devuelve un disposer: el listener de `fullscreenchange` vive en
 * `document` y sobreviviría al re-render de la vista (ley §23).
 * @param {string|Element} rootSel
 * @param {{target?: Element}} opts  elemento que se expande (def: la página)
 */
export function attachFullscreenButton(rootSel, { target } = {}) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  if (!root) return () => {};
  // POR DELEGACIÓN, no botón a botón. Antes se guardaba la lista de botones que
  // había AL LLAMAR, así que un botón pintado después —la cabecera del Quiz se
  // vuelve a pintar en cada pregunta— nacía muerto: existía, se podía tocar y no
  // hacía nada (R6). Con la cabecera alojando el mando en las trece eso pasaba
  // de ser un caso raro a ser el caso normal. El listener vive en la raíz
  // ESTABLE (el marco), que es quien sobrevive a los re-render.
  const click = (e) => {
    const b = e.target?.closest?.('.ww-fs-btn');
    if (b && root.contains(b)) toggleFullscreen(target || root);
  };
  // El ICONO lo pone el CSS; aquí solo la palabra, que una hoja de estilo no
  // puede escribir y un lector de pantalla sí necesita.
  const paint = () => {
    const on = isFullscreen();
    for (const b of root.querySelectorAll('.ww-fs-btn')) {
      b.title = on ? 'Salir de pantalla completa' : 'Pantalla completa';
      b.setAttribute('aria-label', b.title);
      b.classList.toggle('is-on', on);
    }
  };
  root.addEventListener('click', click);
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  paint();
  return () => {
    root.removeEventListener('click', click);
    document.removeEventListener('fullscreenchange', paint);
    document.removeEventListener('webkitfullscreenchange', paint);
  };
}

