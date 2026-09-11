// Fullscreen helper. Wrap the toggle for cross-browser quirks.
// requestFullscreen/exitFullscreen devuelven una PROMESA que RECHAZA cuando el
// navegador deniega el permiso (embed en iframe/LMS sin allow="fullscreen",
// gesto no confiable, iOS) o cuando exit se llama fuera de fullscreen. Ese
// rechazo, sin capturar, dispara `unhandledrejection` → el boot-guard de los
// HTML lo trata como crash y REEMPLAZA la app por la pantalla roja de Error.
// Envolvemos en Promise.resolve(...).catch() para que un fullscreen denegado sea
// un no-op silencioso y el juego arranque igual. Devuelve la promesa (ya segura).
import { lucide } from './lucide.js';

/**
 * Los prefijos de WebKit no están en la librería del DOM y solo se nombran aquí.
 * @typedef {Document & {webkitExitFullscreen?: () => Promise<void>|void,
 *   webkitFullscreenElement?: Element|null}} DocumentoFs
 * @typedef {Element & {webkitRequestFullscreen?: () => Promise<void>|void}} ElementoFs
 */

/**
 * @param {Element|null} [el]
 * @returns {Promise<void>}
 */
export function toggleFullscreen(el) {
  /** @type {ElementoFs} */
  const destino = el || document.documentElement;
  const doc = /** @type {DocumentoFs} */ (document);
  const p = isFullscreen()
    ? (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc)
    : (destino.requestFullscreen || destino.webkitRequestFullscreen)?.call(destino);
  return Promise.resolve(p).catch(() => {});
}

/** ¿Hay algo a pantalla completa? Exportada porque el prefijo de WebKit no debe
 *  saberlo nadie más: la antesala lo había vuelto a escribir a mano y así el
 *  guard y este módulo podían discrepar el día que uno de los dos cambiara. */
export function isFullscreen() {
  const doc = /** @type {DocumentoFs} */ (document);
  return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
}

/**
 * El botón. `corner: true` lo pinta DISCRETO y flotando en la esquina del juego
 * (lo que hace Wordwall). `inline: true` lo entrega DESNUDO —sin caja ni
 * posición propias— para que lo aloje quien ya tiene una barra: la ronda de
 * Tildes/Comas lo mete DENTRO de su barra de herramientas («el botón de pantalla
 * completa está fuera de la barra», dueño 2026-08-15) y ahí una esquina flotante
 * sobraba. Sin ninguno de los dos sale el botón de barra de las pantallas en vivo.
 */
export function fullscreenButtonHtml({ corner = false, inline = false } = {}) {
  const cls = inline ? 'ww-fs-btn ww-fs-btn--inline'
    : corner ? 'ww-fs-btn ww-fs-btn--corner' : 'btn btn-sm btn-outline-light ww-fs-btn';
  // LOS DOS ICONOS, y el estado lo decide el CSS (`:fullscreen`). Antes el JS
  // reemplazaba el SVG en cada `fullscreenchange`… y un player que se re-renderiza
  // (el Quiz, cada pregunta) volvía a nacer con el icono de ENTRAR estando ya en
  // pantalla completa: el mando mentía justo cuando hay que salir. Declarativo
  // no se desincroniza.
  return `<button type="button" class="${cls}" title="Pantalla completa" aria-label="Pantalla completa">`
    + lucide('maximize', { clase: 'ww-fs-ico--in' })
    + lucide('minimize', { clase: 'ww-fs-ico--out' }) + `</button>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EL COLAPSO DE LAYOUT TRAS `fullscreenchange` (Chrome 123 Android)
//
// Chrome 123 Android puede dejar descendientes EXISTENTES a 0x0 tras
// `fullscreenchange` aunque el padre tenga tamaño; reinsertar el MISMO nodo
// fuerza la invalidación de layout.
//
// Medido en el aparato (Android 13 · RK3588 · 3840x2160 · DPR 3 · viewport CSS
// 1280x720 en pantalla completa · Chrome 123.0.6312.40): al entrar/salir/volver
// a entrar, el marco (`#ww-frame`) y el escenario (`#ww-player-widget`) medían
// 1280x720 y eran visibles, y sin embargo su contenido (`.vs-wrap` → `.vs-arena`
// → `.vs-main`) quedaba en 0x0 con `computedStyle` diciendo 1280x720: el
// navegador NO re-calculaba el layout de esos nodos. La actividad se veía en
// blanco salvo el botón de salir. Un div NUEVO creado dentro del mismo escenario
// pintaba perfecto → no es CSS, ni la GPU, ni el fullscreen: es la invalidación.
// Se probaron y descartaron width/height, flex, absolute+inset:0, quitar
// `container-type:size`, `contain:none` y tamaños en px explícitos.
//
// Por eso el arreglo NO es por plantilla ni por CSS: se reinserta el mismo nodo
// (no un clon) en su MISMA posición entre hermanos, de modo que conserva
// listeners, estado, contenido, timers y animaciones — nada se desmonta ni se
// vuelve a ejecutar `runMode()`. Y se detecta por el BUG REAL ("el padre tiene
// tamaño y su contenido visible quedó 0x0"), nunca por el user-agent.
//
// En Chrome moderno la condición no se cumple nunca → cero reinserciones.

/** Cuándo volver a comprobar tras el cambio: el colapso aparece después del
 *  primer layout y a veces tras el reajuste del viewport del sistema. */
const REINTENTOS_MS = [50, 150, 300];

/**
 * El contenedor de contenido dentro de (o que es) `ambito`. Lo DECLARA quien
 * cablea el botón (`attachFullscreenButton(…, { contenido: '#…' })`): este
 * módulo no sabe qué id usa el player ni el marco del alumno (§21b, un dueño).
 * Se resuelve en cada comprobación porque la vista puede repintar su escenario.
 * @param {Element} ambito
 * @param {string|Element} contenido selector dentro del ámbito, o el nodo
 * @returns {Element|null}
 */
function resolverContenido(ambito, contenido) {
  if (typeof contenido !== 'string') return contenido;
  if (ambito.matches?.(contenido)) return ambito;
  return ambito.querySelector?.(contenido) ?? null;
}

/**
 * ¿Este hijo DEBERÍA tener layout? Se estrecha por FORMA (las suites corren bajo
 * Node sin DOM: nada de `instanceof Element`). Lo que está oculto a propósito
 * —`[hidden]`, `display:none`, `visibility:hidden`— no es un colapso: es lo que
 * se pidió (el carril `.ww-solo-anim` nace `hidden`).
 * @param {Element} el
 * @returns {boolean}
 */
function visiblePorDefecto(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.hasAttribute?.('hidden')) return false;
  // El estilo COMPUTADO ya incluye el estilo en línea: no hace falta mirar los dos.
  const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  return !cs || (cs.display !== 'none' && cs.visibility !== 'hidden');
}

