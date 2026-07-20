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
  const p = (document.fullscreenElement || document.webkitFullscreenElement)
    ? (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    : (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  return Promise.resolve(p).catch(() => {});
}

export function fullscreenButtonHtml() {
  return `<button class="btn btn-sm btn-outline-light ww-fs-btn" title="Pantalla completa"><i class="bi bi-arrows-fullscreen"></i></button>`;
}

export function attachFullscreenButton(rootSel) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  root?.querySelectorAll('.ww-fs-btn').forEach(btn => {
    btn.onclick = () => toggleFullscreen();
  });
}
