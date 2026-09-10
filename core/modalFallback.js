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
/**
 * Lo que hace falta del Bootstrap de la CDN: su `Modal`. Se pregunta por el
 * global porque puede NO haber llegado (es justo el caso que este módulo cubre).
 * @typedef {{Modal: new (el: Element, opts?: object) => DialogoModal}} BootstrapGlobal
 */
/** La boca que devuelve esta función, sea el Modal de Bootstrap o el respaldo.
 *  @typedef {{show: () => void, hide: () => void}} DialogoModal */

/** @returns {BootstrapGlobal|null} */
function bootstrapCargado() {
  const bs = /** @type {BootstrapGlobal|undefined} */ (Reflect.get(globalThis, 'bootstrap'));
  return bs?.Modal ? bs : null;
}

/** @returns {HTMLElement|null} */
const elementoActivo = () => /** @type {HTMLElement|null} */ (document.activeElement);

/**
 * @param {HTMLElement} el
 * @param {{disparador?: HTMLElement|null}} [o]
 * @returns {DialogoModal}
 */
export function abrirDialogoConFallback(el, { disparador = elementoActivo() } = {}) {
  el.addEventListener('hidden.bs.modal', () => {
    if (disparador && typeof disparador.focus === 'function' && document.body.contains(disparador)) {
      disparador.focus();
    }
  });
  const bs = bootstrapCargado();
  if (bs) return new bs.Modal(el);
  /** @type {HTMLElement|null} */
  let fondo = null;
  const cerrar = () => {
    el.classList.remove('show');
    el.style.display = 'none';
    fondo?.remove();
    el.dispatchEvent(new Event('hidden.bs.modal'));
  };
  el.addEventListener('click', (e) => {
    const t = /** @type {Element|null} */ (e.target);
    if (t && typeof t.closest === 'function' && t.closest('[data-bs-dismiss="modal"]')) cerrar();
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
