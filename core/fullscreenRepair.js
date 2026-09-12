// LA REPARACIÓN DEL COLAPSO DE LAYOUT tras `fullscreenchange` (Chrome 123
// Android) — ni el mando de pantalla completa ni su icono: solo el arreglo de un
// navegador concreto, aparte para que `core/fullscreen.js` vuelva a caber en una
// línea («un solo mando de pantalla completa, cableado por delegación»).
// Puro sobre el DOM y con la medición INYECTABLE: se prueba entero bajo Node
// (tests/fullscreenColapso.test.mjs).
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

