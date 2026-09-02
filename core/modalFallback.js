// RESPALDO DE MODAL SIN BOOTSTRAP — dueño único.
//
// aiContentModal.js y imageSearchModal.js tenían la MISMA función `abrirDialogo`
// copiada entera (barrido B5, 2026-09-02): Bootstrap viene de una CDN, y estos
// son justo los diálogos que se abren cuando la red va mal. Sin el respaldo,
// `new bootstrap.Modal` revienta dentro del handler del clic y el profe se
// queda con un botón MUERTO que no dice nada (R6). De paso, así el diálogo es
// comprobable en las sondas headless, donde la CDN no se alcanza.
//
// Usa Bootstrap si está cargado y, si NO está, lo hace a mano con las mismas
// clases y el mismo evento `hidden.bs.modal`.
export function abrirDialogoConFallback(el) {
  if (typeof bootstrap !== 'undefined' && bootstrap?.Modal) return new bootstrap.Modal(el);
  let fondo = null;
  const cerrar = () => {
    el.classList.remove('show');
    el.style.display = 'none';
    fondo?.remove();
    el.dispatchEvent(new Event('hidden.bs.modal'));
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-bs-dismiss="modal"]')) cerrar();
  });
  return {
    show() {
      fondo = document.createElement('div');
      fondo.className = 'modal-backdrop fade show';
      document.body.appendChild(fondo);
      el.style.display = 'block';
      el.classList.add('show');
    },
    hide: cerrar,
  };
}
