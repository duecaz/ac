// TV SHOW — concurso de televisión / eSports.
/** @type {import('../../core/skins.js').Skin} */
export const skinTvShow = {
  // Concurso de TV / eSports: azul eléctrico + rojo, badge VS dorado con anillo
  // animado, paneles flotantes con glow y teclado 3D. Todo el CSS vive en
  // themes/tv-show/skin.css, scoped bajo .skin-tv-show y .vs-skin-tv-show, así
  // que al cambiar de tema revierte por completo. Solo se definen tokens
  // ESTÁNDAR (presentes en 'default') → al cambiar de skin se sobrescriben todos
  // y no queda ninguna variable colgando.
  name: 'tv-show',
  label: 'TV Show',
  description: 'Concurso de televisión: glow azul, badge VS dorado y paneles 3D.',
  vsLayout: 'tv-show',
  stylesheet: 'themes/tv-show/skin.css',
  cssVars: {
    '--ww-bg': '#070d20',
    '--ww-bg-soft': '#0e1838',
    '--ww-fg': '#eaf2ff',
    '--ww-card-bg': '#111d44',
    '--ww-card-fg': '#eaf2ff',
    '--ww-card-border': '#3b82f6',
    '--ww-accent': '#ffc400',
    '--ww-accent-ink': '#0e1a3a',
    '--ww-shape-1': '#ef2b5b',
    '--ww-shape-2': '#2b6fff',
    '--ww-shape-3': '#13c4a3',
    '--ww-shape-4': '#ff8a00',
    '--ww-shape-1-fg': '#ffffff',
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#0e1a3a',
    '--ww-paper-ink': '#e8eefc',
    '--ww-success': '#22c55e',
    '--ww-danger': '#ef4444',
    '--ww-warning': '#fbbf24'
  },
  bgImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, #1a2a66 0%, #070d20 70%)',
  fontFamily: null
};
