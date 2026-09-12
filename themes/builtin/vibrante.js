// VIBRANTE — magenta y azul de concurso: fondo morado, tarjetas BLANCAS (por
// eso la tinta de tarjeta es oscura aunque la de la página sea clara).
/** @type {import('../../core/skins.js').Skin} */
export const skinVibrante = {
  // Card bg is WHITE → card text must be DARK, even though page fg is white.
  name: 'vibrante',
  label: 'Vibrante',
  description: 'Magenta y azul vibrantes.',
  cssVars: {
    '--ww-bg': '#46178f',
    '--ww-bg-soft': '#1368ce',
    '--ww-fg': '#ffffff',
    '--ww-card-bg': '#ffffff',
    '--ww-card-fg': '#1f2937',   // dark text on white cards (fg≠card-fg here)
    '--ww-card-border': '#46178f',
    '--ww-accent': '#ff3355',
    '--ww-accent-ink': '#ffffff',
    '--ww-shape-1': '#e21b3c',
    '--ww-shape-2': '#1368ce',
    '--ww-shape-3': '#d89e00',
    '--ww-shape-4': '#26890c',
    '--ww-shape-1-fg': '#ffffff',   // TINTA por forma: la mejor contra ESTE color (medido, no estimado)
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#ffffff',
        '--ww-paper': '#ffffff',
    '--ww-paper-ink': '#111827',
    '--ww-success': '#26890c',   // verde/rojo del concurso (los mismos de sus formas)
    '--ww-danger': '#e21b3c',
    '--ww-warning': '#d89e00'
  },
  bgImage: 'linear-gradient(135deg, #46178f 0%, #1368ce 100%)',
  fontFamily: null
};
