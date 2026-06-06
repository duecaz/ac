// Tiny hash router. Patterns: '#/home', '#/edit/:id', '#/play/:id'.
// Matching logic lives in routing.js (pure, tested); this file is browser glue.
import { compileRoute, matchRoute } from './routing.js';

const routes = [];
let notFound = () => {};

export function route(pattern, handler) {
  const { rx, keys } = compileRoute(pattern);
  routes.push({ rx, keys, handler });
}

export function setNotFound(fn) { notFound = fn; }

export function navigate(hash) {
  if (location.hash === hash) return resolve();
  location.hash = hash;
}

export function resolve() {
  const hit = matchRoute(location.hash, routes);
  if (hit) return hit.handler(hit.params);
  notFound();
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
