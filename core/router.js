// Tiny hash router. Patterns: '#/home', '#/edit/:id', '#/play/:id'.
// Matching logic lives in routing.js (pure, tested); this file is browser glue.
import { compileRoute, matchRoute } from './routing.js';

const routes = [];
let notFound = () => {};
let beforeResolve = null;

// Hook run right before a route handler renders. Mains use it to clear the
// previous view's delegated listeners on the shared app root (see
// core/events.js clearListeners) so handlers never leak across views.
export function setBeforeResolve(fn) { beforeResolve = fn; }

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
  if (beforeResolve) { try { beforeResolve(); } catch {} }
  const hit = matchRoute(location.hash, routes);
  // Segundo argumento: los parámetros de consulta (`?q=…`). Los handlers que no
  // los usan lo ignoran, así que añadirlo no toca ninguna ruta existente.
  if (hit) return hit.handler(hit.params, hit.query);
  notFound();
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
