// Detección de dispositivo de gama baja (pizarras interactivas / tablets con CPU
// tipo Cortex-A55 a ~1.2 GHz, pocos núcleos y poca RAM). En estos equipos las
// animaciones CONTINUAS (el bucle "respira" de la cuerda Lottie a 60fps, la
// marquesina arcade, los brillos) saturan el hilo principal y hacen que escribir
// en el teclado del VS vaya lento. Cuando detectamos lite, se reducen:
//   · JS: el bucle de la animación central no corre en reposo (solo reacciona a
//     respuestas) — ver core/vsAnimations.js.
//   · CSS: la clase `ww-lite` en <html> apaga animaciones costosas del skin.

export function isLowEndDevice() {
  if (typeof navigator === 'undefined') return false;   // Node/SSR: no degradar
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;   // GB (solo en Chromium); 8 si no se reporta
  return cores <= 4 || mem <= 2;
}

// Marca <html class="ww-lite"> una sola vez para que el CSS pueda degradar.
export function applyPerfClass() {
  try {
    if (isLowEndDevice()) document.documentElement.classList.add('ww-lite');
  } catch {}
}
