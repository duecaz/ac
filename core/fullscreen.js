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
  return `<button type="button" class="${cls}" title="Pantalla completa" aria-label="Pantalla completa">`
    + lucide('maximize') + `</button>`;
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
  const btns = [...(root?.querySelectorAll('.ww-fs-btn') || [])];
  if (!btns.length) return () => {};
  const soltar = () => {
    document.removeEventListener('fullscreenchange', paint);
    document.removeEventListener('webkitfullscreenchange', paint);
  };
  const paint = () => {
    // AUTO-SOLTARSE: si ninguno de los botones sigue en el documento, esta
    // instancia ya no pinta nada — se quita de `document` sola. Sin esto, un
    // botón que vive DENTRO de una vista que se re-renderiza (la barra de la
    // ronda de Tildes/Comas, una por frase) dejaba un listener por montaje.
    if (btns.every(b => b.isConnected === false)) { soltar(); return; }
    const on = isFullscreen();
    for (const b of btns) {
      // El icono se REEMPLAZA (SVG en línea, no una clase de fuente): las
      // cuatro esquinas para entrar, las cuatro esquinas hacia dentro para
      // salir — el mismo par que reconoce cualquiera de un reproductor.
      const svg = b.querySelector('svg');
      if (svg) svg.outerHTML = lucide(on ? 'minimize' : 'maximize');
      b.title = on ? 'Salir de pantalla completa' : 'Pantalla completa';
      b.setAttribute('aria-label', b.title);
      b.classList.toggle('is-on', on);
    }
  };
  for (const b of btns) b.onclick = () => toggleFullscreen(target);
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  paint();
  return soltar;
}