/**
 * @param {Element} el
 * @returns {{w: number, h: number}}
 */
function medirPorDefecto(el) {
  const he = /** @type {HTMLElement} */ (el);
  return { w: he.offsetWidth || 0, h: he.offsetHeight || 0 };
}

/**
 * EL REPARADOR — puro sobre el DOM y con la medición INYECTABLE (se prueba bajo
 * Node con un DOM de mentira). Solo actúa si el padre TIENE tamaño y un hijo
 * directo que debería tener layout quedó en 0x0. Devuelve los nodos reinsertados
 * (vacío = no había nada que reparar, que es el caso de Chrome moderno).
 *
 * Es IDEMPOTENTE: en cuanto un nodo recupera tamaño deja de cumplir la
 * condición, así que las comprobaciones siguientes del mismo cambio no lo tocan.
 *
 * @param {Element|null|undefined} widget contenedor de contenido (el padre)
 * @param {{esVisible?: (el: Element) => boolean,
 *          medir?: (el: Element) => {w: number, h: number},
 *          forzarLayout?: (el: Element) => void}} [opts]
 * @returns {Element[]}
 */
export function repararColapso(widget, opts = {}) {
  const esVisible = opts.esVisible || visiblePorDefecto;
  const medir = opts.medir || medirPorDefecto;
  // Leer `offsetHeight` es lo que OBLIGA al navegador a recalcular el layout (no
  // se puede sustituir por `medir`: una medición inyectada no toca el navegador).
  // En un DOM de mentira es un no-op.
  const forzarLayout = opts.forzarLayout
    || ((el) => { void /** @type {HTMLElement} */ (el).offsetHeight; });
  if (!widget) return [];
  const padre = medir(widget);
  if (!(padre.w > 0 && padre.h > 0)) return [];
  /** @type {Element[]} */
  const reparados = [];
  // Instantánea de los hijos: se van a mover mientras se recorre.
  for (const hijo of Array.from(widget.children || [])) {
    if (!esVisible(hijo)) continue;
    const m = medir(hijo);
    if (m.w !== 0 || m.h !== 0) continue;
    // LA MISMA POSICIÓN ENTRE HERMANOS, nunca `appendChild` a ciegas: el
    // escenario puede tener varios hijos directos y el orden es del diseño.
    const siguiente = hijo.nextSibling;
    hijo.remove();
    forzarLayout(widget);
    widget.insertBefore(hijo, siguiente);
    forzarLayout(hijo);
    reparados.push(hijo);
  }
  return reparados;
}

