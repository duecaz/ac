// Preview LIGERO y esquemático de una actividad para la rejilla del home.
// A diferencia de core/activityThumb.js (que renderiza el JUEGO real escalado —
// caro con muchas tarjetas), esto devuelve un dibujo fijo por tipo de plantilla:
// unos pocos <div>/<svg> estáticos, sin timers, sin skin/fondo, sin transform.
// CADA plantilla registrada tiene su esquema (nunca cae al genérico): lo garantiza
// tests/homePreview.test.mjs. Estilos .pv-* en styles/home.css.
import { escapeHtml } from './html.js';
import { getTemplate } from './registry.js';
import { getSkin } from './skins.js';

// Fondo REPRESENTATIVO por textura (backgrounds.css vive en clases body/frame que no
// alcanzan a .acard-preview; a tamaño miniatura basta el color/gradiente dominante).
const BG_REPR = {
  notebook:   'repeating-linear-gradient(#ffffff,#ffffff 13px,#d7e3f0 14px,#ffffff 15px)',
  blackboard: '#2f4a3a',
  greenboard: '#1f5c43',
  paper:      '#efe7d3',
  grid:       'repeating-linear-gradient(#ffffff,#ffffff 12px,#e3e9f2 13px),repeating-linear-gradient(90deg,#ffffff,#ffffff 12px,#e3e9f2 13px)',
  corkboard:  '#c8a06a',
  classroom:  '#f3e7d2',
  arena:      'radial-gradient(circle at 50% 0%,#25325a,#0f1830)',
  stars:      'radial-gradient(circle at 50% 20%,#1e1b4b,#0b1024)',
};

// Fondo del preview según la presentación de la actividad: fondo elegido > skin >
// (nada → el neutro por defecto de .acard-preview). 'custom' (imagen propia) se omite
// a propósito por rendimiento (data-URL por tarjeta). Devuelve un valor CSS o ''.
export function previewBgStyle(presentation) {
  const bg = presentation?.background;
  if (bg && BG_REPR[bg]) return BG_REPR[bg];
  const skin = presentation?.skin;
  if (skin && skin !== 'default') {
    const s = getSkin(skin);
    return s?.bgImage || s?.cssVars?.['--ww-bg'] || '';
  }
  return '';
}

const esc = escapeHtml;                                     // ya coacciona null → ''
const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const et = (s, n) => esc(trunc(s, n));                      // truncar + escapar (uso común)

// Memo: el esquema es un string puro que solo depende de (template, content).
// Clave id:updatedAt → al guardar/editar cambia updatedAt y se invalida sola.
// Tope LRU para no crecer sin límite con bancos grandes.
const _cache = new Map();
const CACHE_CAP = 300;

export function homePreviewHtml(a) {
  const key = a?.id ? `${a.id}:${a.updatedAt || ''}` : null;
  if (key && _cache.has(key)) {
    const v = _cache.get(key);
    _cache.delete(key); _cache.set(key, v);   // refresca orden LRU
    return v;
  }
  const html = build(a);
  if (key) {
    _cache.set(key, html);
    if (_cache.size > CACHE_CAP) _cache.delete(_cache.keys().next().value);
  }
  return html;
}

function build(a) {
  const c = a?.content || {};
  try {
    switch (a?.template) {
      case 'match':         return matchPv(c);
      case 'diagram':       return diagramPv(c);
      case 'math':          return calcPv(c);
      case 'quiz':          return quizPv(c);
      case 'globos':        return globosPv(c);
      case 'comas':
      case 'tildes':        return textPv(c);
      case 'memory':        return memoryPv(c);
      case 'wheel':         return wheelPv(c);
      case 'wordsearch':    return wordsearchPv(c);
      case 'crossword':     return crosswordPv(c);
      case 'ballsort':      return ballsortPv(c);
      case 'question-live': return boxesPv(c);
      default:              return genericPv(a);
    }
  } catch { return genericPv(a); }
}

