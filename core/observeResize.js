// ResizeObserver "seguro" — ÚNICA forma de observar tamaño en los players.
//
// Un callback de ResizeObserver que MUTA el layout (redimensionar tarjetas,
// celdas, cajas…) en el mismo frame dispara el aviso del navegador
// "ResizeObserver loop completed with undelivered notifications". Es benigno,
// pero llega como evento `error` de window y el boot-guard de los HTML lo
// trataba como crash (pantalla roja "Reintentar") — pasaba al salir de
// pantalla completa (el resize gordo) en Emparejar/Crucigrama.
//
// Este helper difiere el callback a un requestAnimationFrame (frame siguiente,
// coalescando ráfagas) → el observer nunca ve mutaciones en su mismo ciclo.
export function observeResize(el, cb) {
  let raf = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(cb);
  });
  ro.observe(el);
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}