/**
 * EL VIGILANTE — engancha la reparación a cada `fullscreenchange` (entrar Y
 * salir) del ámbito dado. Espera a que el navegador intente el layout (doble
 * `requestAnimationFrame`) y vuelve a mirar a los 50/150/300 ms, porque el
 * colapso asoma también después del reajuste del viewport del sistema.
 * Devuelve un disposer (§23: el listener vive en `document` y sobreviviría al
 * re-render de la vista).
 *
 * @param {Element} ambito marco que se expande
 * @param {string|Element} contenido el contenedor de contenido, declarado por el llamante
 * @param {{reparar?: (w: Element) => Element[],
 *          enFrame?: (cb: () => void) => void,
 *          temporizar?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>,
 *          cancelar?: (t: ReturnType<typeof setTimeout>) => void}} [opts]
 * @returns {() => void}
 */
export function vigilarColapsoFullscreen(ambito, contenido, opts = {}) {
  const reparar = opts.reparar || ((w) => repararColapso(w));
  const enFrame = opts.enFrame
    || ((cb) => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(cb); else cb(); });
  const temporizar = opts.temporizar || ((cb, ms) => setTimeout(cb, ms));
  const cancelar = opts.cancelar || ((t) => clearTimeout(t));
  /** @type {Set<ReturnType<typeof setTimeout>>} */
  const pendientes = new Set();
  // Los rAF no se cancelan (no hay asa): el disposer baja esta bandera y el
  // frame tardío no toca un marco que ya no es de esta pantalla (§23).
  let vivo = true;

  const revisar = () => {
    if (!vivo) return;
    const widget = resolverContenido(ambito, contenido);
    if (widget) reparar(widget);
  };
  const alCambiar = () => {
    enFrame(() => enFrame(revisar));
    for (const ms of REINTENTOS_MS) {
      /** @type {ReturnType<typeof setTimeout>} */
      let t;
      t = temporizar(() => { pendientes.delete(t); revisar(); }, ms);
      pendientes.add(t);
    }
  };
  document.addEventListener('fullscreenchange', alCambiar);
  document.addEventListener('webkitfullscreenchange', alCambiar);
  return () => {
    vivo = false;
    document.removeEventListener('fullscreenchange', alCambiar);
    document.removeEventListener('webkitfullscreenchange', alCambiar);
    for (const t of pendientes) cancelar(t);
    pendientes.clear();
  };
}

/**
 * Cablea todos los `.ww-fs-btn` de `rootSel`. El botón CAMBIA de icono según el
 * estado REAL: antes decía "Pantalla completa" también estando ya en pantalla
 * completa, así que para salir había que adivinar Esc — en una pizarra táctil no
 * hay Esc. Devuelve un disposer: el listener de `fullscreenchange` vive en
 * `document` y sobreviviría al re-render de la vista (ley §23).
 * @param {string|Element} rootSel
 * @param {{target?: Element, contenido?: string|Element}} opts  `target`: el
 *   elemento que se expande (def: la página). `contenido`: el contenedor del
 *   JUEGO dentro de él, si lo hay — activa la reparación del colapso (arriba).
 *   Quien no tiene juego (las pantallas en vivo del docente) no lo pasa.
 */
export function attachFullscreenButton(rootSel, { target, contenido } = {}) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  if (!root) return () => {};
  // POR DELEGACIÓN, no botón a botón. Antes se guardaba la lista de botones que
  // había AL LLAMAR, así que un botón pintado después —la cabecera del Quiz se
  // vuelve a pintar en cada pregunta— nacía muerto: existía, se podía tocar y no
  // hacía nada (R6). Con la cabecera alojando el mando en las trece eso pasaba
  // de ser un caso raro a ser el caso normal. El listener vive en la raíz
  // ESTABLE (el marco), que es quien sobrevive a los re-render.
  /** @type {EventListener} */
  const click = (e) => {
    const t = e.target;
    const b = t instanceof Element ? t.closest('.ww-fs-btn') : null;
    if (b && root.contains(b)) toggleFullscreen(target || root);
  };
  // El ICONO lo pone el CSS; aquí solo la palabra, que una hoja de estilo no
  // puede escribir y un lector de pantalla sí necesita.
  const paint = () => {
    const on = isFullscreen();
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('.ww-fs-btn'))) {
      b.title = on ? 'Salir de pantalla completa' : 'Pantalla completa';
      b.setAttribute('aria-label', b.title);
      b.classList.toggle('is-on', on);
    }
  };
  root.addEventListener('click', click);
  document.addEventListener('fullscreenchange', paint);
  document.addEventListener('webkitfullscreenchange', paint);
  paint();
  // LA REPARACIÓN DEL COLAPSO va aparte y solo donde el llamante DECLARA
  // contenido de juego; sin `contenido` no se registra nada.
  const soltarColapso = contenido ? vigilarColapsoFullscreen(target || root, contenido) : () => {};
  return () => {
    root.removeEventListener('click', click);
    document.removeEventListener('fullscreenchange', paint);
    document.removeEventListener('webkitfullscreenchange', paint);
    soltarColapso();
  };
}

