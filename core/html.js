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


/**
 * @template {Element} [T=HTMLElement]
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {T|null}
 */
export function $(sel, root = document) { return /** @type {T|null} */ (root.querySelector(sel)); }
/**
 * @template {Element} [T=HTMLElement]
 * @param {string} sel
 * @param {ParentNode} [root]
 * @returns {T[]}
 */
export function $$(sel, root = document) { return [...(/** @type {NodeListOf<T>} */ (root.querySelectorAll(sel)))]; }

/**
 * @param {string|Element} el
 * @param {string} htmlStr
 * @returns {Element}
 */
export function mount(el, htmlStr) {
  const root = typeof el === 'string' ? document.querySelector(el) : el;
  if (!root) throw new Error('mount: root not found');
  root.innerHTML = htmlStr;
  return root;
}
