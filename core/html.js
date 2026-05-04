// Tiny tagged-template HTML builder. Returns a string. NOT a DOM library.
// Use for building markup; wire events with delegation in events.js.
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

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function mount(el, htmlStr) {
  const root = typeof el === 'string' ? document.querySelector(el) : el;
  if (!root) throw new Error('mount: root not found');
  root.innerHTML = htmlStr;
  return root;
}
