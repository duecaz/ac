// Simple event delegation + tiny pub/sub.
const bus = new EventTarget();

export function on(target, ev, sel, handler) {
  if (typeof sel === 'function') { handler = sel; sel = null; }
  const root = typeof target === 'string' ? document.querySelector(target) : target;
  if (!root) return () => {};
  const fn = (e) => {
    if (!sel) return handler(e);
    const m = e.target.closest(sel);
    if (m && root.contains(m)) handler(e, m);
  };
  root.addEventListener(ev, fn);
  return () => root.removeEventListener(ev, fn);
}

export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));
export const listen = (name, fn) => {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
};
