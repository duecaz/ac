// Preview LIGERO y esquemático de una actividad para la rejilla del home.
// A diferencia de core/activityThumb.js (que renderiza el JUEGO real escalado —
// caro con muchas tarjetas), esto devuelve un dibujo fijo por tipo de plantilla:
// unos pocos <div>/<svg> estáticos, sin timers, sin skin/fondo, sin transform.
// Rápido con 19+ tarjetas y con la estética del mockup. Estilos en styles/home.css.
import { escapeHtml } from './html.js';
import { getTemplate } from './registry.js';

const esc = escapeHtml;                                     // ya coacciona null → ''
const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const et = (s, n) => esc(trunc(s, n));                      // truncar + escapar (uso común)

export function homePreviewHtml(a) {
  const c = a?.content || {};
  try {
    switch (a?.template) {
      case 'match':   return matchPv(c);
      case 'diagram': return diagramPv(c);
      case 'math':    return calcPv(c);
      case 'quiz':    return quizPv(c);
      case 'comas':
      case 'tildes':  return textPv(c);
      case 'memory':  return memoryPv(c);
      default:        return genericPv(a);
    }
  } catch { return genericPv(a); }
}

// Emparejar: dos columnas de fichas + curvas cruzando el pasillo.
function matchPv(c) {
  const pairs = (c.pairs || []).slice(0, 4);
  if (!pairs.length) return genericPv({ template: 'match' });
  const L = pairs.map(p => `<span class="pv-chip pv-chip--l">${et(p.left, 12)}</span>`).join('');
  const R = pairs.map(p => `<span class="pv-chip pv-chip--r">${et(p.right, 12)}</span>`).join('');
  // Curvas fijas (estética): 3 trazos, un par cruzado.
  const curves = `
    <svg class="pv-match__ropes" viewBox="0 0 46 90" preserveAspectRatio="none">
      <path d="M0 14C22 14 24 44 46 44" stroke="#8b5cf6" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M0 44C22 44 24 14 46 14" stroke="#14b8a6" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M0 74C22 74 24 74 46 74" stroke="#f59e0b" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`;
  return `<div class="pv pv-match"><div class="pv-col">${L}</div>${curves}<div class="pv-col">${R}</div></div>`;
}

// Etiqueta el diagrama: la imagen real (barata como <img>) + fichas de etiqueta.
function diagramPv(c) {
  const labels = (c.pins || []).slice(0, 3).map(p => `<span class="pv-tag">${et(p.label, 10)}</span>`).join('');
  // Los data-URL (base64) no contienen comillas → no hace falta escapear su enorme
  // cadena en cada tecleo; solo se escapa una URL externa por seguridad del atributo.
  const src = c.image ? (String(c.image).startsWith('data:') ? c.image : esc(c.image)) : '';
  const img = src ? `<img class="pv-diagram__img" src="${src}" alt="" loading="lazy">` : '';
  if (!img && !labels) return genericPv({ template: 'diagram' });
  return `<div class="pv pv-diagram"><div class="pv-tags">${labels}</div>${img}</div>`;
}

// Operaciones: panel tipo calculadora con una operación de muestra.
function calcPv(c) {
  const first = (c.items || [])[0];
  const op = first?.question ? trunc(first.question, 10) : '20 × 5';
  return `<div class="pv pv-calc">
    <div class="pv-calc__disp">${esc(op)} =</div>
    <div class="pv-calc__screen">0</div>
    <div class="pv-calc__pad">${'<span></span>'.repeat(5)}<span class="ok"></span></div>
  </div>`;
}

// Quiz: pregunta + rejilla 2×2 de opciones de color.
function quizPv(c) {
  const it = (c.items || [])[0];
  const q = it?.question ? trunc(it.question, 40) : 'Pregunta';
  const opts = (it?.options || ['A', 'B', 'C', 'D']).slice(0, 4);
  const cls = ['pv-opt--a', 'pv-opt--b', 'pv-opt--c', 'pv-opt--d'];
  const cells = opts.map((o, i) => `<span class="pv-opt ${cls[i] || ''}">${et(o, 12)}</span>`).join('');
  return `<div class="pv pv-quiz"><div class="pv-quiz__q">${esc(q)}</div><div class="pv-quiz__grid">${cells}</div></div>`;
}

// Correcciones de texto (comas/tildes): frase + subrayado + "Listo".
function textPv(c) {
  const p = (c.passages || [])[0];
  const t = p?.text ? trunc(p.text, 36) : 'Escribe aquí…';
  return `<div class="pv pv-text">
    <div class="pv-text__line">${esc(t)}</div>
    <div class="pv-text__rule"></div>
    <span class="pv-text__ok">✓ Listo</span>
  </div>`;
}

// Memoria: rejilla de cartas boca abajo.
function memoryPv() {
  return `<div class="pv pv-memory">${'<span></span>'.repeat(8)}</div>`;
}

// Respaldo: panel teñido con el color de la plantilla + icono grande + etiqueta.
// Reusa la paleta suave de las pastillas (.tag--*) en vez de re-declararla aquí.
function genericPv(a) {
  const T = getTemplate(a?.template);
  const color = T?.meta?.color || 'secondary';
  const icon = T?.meta?.icon || 'bi-puzzle';
  const label = T?.meta?.label || a?.template || '';
  return `<div class="pv pv-generic tag--${esc(color)}">
    <i class="bi ${icon}"></i><span>${esc(label)}</span>
  </div>`;
}
