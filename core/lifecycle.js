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

const _bag = new Map(); // viewKey -> Array<dispose>

function disposeAll(key) {
  const arr = _bag.get(key) || [];
  while (arr.length) {
    const fn = arr.pop();
    try { fn?.(); } catch (e) { console.warn('[lifecycle] dispose error:', e); }
  }
  _bag.delete(key);
}

export function acquire(key) {
  // Tear down anything from the previous mount of this view.
  disposeAll(key);
  const arr = [];
  _bag.set(key, arr);
  return {
    key,
    add(disposer) { if (typeof disposer === 'function') arr.push(disposer); return disposer; },
    setInterval(fn, ms) {
      const h = setInterval(fn, ms);
      arr.push(() => clearInterval(h));
      return h;
    },
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
window.addEventListener('hashchange', disposeEverything);
