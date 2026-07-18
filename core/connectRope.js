// Motor de CUERDAS SVG compartido por las actividades de conexión (Emparejar y
// Etiqueta-el-diagrama): dibujar la cuerda bezier con sombra, la línea fantasma
// del arrastre, y las coordenadas puntero↔SVG. Lo que cambia entre actividades
// (el DOM, cómo se resuelve el destino al soltar, la clave de acierto) queda en
// cada player; esto es solo el dibujo, que es idéntico y traía los bugs sutiles
// (bbox de alto 0 → sombra invisible), así que vive en un solo sitio.

export const ROPES = ['#6366f1','#0891b2','#a855f7','#f59e0b','#0ea5e9','#ec4899','#14b8a6','#8b5cf6'];
export const OK_COL = '#16a34a', NO_COL = '#ef4444';
const SAG = 16;   // px que "cuelga" la cuerda: se ve más natural (una leve caída).

// Inyecta la capa de cuerdas UNA vez. Devuelve la capa <g> donde el caller escribe
// el innerHTML de las cuerdas.
// NOTA: ya NO se usa un filtro SVG (feDropShadow) para la sombra. Su región se
// define en % del BOUNDING BOX del trazo, y una cuerda VERTICAL (dos tarjetas
// frente a frente → mismos x) tiene bbox de ANCHO 0 → el filtro colapsaba a cero y
// la cuerda ENTERA (halo + color) desaparecía. La sombra ahora es un trazo
// desplazado (ver ropeHtml), que se pinta siempre, sea cual sea la orientación.
export function mountRopeLayer(svg) {
  svg.innerHTML = `<g class="ww-rope-layer"></g>`;
  return { layer: svg.querySelector('.ww-rope-layer'), filterId: null };
}

// Curva bezier entre dos puntos, con una leve caída ("sag") para un aire natural.
export function ropeCurve(p1, p2) {
  const mx = (p1.x + p2.x) / 2;
  return `M${p1.x},${p1.y} C${mx},${p1.y + SAG} ${mx},${p2.y + SAG} ${p2.x},${p2.y}`;
}

// Una cuerda con su sombra + su color y sus dos remaches redondos. La SOMBRA es el
// mismo trazo desplazado un pelín hacia abajo (NO un filtro): así se ve en CUALQUIER
// orientación, incluida la vertical (frente a frente), donde el filtro colapsaba.
export function ropeHtml(p1, p2, col) {
  const curve  = ropeCurve(p1, p2);
  const shadow = ropeCurve({ x: p1.x, y: p1.y + 2.5 }, { x: p2.x, y: p2.y + 2.5 });
  return `<path d="${shadow}" stroke="rgba(0,0,0,.22)" stroke-width="10" fill="none" stroke-linecap="round"/>`
    + `<path d="${curve}" stroke="${col}" stroke-width="6" fill="none" stroke-linecap="round"/>`
    + `<circle cx="${p1.x}" cy="${p1.y}" r="8" fill="${col}"/>`
    + `<circle cx="${p2.x}" cy="${p2.y}" r="8" fill="${col}"/>`;
}

// Línea fantasma (punteada) mientras el dedo arrastra, del ancla al puntero.
export function ghostHtml(x1, y1, cx, cy) {
  const mx = (x1 + cx) / 2;
  return `<circle cx="${x1}" cy="${y1}" r="10" fill="#6366f1" opacity=".6"/>`
    + `<path d="M${x1},${y1} C${mx},${y1} ${mx},${cy} ${cx},${cy}" stroke="#6366f1" stroke-width="4.5" fill="none" stroke-dasharray="11 6" stroke-linecap="round" opacity=".75"/>`;
}

// Centro de un elemento en coordenadas del SVG.
export function dotPos(el, svg) {
  const er = el.getBoundingClientRect(), sr = svg.getBoundingClientRect();
  return { x: (er.left + er.right) / 2 - sr.left, y: (er.top + er.bottom) / 2 - sr.top };
}
// Punto de cliente (clientX/Y) en coordenadas del SVG.
export function svgPt(svg, cx, cy) {
  const sr = svg.getBoundingClientRect();
  return { x: cx - sr.left, y: cy - sr.top };
}
