import { raizDe } from './html.js';
// Simple event delegation + tiny pub/sub.
//
// on() is idempotent per (root, event, selector). If a handler already
// exists for that combination, it's removed before attaching the new one.
// This prevents listener stacking when a view re-renders into the same
// rootSel multiple times — which previously caused single clicks to fire
// N times (and e.g. created N live sessions per click in renderHome).
const bus = new EventTarget();
/**
 * Lo delegado por raíz: raíz → (evento|selector) → oyente instalado.
 * @type {WeakMap<Element, Map<string, EventListener>>}
 */
const _listeners = new WeakMap();

/**
 * @typedef {(ev: Event, el: HTMLElement) => void} DelegatedHandler
 */

/**
 * @param {string|Element} target
 * @param {string} ev
 * @param {string|null|DelegatedHandler} sel
 * @param {DelegatedHandler} [handler]
 * @returns {() => void}
 */
export function on(target, ev, sel, handler) {
  if (typeof sel === 'function') { handler = sel; sel = null; }
  const root = raizDe(target);
  if (!root || !handler) return () => {};
  const cb = handler;
  const key = `${ev}|${sel || ''}`;
  let bag = _listeners.get(root);
  if (!bag) { bag = new Map(); _listeners.set(root, bag); }
  // Remove previous handler for this (event, selector) on this root.
  const prev = bag.get(key);
  if (prev) root.removeEventListener(ev, prev);
  /** @type {EventListener} */
  const fn = (e) => {
    const el = /** @type {HTMLElement} */ (root);
    if (!sel) return cb(e, el);
    // Se estrecha por FORMA (`closest`), no con `instanceof Element`: bajo Node
    // (las suites) no existe la clase y el arnés entrega objetos de mentira.
    const t = /** @type {{ closest?: (s: string) => Element|null }|null} */ (e.target);
    const m = t && typeof t.closest === 'function' ? t.closest(sel) : null;
    if (m && root.contains(m)) cb(e, /** @type {HTMLElement} */ (m));
  };
  bag.set(key, fn);
  root.addEventListener(ev, fn);
  return () => {
    root.removeEventListener(ev, fn);
    if (bag.get(key) === fn) bag.delete(key);
  };
}

// Remove EVERY delegated listener registered via on() on this root. Used at the
// route boundary: the shared app root (#app) is reused across views, and
// delegated handlers live on that stable element, so they survive the innerHTML
// swap of the next view and keep firing on its markup. That is exactly how the
// player's `.skin-pick`/`.bg-pick` handlers leaked into the editor (same class
// names) → `mount: root not found` and the theme bleeding onto <body>. Clearing
// on navigation kills the whole class of cross-view handler leaks at the source.
/** @param {string|Element} target */
export function clearListeners(target) {
  const root = raizDe(target);
  if (!root) return;
  const bag = _listeners.get(root);
  if (!bag) return;
  for (const [key, fn] of bag) root.removeEventListener(key.slice(0, key.indexOf('|')), fn);
  bag.clear();
}

// ─── LA CAPTURA DEL PUNTERO, con su motivo escrito UNA vez ───────────────────
// Capturar el puntero es lo que hace que TODOS los `pointermove`/`pointerup` del
// gesto sigan llegando al elemento aunque el dedo se salga de él, y que el
// navegador no se lleve el gesto como scroll (clave en tabletas y pizarra).
//
// Puede fallar sin consecuencias, y por eso no se avisa (R6: fallar en silencio
// está prohibido SALVO con el motivo escrito — aquí está, en vez de los nueve
// `try { … } catch {}` mudos que había repartidos por las plantillas):
//  · el puntero ya no existe (se levantó entre el evento y esta llamada) →
//    `NotFoundError`;
//  · el elemento acaba de salir del DOM (la ruta cambió a mitad del gesto);
//  · el arnés de pruebas entrega un DOM de mentira sin esta API.
// En los tres casos el gesto sigue funcionando, solo que sin captura: no hay
// nada que contarle al usuario ni nada que reintentar.
/** @param {Element|null|undefined} el @param {number} pointerId */
export function capturarPuntero(el, pointerId) {
  try { el?.setPointerCapture?.(pointerId); } catch { /* ver arriba: sin captura el gesto sigue */ }
}

/** Soltar la captura al terminar el gesto. Falla por los mismos motivos (el
 *  puntero ya se fue, el nodo ya no está) y con la misma consecuencia: ninguna. */
/** @param {Element|null|undefined} el @param {number} pointerId */
export function soltarPuntero(el, pointerId) {
  try { el?.releasePointerCapture?.(pointerId); } catch { /* ver arriba */ }
}

/**
 * @param {string} name
 * @param {unknown} [detail]
 * @returns {boolean}
 */
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

/**
 * @template [T=unknown]
 * @param {string} name
 * @param {(detail: T) => void} fn
 * @returns {() => void}
 */
export const listen = (name, fn) => {
  /** @type {EventListener} */
  const handler = (e) => fn(/** @type {CustomEvent<T>} */ (e).detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
};
