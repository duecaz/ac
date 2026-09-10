// Tiny hash router. Patterns: '#/home', '#/edit/:id', '#/play/:id'.
// Matching logic lives in routing.js (pure, tested); this file is browser glue.
import { compileRoute, matchRoute } from './routing.js';

/**
 * LO QUE UNA RUTA RECIBE. Los dos son cadenas: `:id` sale del camino ya
 * des-escapado y la consulta, de `parseQuery` — nada de números ni objetos, que
 * es justo lo que una vista no debe adivinar.
 * @typedef {Record<string, string>} RouteParams
 * @typedef {Record<string, string>} RouteQuery
 * @typedef {(params: RouteParams, query: RouteQuery) => unknown} RouteHandler
 * @typedef {{rx: RegExp, keys: string[], handler: RouteHandler}} CompiledRoute
 */

/** @type {CompiledRoute[]} */
const routes = [];
/** @type {() => void} */
let notFound = () => {};
/** @type {(() => void)|null} */
let beforeResolve = null;

// Hook run right before a route handler renders. Mains use it to clear the
// previous view's delegated listeners on the shared app root (see
// core/events.js clearListeners) so handlers never leak across views.
/** @param {(() => void)|null} fn */
export function setBeforeResolve(fn) { beforeResolve = fn; }

/**
 * @param {string} pattern
 * @param {RouteHandler} handler
 */
export function route(pattern, handler) {
  const { rx, keys } = compileRoute(pattern);
  routes.push({ rx, keys, handler });
}

/** @param {() => void} fn */
export function setNotFound(fn) { notFound = fn; }

/** @param {string} hash */
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
