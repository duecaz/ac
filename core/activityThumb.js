// Faithful 16:9 activity thumbnail. Instead of a hand-drawn canvas image, we
// statically render the FIRST screen of the activity reusing the exact same CSS
// classes the real players use (.ww-player, .ww-kahoot-grid, .ww-match, etc.),
// inside a fixed 960×540 stage that is scaled down to the card width with a CSS
// transform. No timers, no event handlers, no game-event side effects — it is
// pure markup, so it is safe to mount many of them on the home grid.
import { escapeHtml } from './html.js';
import { applySkin } from './skins.js';

const STAGE_W = 960, STAGE_H = 540;
const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const css = `
    .ww-thumb{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;
      border-radius:.375rem .375rem 0 0;pointer-events:none;background:#0b1020;}
    .ww-thumb-stage{position:absolute;top:0;left:0;transform-origin:top left;
      width:${STAGE_W}px!important;height:${STAGE_H}px!important;max-width:none!important;
      margin:0!important;aspect-ratio:auto!important;overflow:hidden;}
    .ww-thumb-stage .ww-player,.ww-thumb-stage .ww-match,
    .ww-thumb-stage .ww-memory{height:100%;}`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}

// ── Per-template static first-screen markup ─────────────────────────────────
function headHtml(idx, total) {
  return `<div class="ww-phead d-flex justify-content-between align-items-center">
    <span class="badge bg-secondary">${idx} / ${total}</span>
    <span class="badge bg-primary">★ 0</span></div>`;
}

function emptyHtml(act) {
  return `<div class="ww-player" style="display:flex;align-items:center;justify-content:center">
    <h2 class="text-center">${escapeHtml(act.title || 'Actividad')}</h2></div>`;
}

function quizHtml(act) {
  const items = act.content?.items || [];
  const it = items[0];
  if (!it) return emptyHtml(act);
  const opts = (it.options || []).slice(0, 6);
  return `<div class="ww-player">
    ${headHtml(1, items.length)}
    <h3 class="ww-q">${escapeHtml(it.question || '')}</h3>
    <div class="ww-q-media">${it.image ? `<img src="${escapeHtml(it.image)}" alt="">` : ''}</div>
    <div class="ww-kahoot-grid ww-options">
      ${opts.map((o, i) => `<button class="btn btn-lg w-100 ww-opt ww-shape-${(i % 4) + 1}">
        <i class="bi ${SHAPE_ICONS[i % 4]} me-2"></i>${escapeHtml(o)}</button>`).join('')}
    </div>
  </div>`;
}

