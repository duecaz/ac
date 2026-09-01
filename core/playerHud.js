// EL HUD DEL JUEGO — los INDICADORES flotan en las esquinas, el juego se queda
// con todo el alto.
//
// Nace del inventario de piezas (docs/piezas-por-actividad.md, dueño
// 2026-08-17): «n/total» estaba escrito de SIETE formas distintas y seis
// players repintaban el título de la actividad que ya está en la antesala
// (pantalla de inicio / setup / lobby / ficha de la tarea). Cada franja de
// cabecera robaba un 4-25 % del alto — exactamente lo que le falta a la zona
// de juego en un móvil en vertical.
//
// La regla (decidida con el dueño): un INDICADOR —página, tiempo,
// racha— nunca crea una franja; flota en una esquina, encima del juego, como
// el botón de pantalla completa («como en la actividad Calcular»). Solo una
// HERRAMIENTA que se toca (lápiz/borrador, deshacer, pista) justifica una
// barra (edu-topbar), y solo 3 de las 13 la tienen.
//
// Uso: el player mete `hudHtml({...})` como PRIMER hijo de su raíz — el CSS
// (styles/player.css, `:has(> .edu-hud)`) hace de esa raíz el ámbito de
// posicionamiento, sin pedirle clase. Para actualizar un dato sin re-render:
// `hudSet(root, 'tiempo', '⏱ 12')` (null/'' lo esconde).
//
// El HUD no captura toques (`pointer-events: none`): un globo que pase por
// debajo se sigue pudiendo explotar.
import { escapeHtml } from './html.js';
import { startElapsedTicker } from './deadlineTicker.js';
import { observeStage } from './stageClaim.js';
import { serverNow } from './serverNow.js';

const chip = (campo, texto) =>
  `<span class="edu-hud__chip" data-hud="${campo}"${texto ? '' : ' hidden'}>${escapeHtml(String(texto ?? ''))}</span>`;

/**
 * Los indicadores del juego, por NOMBRE (no por posición en un markup ad hoc):
 *   pagina «3 / 8» · racha «🔥 3» · extra (p.ej. «Flips: 4») → esquina izquierda
 *   tiempo «⏱ 12»                                            → CENTRO
 * Todos opcionales: lo que no se pasa se pinta oculto, listo para `hudSet`.
 * El chip `puntos` («★ 40») SE RETIRÓ (dueño 2026-09-01): el puntaje ya vive en
 * la pantalla de resultado y el HUD no debe competir con el juego — «esa
 * estrella no aporta nada». El reloj va al CENTRO, no a la derecha: la esquina
 * derecha es del botón de pantalla completa y un dato que se mira cada segundo
 * merece el sitio donde el ojo ya está.
 */
export function hudHtml({ pagina, racha, extra, tiempo } = {}) {
  return `<div class="edu-hud" aria-hidden="true">
    <span class="edu-hud__zona">${chip('pagina', pagina)}${chip('racha', racha)}${chip('extra', extra)}</span>
    <span class="edu-hud__zona edu-hud__zona--centro">${chip('tiempo', tiempo)}</span>
  </div>`;
}

/** Actualiza UN indicador dentro de `scope` (Element o selector).
 *  Si una BARRA (edu-topbar) ALOJA el indicador —misma excepción declarada que
 *  el botón de pantalla completa: la barra es la dueña de su franja—, ese chip
 *  manda y el del HUD flotante se queda retirado: el reloj centrado del HUD
 *  caía justo sobre los mandos centrados de la barra (Crucigrama «Reiniciar»,
 *  Pelotas «Deshacer» — lo cazó la matriz al estrenar el centro). */
export function hudSet(scope, campo, texto) {
  const raiz = typeof scope === 'string' ? document.querySelector(scope) : scope;
  const el = raiz?.querySelector(`.edu-topbar [data-hud="${campo}"]`)
          ?? raiz?.querySelector(`.edu-hud [data-hud="${campo}"]`);
  if (!el) return;
  if (texto == null || texto === '') { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = String(texto);
}

// ── EL CRONÓMETRO DEL JUEGO (comparado con Wordwall, dueño 2026-08-30) ───────
//
// Wordwall enseña SIEMPRE cuánto llevas («0:04» arriba a la izquierda) y aquí
// no lo enseñaba nadie: el chip `tiempo` solo se usaba para la cuenta atrás.
// La regla, decidida aquí y no en cada plantilla:
//   · si la actividad tiene TEMPORIZADOR (`rules.timer`), manda la cuenta
//     atrás — es accionable y dos relojes a la vez confunden;
//   · si no lo tiene, el cronómetro ASCENDENTE llena ese chip.
// Se APAGA por actividad con `rules.crono: false` (casilla del editor);
// encendido por defecto porque es información sin coste y es lo que el dueño
// admiró en Wordwall.
//
// UN dueño: quien quiera el cronómetro llama a esto — nunca un setInterval
// propio (ley de relojes §23: el ascendente es `startElapsedTicker`). El guard
// es la ficha del escenario: un tick tardío sobre otra pantalla no pinta.
export function mostrarCrono(activity) {
  return activity?.rules?.crono !== false && !(activity?.rules?.timer > 0);
}

/** Arranca el cronómetro en el chip `tiempo` del HUD dentro de `scope`.
 *  Devuelve { stop } (llamar al desmontar; el guard ya protege, pero parar el
 *  intervalo es limpieza §23, no cortesía). */
// `desde` se estampa con serverNow(): es el reloj contra el que mide el
// primitivo — mezclarlo con clock.now() haría nacer el cronómetro desfasado
// exactamente el offset del servidor (§22-5, la lección del reloj).
export function cronoHud(scope, activity, { desde = serverNow() } = {}) {
  const nada = { stop: () => {} };
  if (!mostrarCrono(activity)) return nada;
  const el = typeof scope === 'string' ? (globalThis.document?.querySelector(scope) ?? null) : scope;
  // Sin escenario DE VERDAD no hay reloj que pintar: los shells se prueban en
  // Node con raíces falsas (objetos planos), y un intervalo real sobre una raíz
  // que nunca «muere» dejaba la suite colgada al salir. Un elemento real
  // siempre trae `isConnected`; el objeto de test, no.
  if (!el || el.isConnected === undefined) return nada;
  // OBSERVA la ficha del escenario, no la reclama: reclamar subiría la época y
  // mataría el alive() del shell — sus timers y su avance (pasó, ver stageClaim).
  const alive = observeStage(el);
  return startElapsedTicker({
    since: desde,
    while: alive,
    onTick: ({ label }) => hudSet(scope, 'tiempo', `⏱ ${label}`),
  });
}
