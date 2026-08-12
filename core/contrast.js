// CONTRASTE — la aritmética WCAG, pura y sin navegador (§3, plan de temas y
// fondos 2026-08-12).
//
// Por qué existe: los colores de los temas (`core/skins.js`) y de los fondos
// (`core/backgrounds.js`) son hex CONOCIDOS en tiempo de test. Hasta hoy el
// contraste solo se comprobaba al final del túnel — la matriz headless mide
// «se lee a 3 m» sobre estilos computados —, así que un par mal elegido se
// descubría con la clase delante. Ya pasó dos veces: el ámbar del Kahoot-grid
// con letra blanca (2.4:1, el peor de la app y en el sitio más visible) y las
// etiquetas de Etiqueta el diagrama sobre la forma amarilla.
//
// Con esto el ratio se calcula en Node al DECLARAR el color, no al pintarlo:
// un tema o un fondo que no llegue al mínimo no entra en el repo.
//
// Fórmula: WCAG 2.1 — luminancia relativa + (L1+0.05)/(L2+0.05).

/** Mínimo exigido a texto normal (WCAG AA). */
export const AA_TEXTO = 4.5;
/** Mínimo exigido a texto GRANDE (≥18.66px negrita o ≥24px): botones, enunciados. */
export const AA_GRANDE = 3;

/**
 * Hex (#rgb o #rrggbb) → [r, g, b] en 0-255.
 * @returns {number[]|null} null si no es un hex sólido (gradiente, rgba, token…).
 */
export function rgbDe(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, c => c + c) : m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

/** Luminancia relativa WCAG de un color hex. */
export function luminancia(hex) {
  const rgb = rgbDe(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste entre dos colores hex (1 = idénticos, 21 = negro/blanco).
 * @returns {number|null} null si alguno no es un hex sólido comparable.
 */
export function ratio(hexA, hexB) {
  const a = luminancia(hexA), b = luminancia(hexB);
  if (a == null || b == null) return null;
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Redondeo a 2 decimales para mensajes de error legibles («2.43:1»). */
export function ratioLegible(hexA, hexB) {
  const r = ratio(hexA, hexB);
  return r == null ? '?' : `${Math.round(r * 100) / 100}:1`;
}

/**
 * De dos tintas candidatas, la que más contraste da contra `fondo`.
 * Útil para DECIDIR la tinta de un lienzo nuevo, no solo para verificarla.
 */
export function mejorTinta(fondo, claro = '#ffffff', oscuro = '#1f2937') {
  const rc = ratio(fondo, claro) ?? 0;
  const ro = ratio(fondo, oscuro) ?? 0;
  return rc >= ro ? claro : oscuro;
}