function mathHtml(act) {
  const items = act.content?.items || [];
  const it = items[0];
  if (!it) return emptyHtml(act);
  return `<div class="ww-player ww-math">
    ${headHtml(1, items.length)}
    <div class="ww-math-round"><div class="ww-keypad-round">
      <div class="ww-keypad-q">${escapeHtml(it.question || '')} <span class="ww-keypad-eq">=</span></div>
      <div class="ww-keypad-display">0</div>
      <div class="ww-keypad">
        ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="btn ww-key">${n}</button>`).join('')}
        <button class="btn ww-key ww-key-fn"><i class="bi bi-backspace"></i></button>
        <button class="btn ww-key">0</button>
        <button class="btn ww-key ww-key-ok"><i class="bi bi-check-lg"></i></button>
      </div>
    </div></div>
  </div>`;
}

function matchHtml(act) {
  const pairs = (act.content?.pairs || [])
    .filter(p => String(p.left||'').trim() && String(p.right||'').trim()).slice(0, 5);
  if (!pairs.length) return emptyHtml(act);
  const card = t => `<button class="ww-card btn w-100 mb-2 text-start">${escapeHtml(t)}</button>`;
  const lefts = pairs.map(p => p.left);
  const rights = pairs.map(p => p.right).reverse();
  return `<div class="ww-match">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="badge bg-secondary">0 / ${pairs.length}</span>
      <span class="badge bg-primary">★ 0</span></div>
    <h4 class="text-center mb-4">${escapeHtml(act.title || '')}</h4>
    <div class="row g-2">
      <div class="col-6">${lefts.map(card).join('')}</div>
      <div class="col-6">${rights.map(card).join('')}</div>
    </div>
  </div>`;
}

function memoryHtml(act) {
  const pairs = (act.content?.pairs || [])
    .filter(p => String(p.left||'').trim() && String(p.right||'').trim());
  if (!pairs.length) return emptyHtml(act);
  const cols = Math.max(2, Math.min(8, act.rules?.columns || 4));
  let cells = '';
  for (let i = 0; i < pairs.length * 2; i++)
    cells += `<button class="mc"><i class="bi bi-question-lg"></i></button>`;
  return `<div class="ww-memory">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="badge bg-secondary">0 / ${pairs.length}</span>
      <span class="badge bg-info text-dark">Flips: 0</span>
      <span class="badge bg-primary">★ 0</span></div>
    <h5 class="text-center mb-3">${escapeHtml(act.title || '')}</h5>
    <div class="ww-memo-grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>
  </div>`;
}

function textHtml(act) {
  const ps = act.content?.passages || act.content?.items || [];
  const first = ps[0];
  const text = typeof first === 'string' ? first : (first?.text || first?.passage || first?.question || '');
  if (!text) return emptyHtml(act);
  return `<div class="ww-player">
    ${headHtml(1, ps.length)}
    <h3 class="ww-q" style="line-height:1.7;font-weight:500">${escapeHtml(text)}</h3>
  </div>`;
}

function wheelHtml(act) {
  const items = act.content?.items || act.content?.words || [];
  const labels = items.map(i => typeof i === 'string' ? i : (i.text || i.label || i.question || ''))
    .filter(Boolean).slice(0, 8);
  const colors = ['#0d6efd','#198754','#dc3545','#ffc107','#0dcaf0','#6610f2','#fd7e14','#20c997'];
  const n = Math.max(1, labels.length);
  const seg = 360 / n;
  const stops = labels.length
    ? labels.map((_, i) => `${colors[i % colors.length]} ${i*seg}deg ${(i+1)*seg}deg`).join(',')
    : '#6c757d 0deg 360deg';
  return `<div class="ww-player" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem">
    <div style="width:340px;height:340px;border-radius:50%;background:conic-gradient(${stops});
      box-shadow:0 0 0 10px rgba(255,255,255,.15),0 10px 30px rgba(0,0,0,.35);position:relative">
      <div style="position:absolute;inset:42%;background:#fff;border-radius:50%"></div>
    </div>
    <div class="fs-4 fw-semibold text-center">${escapeHtml(act.title || 'Ruleta')}</div>
  </div>`;
}

function buildHtml(act) {
  switch (act.template) {
    case 'quiz':   return quizHtml(act);
    case 'math':   return mathHtml(act);
    case 'match':  return matchHtml(act);
    case 'memory': return memoryHtml(act);
    case 'tildes':
    case 'comas':  return textHtml(act);
    case 'wheel':  return wheelHtml(act);
    default:
      if (act.content?.items?.[0]?.options) return quizHtml(act);
      if (act.content?.pairs?.length)       return matchHtml(act);
      if (act.content?.passages?.length)    return textHtml(act);
      return emptyHtml(act);
  }
}

// ── Scaling: one shared resize listener rescales every mounted thumb. ────────
const _mounted = new Set();
let _bound = false;
function rescaleAll() {
  for (const c of [..._mounted]) {
    if (!document.contains(c)) { _mounted.delete(c); continue; }
    const stage = c.firstElementChild;
    if (!stage) continue;
    const w = c.clientWidth;
    if (w) stage.style.transform = `scale(${w / STAGE_W})`;
  }
}
function ensureBound() {
  if (_bound) return;
  _bound = true;
  if (typeof window !== 'undefined') window.addEventListener('resize', rescaleAll);
}

// Mounts a faithful 16:9 preview of `activity` into `container`.
export function mountThumb(container, activity) {
  if (!container) return;
  injectStyles();
  container.classList.add('ww-thumb');
  container.innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'ww-thumb-stage ww-player-frame';
  stage.innerHTML = buildHtml(activity);
  container.appendChild(stage);
  try { applySkin(activity.presentation?.skin || 'default', stage); } catch { /* skin optional */ }
  _mounted.add(container);
  ensureBound();
  requestAnimationFrame(rescaleAll);
}
