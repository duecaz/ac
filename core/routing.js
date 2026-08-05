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
 * Los parámetros de consulta de un hash: `#/explore?q=comas&lang=es` → `{q, lang}`.
 * Devuelve siempre un objeto (vacío si no hay `?`), para que quien lo lea no
 * tenga que comprobar nada.
 */
export function parseQuery(hash) {
  const i = String(hash || '').indexOf('?');
  if (i < 0) return {};
  const out = {};
  for (const par of String(hash).slice(i + 1).split('&')) {
    if (!par) continue;
    const j = par.indexOf('=');
    const k = j < 0 ? par : par.slice(0, j);
    const v = j < 0 ? '' : par.slice(j + 1);
    try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); }
    catch { out[k] = v; }   // un % suelto no puede tumbar el enrutado
  }
  return out;
}

/**
 * First route (in registration order) whose regex matches `hash`.
 *
 * La CONSULTA (`?q=…`) se separa ANTES de comparar. Sin esto, un enlace que la
 * propia app generaba —el buscador de la portada navegaba a
 * `#/explore?q=comas`— no casaba con NINGUNA ruta y el profe acababa en "Ruta no
 * encontrada" al buscar. El patrón de ruta describe el CAMINO; los parámetros
 * son datos, no parte del camino.
 *
 * @param {string} hash e.g. location.hash
 * @param {{rx:RegExp, keys:string[], handler:Function}[]} routes
 * @returns {{ handler: Function, params: Object, query: Object }|null}
 */
export function matchRoute(hash, routes) {
  const raw = hash || '#/';
  const q = raw.indexOf('?');
  const path = q < 0 ? raw : raw.slice(0, q);
  const query = parseQuery(raw);
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params, query };
    }
  }
  return null;
}
