// Per-route resource tracker. View renderers grab a context, register
// disposers (intervals, subscriptions, listeners). On hashchange OR on a
// new acquire() of the same view, the previous batch is torn down.
//
// Usage in a view:
//   const ctx = acquire('hostLive');
//   ctx.add(() => clearInterval(t));
//   ctx.add(unsubscribeFromRoom);
//
// Replaces the brittle `window.addEventListener('hashchange', () => unsub(),
// {once:true})` pattern that left tickers/subs orphaned across re-renders.

/** @type {Map<string, Array<() => void>>} */
const _bag = new Map(); // viewKey -> Array<dispose>

/** @param {string} key */
function disposeAll(key) {
  const arr = _bag.get(key) || [];
  while (arr.length) {
    const fn = arr.pop();
    try { fn?.(); } catch (e) { console.warn('[lifecycle] dispose error:', e); }
  }
  _bag.delete(key);
}

/** Drena los disposers de una vista SIN volver a montarla. Para vistas
 *  embebidas (VS/Equipos dentro del stage) cuyo ciclo lo maneja un padre
 *  (playerView llama dispose() al cambiar de modo): el padre suelta aquí lo que
 *  la vista registró con acquire(). En navegación normal no hace falta — el
 *  hashchange ya drena todo.
 * @param {string} key */
export function release(key) { disposeAll(key); }

/**
 * @param {string} key
 */
export function acquire(key) {
  // Tear down anything from the previous mount of this view.
  disposeAll(key);
  /** @type {Array<() => void>} */
  const arr = [];
  _bag.set(key, arr);
  return {
    key,
    /**
     * @template {(() => void)|null|undefined} T
     * @param {T} disposer
     * @returns {T}
     */
    add(disposer) { if (typeof disposer === 'function') arr.push(disposer); return disposer; },
    /**
     * @param {() => void} fn
     * @param {number} ms
     */
    setInterval(fn, ms) {
      const h = setInterval(fn, ms);
      arr.push(() => clearInterval(h));
      return h;
    },
    /**
     * @param {() => void} fn
     * @param {number} ms
     */
    setTimeout(fn, ms) {
      const h = setTimeout(fn, ms);
      arr.push(() => clearTimeout(h));
      return h;
    }
  };
}

// Tear down EVERY tracked view. Called on hashchange so leaving any view
// drains its resources.
function disposeEverything() { for (const k of [..._bag.keys()]) disposeAll(k); }
// Guarded so lifecycle is importable/testable outside a browser.
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', disposeEverything);
}
