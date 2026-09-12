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
