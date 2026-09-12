// Tiny tagged-template HTML builder. Returns a string. NOT a DOM library.
// Use for building markup; wire events with delegation in events.js.
/**
 * @param {TemplateStringsArray|readonly string[]} strings
 * @param {...unknown} values
 * @returns {string}
 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) {
      const v = values[i];
      if (v == null || v === false) return;
      if (Array.isArray(v)) out += v.join('');
      else out += String(v);
    }
  });
  return out;
}

/** @type {Record<string, string>} */
const ESCAPES = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };

/**
 * @param {unknown} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ESCAPES[c]);
}


// ─── EL DOM TIENE DUEÑO ──────────────────────────────────────────────────────
// Media plataforma recibe su raíz como `string|Element` (los players, los
// modos, las vistas) y cada uno tecleaba el mismo ternario: veinticinco copias
// de `typeof x === 'string' ? document.querySelector(x) : x`. Ya mordió dos
// veces — `views/memoryView.js` preguntaba `isConnected` a una CADENA, que
// siempre es `undefined`, así que el guard «¿sigue viva la pantalla?» nunca
// paraba nada. Aquí está una vez.

/** @param {string|ParentNode|null|undefined} x @returns {ParentNode|null} */
const nodo = (x) => (typeof x === 'string' ? document.querySelector(x) : (x ?? null));

/** LA RAÍZ, venga como selector o ya resuelta. `null` si no está en el DOM. */
/** @param {string|Element|null|undefined} sel @returns {Element|null} */
export function raizDe(sel) { return /** @type {Element|null} */ (nodo(sel)); }

/**
 * @template {Element} [T=HTMLElement]
 * @param {string} sel
 * @param {string|ParentNode|null} [root]
 * @returns {T|null}
 */
export function $(sel, root = document) {
  const r = nodo(root);
  return r ? /** @type {T|null} */ (r.querySelector(sel)) : null;
}
/**
 * @template {Element} [T=HTMLElement]
 * @param {string} sel
 * @param {string|ParentNode|null} [root]
 * @returns {T[]}
 */
export function $$(sel, root = document) {
  const r = nodo(root);
  return r ? [...(/** @type {NodeListOf<T>} */ (r.querySelectorAll(sel)))] : [];
}

/** El CAMPO que casa con el selector (un `input`, un `select`, un `textarea`:
 *  todos se leen por `.value`). Evita el cast a mano en cada llamador. */
/** @param {string} sel @param {string|ParentNode|null} [root] @returns {HTMLInputElement|null} */
export function $input(sel, root = document) { return $(sel, root); }

/** Lo TECLEADO en ese campo (cadena vacía si no existe). */
/** @param {string} sel @param {string|ParentNode|null} [root] @returns {string} */
export function $val(sel, root = document) { return $input(sel, root)?.value ?? ''; }

/** El campo que disparó un evento, o el elemento que el delegador entregó.
 *  Los dos casos conviven en los editores (`on(root, 'input', sel, (e, el) => …)`)
 *  y por eso `valorDe` acepta cualquiera de los dos. */
/** @param {Event|Element|null|undefined} x @returns {HTMLInputElement|null} */
function campoDe(x) {
  if (!x) return null;
  return /** @type {HTMLInputElement|null} */ ('target' in x ? x.target : x);
}

/** Lo tecleado (o elegido) en ese campo. @param {Event|Element|null|undefined} x @returns {string} */
export function valorDe(x) { return campoDe(x)?.value ?? ''; }

/** Si ese interruptor queda marcado. @param {Event|Element|null|undefined} x @returns {boolean} */
export function marcado(x) { return !!campoDe(x)?.checked; }

/**
 * @param {string|Element} el
 * @param {string} htmlStr
 * @returns {Element}
 */
export function mount(el, htmlStr) {
  const root = raizDe(el);
  if (!root) throw new Error('mount: root not found');
  root.innerHTML = htmlStr;
  return root;
}
