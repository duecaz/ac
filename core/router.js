// Tiny hash router. Patterns: '#/home', '#/edit/:id', '#/play/:id'.
const routes = [];
let notFound = () => {};

export function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^#?' + pattern.replace(/:([\w]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ rx, keys, handler });
}

export function setNotFound(fn) { notFound = fn; }

export function navigate(hash) {
  if (location.hash === hash) return resolve();
  location.hash = hash;
}

export function resolve() {
  const h = location.hash || '#/';
  for (const r of routes) {
    const m = h.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      return r.handler(params);
    }
  }
  notFound();
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
