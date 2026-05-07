// Simple event delegation + tiny pub/sub.
//
// on() is idempotent per (root, event, selector). If a handler already
// exists for that combination, it's removed before attaching the new one.
// This prevents listener stacking when a view re-renders into the same
// rootSel multiple times — which previously caused single clicks to fire
// N times (and e.g. created N live sessions per click in renderHome).
const bus = new EventTarget();
const _listeners = new WeakMap(); // root -> Map<key, fn>

export function on(target, ev, sel, handler) {
  if (typeof sel === 'function') { handler = sel; sel = null; }
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) return () => {};
  const key = `${ev}|${sel || ''}`;
  let bag = _listeners.get(root);
  if (!bag) { bag = new Map(); _listeners.set(root, bag); }
  // Remove previous handler for this (event, selector) on this root.
  const prev = bag.get(key);
  if (prev) root.removeEventListener(ev, prev);
  const fn = (e) => {
    if (!sel) return handler(e);
    const m = e.target.closest(sel);
    if (m && root.contains(m)) handler(e, m);
  };
  bag.set(key, fn);
  root.addEventListener(ev, fn);
  return () => {
    root.removeEventListener(ev, fn);
    if (bag.get(key) === fn) bag.delete(key);
  };
}

export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const listen = (name, fn) => {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
};
