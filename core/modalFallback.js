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
//
// EL FOCO VUELVE AL DISPARADOR (hallazgo de matrix-smoke, red B7): Escape ya
// cerraba el diálogo (bootstrap.Modal lo hace solo; el respaldo, con el
// listener de abajo), pero el foco se quedaba en ningún sitio — el profe
// tenía que volver a buscar con el ratón el botón que abrió el modal. Se
// guarda AL ABRIR y se devuelve en `hidden.bs.modal` — el mismo evento tanto
// si cierra el Modal de Bootstrap de verdad como el respaldo a mano, así un
// solo `addEventListener` cubre los dos caminos.
// Por defecto es `document.activeElement` (válido cuando el caller hace
// `abrirDialogoConFallback(el)` seguido de `m.show()` en el mismo gesto de
// clic). Un caller que DESHABILITA su botón disparador antes de abrir (para
// que no se pueda hacer doble clic mientras carga) tiene que pasarlo EXPLÍCITO
// como segundo argumento: un botón `disabled` deja de ser el `activeElement`
// al instante, con lo que el valor por defecto ya llegaría vacío (era el caso
// de «Escribir con IA», editorShell.js).
export function abrirDialogoConFallback(el, { disparador = document.activeElement } = {}) {
  el.addEventListener('hidden.bs.modal', () => {
    if (disparador && typeof disparador.focus === 'function' && document.body.contains(disparador)) {
      disparador.focus();
    }
  });
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
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
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
