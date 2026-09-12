// LA PASTILLA DE FLUIDEZ — el medidor que se lleva a la pizarra (`?perf=1`).
//
// Fase 0 de `docs/handoff-rendimiento-animaciones.md`: antes de rehacer una
// animación hay que MEDIRLA en el aparato del aula, porque Playwright no tiene
// ni la GPU ni el DPR 3 de la pizarra. Esto es lo único que hay que llevar
// encima: se abre cualquier página con `?perf=1`, se juega la escena y la
// pastilla dice a cuántos fps va, el cuadro típico (p50), el cuadro malo de
// cada veinte (p95) y cuántos tropiezos hubo en los últimos 5 segundos.
//
// TRES decisiones que no son obvias:
//
// · ES EL ÚNICO BUCLE rAF EN REPOSO QUE SE PERMITE, y solo existe con `?perf=1`
//   — un medidor siempre encendido sería justo el tipo de coste que persigue.
//   Medir cuesta: `performance.now()` y un `push` por cuadro, y el repintado del
//   texto va a 4 Hz (no a 60), que es lo que el ojo puede leer.
//
// · VA FUERA DEL JUEGO. Nada de colgarla de `#ww-player-widget` ni del marco:
//   una vista se repinta entera con `innerHTML` y se la llevaría por delante, y
//   además cambiaría la maqueta de lo que se está midiendo. Se cuelga del
//   `<body>` — salvo en PANTALLA COMPLETA, donde el navegador solo pinta el
//   elemento a pantalla completa y sus hijos (la misma lección que el confeti,
//   `tests/effects.test.mjs`): ahí se muda al elemento a pantalla completa, o el
//   medidor desaparecería justo en la escena que más interesa medir (el duelo y
//   el podio se juegan a pantalla completa).
//
// · NO GUARDA NADA. Ni una clave `ww.*`, ni un ajuste: la activa la URL y se va
//   con ella (§21 — una clave nueva necesita dueño declarado, y esto no es
//   estado del usuario sino una lupa de diagnóstico).
//
// La aritmética (p50/p95/largos) vive aparte y probada en `core/fluidez.js`;
// quien lee `?perf=1` y carga esto es `core/boot.js`.
import { resumenFluidez, ventana, UMBRAL_LARGO } from './fluidez.js';

const VENTANA_MS = 5000;     // «los últimos 5 s»
const REPINTADO_MS = 250;    // 4 Hz: legible sin ser otro coste

let montado = false;

/** Monta la pastilla y arranca el bucle de medida. Idempotente.
 *  @returns {() => void} soltar (para pruebas; en producción vive toda la sesión) */
export function montarMedidorFluidez() {
  if (montado || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return () => {};
  montado = true;

  const caja = document.createElement('div');
  caja.className = 'ww-fluidez';
  caja.setAttribute('role', 'status');
  caja.title = `Fluidez de los últimos ${VENTANA_MS / 1000} s · p50 = cuadro típico · p95 = el peor de cada veinte · largos = cuadros de más de ${UMBRAL_LARGO} ms`;
  caja.textContent = 'midiendo…';

  const escena = () => {
    const doc = /** @type {Document & {webkitFullscreenElement?: Element|null}} */ (document);
    return doc.fullscreenElement || doc.webkitFullscreenElement || document.body;
  };
  const colgar = () => { const e = escena(); if (caja.parentNode !== e) e.appendChild(caja); };
  colgar();
  document.addEventListener('fullscreenchange', colgar);
  document.addEventListener('webkitfullscreenchange', colgar);

  /** @type {number[]} */
  let marcas = [];
  let ultimoPintado = 0;
  let vivo = true;

  /** @param {number} t */
  function cuadro(t) {
    if (!vivo) return;
    marcas.push(t);
    if (t - ultimoPintado >= REPINTADO_MS) {
      ultimoPintado = t;
      marcas = ventana(marcas, VENTANA_MS);
      // Si la vista se repintó entera, la pastilla puede haber quedado fuera del
      // DOM: se vuelve a colgar en vez de morir en silencio.
      colgar();
      pinta(caja, marcas);
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  return () => {
    vivo = false;
    montado = false;
    document.removeEventListener('fullscreenchange', colgar);
    document.removeEventListener('webkitfullscreenchange', colgar);
    caja.remove();
  };
}

/** @param {HTMLElement} caja @param {number[]} marcas */
function pinta(caja, marcas) {
  const r = resumenFluidez(marcas);
  if (!r.cuadros) { caja.textContent = 'midiendo…'; return; }
  const coma = (/** @type {number} */ n) => n.toFixed(1).replace('.', ',');
  caja.textContent = `${r.fps} fps · p50 ${coma(r.p50)} · p95 ${coma(r.p95)} · largos ${r.largos}`;
  // Verde/ámbar/rojo por el CUADRO MALO, no por la mediana: es el que la clase
  // ve. 33 ms = 30 fps (el suelo), 50 ms = el umbral de tropiezo.
  caja.dataset.estado = r.p95 <= 33 ? 'ok' : r.p95 <= UMBRAL_LARGO ? 'justo' : 'mal';
}
