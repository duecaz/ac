// Pure routing logic — no `window`/`location`. Extracted from router.js so the
// pattern→regex compilation and matching can be unit-tested. router.js keeps the
// browser glue (hashchange, navigate); behaviour is byte-for-byte the same.

/**
 * Compile a route pattern (e.g. '#/edit/:id') into a matcher.
 * @returns {{ rx: RegExp, keys: string[] }}
 */
export function compileRoute(pattern) {
  const keys = [];
  const rx = new RegExp('^#?' + pattern.replace(/:([\w]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { rx, keys };
}

/**
 * First route (in registration order) whose regex matches `hash`.
 * @param {string} hash e.g. location.hash
 * @param {{rx:RegExp, keys:string[], handler:Function}[]} routes
 * @returns {{ handler: Function, params: Object }|null}
 */
export function matchRoute(hash, routes) {
  const h = hash || '#/';
  for (const r of routes) {
    const m = h.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params };
    }
  }
  return null;
}
