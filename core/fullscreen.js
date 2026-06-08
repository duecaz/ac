// Fullscreen helper. Wrap the toggle for cross-browser quirks.
export function toggleFullscreen(el = document.documentElement) {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }
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
