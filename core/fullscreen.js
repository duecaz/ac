// Fullscreen helper. Wrap the toggle for cross-browser quirks.
// requestFullscreen/exitFullscreen devuelven una PROMESA que RECHAZA cuando el
// navegador deniega el permiso (embed en iframe/LMS sin allow="fullscreen",
// gesto no confiable, iOS) o cuando exit se llama fuera de fullscreen. Ese
// rechazo, sin capturar, dispara `unhandledrejection` → el boot-guard de los
// HTML lo trata como crash y REEMPLAZA la app por la pantalla roja de Error.
// Envolvemos en Promise.resolve(...).catch() para que un fullscreen denegado sea
// un no-op silencioso y el juego arranque igual. Devuelve la promesa (ya segura).
export function toggleFullscreen(el) {
  el = el || document.documentElement;
  const p = isFullscreen()
    ? (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    : (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  return Promise.resolve(p).catch(() => {});
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

/**
 * El botón. `corner: true` lo pinta DISCRETO y flotando en la esquina del juego
 * (lo que hace Wordwall): durante la actividad nadie busca un control en una
 * barra de abajo — se toca la esquina y ya. Sin `corner` sale el botón de barra
 * que usan las pantallas en vivo.
 */
export function fullscreenButtonHtml({ corner = false } = {}) {
  const cls = corner ? 'ww-fs-btn ww-fs-btn--corner' : 'btn btn-sm btn-outline-light ww-fs-btn';
  return `<button type="button" class="${cls}" title="Pantalla completa" aria-label="Pantalla completa">`
    + `<i class="bi bi-arrows-fullscreen"></i></button>`;
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
  const paint = () => {
    const on = isFullscreen();
    for (const b of btns) {
      const i = b.querySelector('i');
      if (i) i.className = on ? 'bi bi-fullscreen-exit' : 'bi bi-arrows-fullscreen';
      b.title = on ? 'Salir de pantalla completa' : 'Pantalla completa';
      b.setAttribute('aria-label', b.title);
      b.classList.toggle('is-on', on);
    }
  };
  for (const b of btns) b.onclick = () => toggleFullscreen(target);
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  paint();
  return () => {
    document.removeEventListener('fullscreenchange', paint);
    document.removeEventListener('webkitfullscreenchange', paint);
  };
}