// ── Emparejar: dos columnas de fichas + cuerdas cruzando el pasillo ──────────
function matchPv(c) {
  const pairs = (c.pairs || []).slice(0, 4);
  if (!pairs.length) return genericPv({ template: 'match' });
  const L = pairs.map(p => `<span class="pv-chip pv-chip--l">${et(p.left, 12)}</span>`).join('');
  const R = pairs.map(p => `<span class="pv-chip pv-chip--r">${et(p.right, 12)}</span>`).join('');
  const curves = `<svg class="pv-match__ropes" viewBox="0 0 46 90" preserveAspectRatio="none">
    <path d="M0 14C22 14 24 44 46 44" stroke="#8b5cf6" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M0 44C22 44 24 14 46 14" stroke="#14b8a6" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M0 74C22 74 24 74 46 74" stroke="#f59e0b" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;
  return `<div class="pv pv-match"><div class="pv-col">${L}</div>${curves}<div class="pv-col">${R}</div></div>`;
}

// ── Etiqueta el diagrama: la imagen real (barata como <img>) + fichas ────────
function diagramPv(c) {
  const labels = (c.pins || []).slice(0, 3).map(p => `<span class="pv-tag">${et(p.label, 10)}</span>`).join('');
  const src = c.image ? (String(c.image).startsWith('data:') ? c.image : esc(c.image)) : '';
  const img = src ? `<img class="pv-diagram__img" src="${src}" alt="" loading="lazy" decoding="async">` : '';
  if (!img && !labels) return genericPv({ template: 'diagram' });
  return `<div class="pv pv-diagram"><div class="pv-tags">${labels}</div>${img}</div>`;
}

// ── Operaciones: panel tipo calculadora con una operación de muestra ─────────
function calcPv(c) {
  const first = (c.items || [])[0];
  const op = first?.question ? trunc(first.question, 10) : '20 × 5';
  return `<div class="pv pv-calc">
    <div class="pv-calc__disp">${esc(op)} =</div>
    <div class="pv-calc__screen">0</div>
    <div class="pv-calc__pad">${'<span></span>'.repeat(5)}<span class="ok"></span></div>
  </div>`;
}

// ── Quiz: pregunta + rejilla 2×2 de opciones de color ────────────────────────
function quizPv(c) {
  const it = (c.items || [])[0];
  const q = it?.question ? trunc(it.question, 40) : 'Pregunta';
  const opts = (it?.options || ['A', 'B', 'C', 'D']).slice(0, 4);
  const cls = ['pv-opt--a', 'pv-opt--b', 'pv-opt--c', 'pv-opt--d'];
  const cells = opts.map((o, i) => `<span class="pv-opt ${cls[i] || ''}">${et(o, 12)}</span>`).join('');
  return `<div class="pv pv-quiz"><div class="pv-quiz__q">${esc(q)}</div><div class="pv-quiz__grid">${cells}</div></div>`;
}

// ── Explota Globos: globos de color con cuerda, uno reventando ───────────────
function globosPv() {
  const B = [['#ef4444', 26], ['#2563eb', 62], ['#16a34a', 98], ['#f59e0b', 134]];
  const balloons = B.map(([col, x]) =>
    `<ellipse cx="${x}" cy="34" rx="15" ry="18" fill="${col}"/>
     <path d="M${x} 52 q4 8 -2 16 q-6 8 2 16" stroke="#9aa2ad" stroke-width="1.5" fill="none"/>`).join('');
  // globo reventando (estrella) a la derecha
  const burst = `<g transform="translate(170,32)" fill="none" stroke="#ec4899" stroke-width="3" stroke-linecap="round">
    <path d="M0 -14V-6M0 14V6M-14 0H-6M14 0H6M-10 -10l5 5M10 10l-5 -5M10 -10l-5 5M-10 10l5 -5"/></g>`;
  return `<div class="pv pv-globos"><svg viewBox="0 0 196 96" preserveAspectRatio="xMidYMid meet">${balloons}${burst}</svg></div>`;
}

// ── Correcciones de texto (comas/tildes): frase + subrayado + "Listo" ────────
function textPv(c) {
  const p = (c.passages || [])[0];
  const t = p?.text ? trunc(p.text, 34) : 'Escribe aquí…';
  return `<div class="pv pv-text">
    <div class="pv-text__line">${esc(t)}</div>
    <div class="pv-text__rule"></div>
    <span class="pv-text__ok">✓ Listo</span>
  </div>`;
}

// ── Memoria: rejilla de cartas boca abajo (nº según pares, tope 8) ───────────
function memoryPv(c) {
  const pairs = (c.pairs || []).length || 4;
  const n = Math.min(Math.max(pairs, 3) * 2, 8);
  return `<div class="pv pv-memory">${'<span></span>'.repeat(n)}</div>`;
}

// ── Ruleta: disco de 8 sectores (conic-gradient) + eje + aguja ───────────────
function wheelPv() {
  return `<div class="pv pv-wheel"><div class="pv-wheel__disc"></div><b class="pv-wheel__hub"></b><i class="pv-wheel__pin"></i></div>`;
}

// ── Sopa de letras: rejilla 5×5, la primera palabra resaltada en diagonal ────
function wordsearchPv(c) {
  const raw = (c.words || []).map(w => typeof w === 'string' ? w : (w?.text || w?.word || '')).find(Boolean) || 'GATO';
  const w = String(raw).toUpperCase().replace(/[^A-ZÑ]/g, '').slice(0, 5) || 'GATO';
  const fill = 'RPLOMESANDTVCUIBFHKZ';
  let cells = '';
  for (let i = 0; i < 25; i++) {
    const r = Math.floor(i / 5), col = i % 5;
    const hit = r === col && r < w.length;
    const ch = hit ? w[r] : fill[(i * 7) % fill.length];
    cells += `<span class="${hit ? 'pv-word__hit' : ''}">${esc(ch)}</span>`;
  }
  return `<div class="pv pv-word"><div class="pv-word__grid">${cells}</div></div>`;
}

// ── Crucigrama: rejilla 5×5 con celdas negras/blancas y unas letras ──────────
function crosswordPv() {
  const pat = [0,1,1,1,0, 1,1,2,1,1, 1,2,1,2,1, 1,1,2,1,1, 0,1,1,1,0]; // 0 negra · 1 blanca · 2 letra
  const letters = ['S', 'O', 'L', 'A', 'Z'];
  let li = 0, cells = '';
  for (const v of pat) {
    if (v === 0) cells += `<span class="pv-cross__b"></span>`;
    else if (v === 2) cells += `<span class="pv-cross__l">${letters[li++ % letters.length]}</span>`;
    else cells += `<span></span>`;
  }
  return `<div class="pv pv-cross"><div class="pv-cross__grid">${cells}</div></div>`;
}

// ── Ordena las Pelotas: 3 tubos con bolas de color, uno a medio ordenar ──────
function ballsortPv() {
  const tubes = [
    ['#ef4444', '#2563eb', '#16a34a', '#f59e0b'],
    ['#2563eb', '#16a34a', '#ef4444', ''],
    ['#f59e0b', '', '', ''],
  ];
  const html = tubes.map(t => `<div class="pv-tube">${
    t.map(col => col ? `<b style="background:${col}"></b>` : `<b class="pv-tube__empty"></b>`).join('')
  }</div>`).join('');
  return `<div class="pv pv-balls">${html}</div>`;
}

// ── Abre Cajas (question-live): 6 cajas 3×2, una abierta con estrella ────────
function boxesPv() {
  let cells = '';
  for (let i = 0; i < 6; i++) {
    cells += i === 1
      ? `<span class="pv-box pv-box--open">★</span>`
      : `<span class="pv-box">${i + 1}</span>`;
  }
  return `<div class="pv pv-boxes"><div class="pv-boxes__grid">${cells}</div></div>`;
}

// ── Respaldo (último recurso; el test garantiza que no se usa con las 13) ─────
function genericPv(a) {
  const T = getTemplate(a?.template);
  const color = T?.meta?.color || 'secondary';
  const icon = T?.meta?.icon || 'bi-puzzle';
  const label = T?.meta?.label || a?.template || '';
  return `<div class="pv pv-generic tag--${esc(color)}">
    <i class="bi ${icon}"></i><span>${esc(label)}</span>
  </div>`;
}
