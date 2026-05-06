// Shared editor primitives. Templates compose these instead of redefining
// title/subtitle inputs, tab strips, or list-item controls each time.
// Pure functions: return HTML strings; attach handlers via separate helpers.
import { escapeHtml } from './html.js';

// Title/subtitle inputs at the top of any editor.
export function metaHeaderHtml(a) {
  return `
    <div class="row g-2 mb-3">
      <div class="col-md-8"><label class="form-label small">Título</label><input class="form-control" data-meta="title" value="${escapeHtml(a.title)}"></div>
      <div class="col-md-4"><label class="form-label small">Subtítulo</label><input class="form-control" data-meta="subtitle" value="${escapeHtml(a.subtitle || '')}"></div>
    </div>`;
}

// Wire delegated input handlers for the meta header.
export function attachMetaHeader(rootSel, activity, onChange) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  if (!root) return;
  root.addEventListener('input', (e) => {
    const m = e.target.dataset?.meta;
    if (!m) return;
    activity[m] = e.target.value;
    onChange(activity);
  });
}

// Bootstrap tabs scaffold. tabs = [{ id, label, icon? }], content() returns
// HTML for each by id. The first tab is active.
export function tabsHtml(tabs, contentFn) {
  return `
    <ul class="nav nav-tabs" role="tablist">
      ${tabs.map((t, i) => `
        <li class="nav-item">
          <button class="nav-link ${i===0?'active':''}" data-bs-toggle="tab" data-bs-target="#${t.id}">
            ${t.label}${t.icon?' <i class="bi '+t.icon+'"></i>':''}
            ${t.badge ? ' <span class="badge bg-warning text-dark ms-1">'+t.badge+'</span>' : ''}
          </button>
        </li>`).join('')}
    </ul>
    <div class="tab-content border border-top-0 p-3 rounded-bottom">
      ${tabs.map((t, i) => `<div class="tab-pane fade ${i===0?'show active':''}" id="${t.id}">${contentFn(t.id)}</div>`).join('')}
    </div>`;
}

// Item-row control buttons: reorder up/down + delete. Use with .item-up,
// .item-down, .item-del classes; index in data-i.
export function itemControlsHtml(idx, total) {
  return `
    <div class="btn-group btn-group-sm">
      <button class="btn btn-outline-secondary item-up" data-i="${idx}" ${idx===0?'disabled':''} title="Subir"><i class="bi bi-arrow-up"></i></button>
      <button class="btn btn-outline-secondary item-down" data-i="${idx}" ${idx===total-1?'disabled':''} title="Bajar"><i class="bi bi-arrow-down"></i></button>
      <button class="btn btn-outline-danger item-del" data-i="${idx}" title="Eliminar"><i class="bi bi-trash"></i></button>
    </div>`;
}

// Mutate an array in place to reorder by direction (-1 up, +1 down).
export function reorderArray(arr, idx, direction) {
  const j = idx + direction;
  if (j < 0 || j >= arr.length) return false;
  const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
  return true;
}

// Wire the reorder/delete handlers for any list whose items live at
// `pathFn(activity)` (returns the array to mutate). Caller passes a re-render
// function to invoke after each change.
export function attachItemControls(rootSel, getArr, onChange, repaint) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  if (!root) return;
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.item-up, .item-down, .item-del');
    if (!btn) return;
    const i = +btn.dataset.i;
    const arr = getArr();
    if (btn.classList.contains('item-up')) reorderArray(arr, i, -1);
    else if (btn.classList.contains('item-down')) reorderArray(arr, i, +1);
    else if (btn.classList.contains('item-del')) arr.splice(i, 1);
    onChange();
    repaint();
  });
}
