// JUNGLA — verdes tropicales; el amarillo pide tinta OSCURA (la clara sobre
// `#facc15` no llega ni a 2:1).
/** @type {import('../../core/skins.js').Skin} */
export const skinJungle = {
  name: 'jungle',
  label: 'Jungla',
  description: 'Verdes y tropical.',
  cssVars: {
    '--ww-bg': '#0f3a26',
    '--ww-bg-soft': '#155e3d',
    '--ww-fg': '#ecfccb',
    '--ww-card-bg': '#1a4d36',
    '--ww-card-fg': '#ecfccb',
    '--ww-card-border': '#84cc16',
    '--ww-accent': '#facc15',
    '--ww-accent-ink': '#14311f',  // amarillo: la tinta clara ahí no llega ni a 2:1
    '--ww-shape-1': '#dc2626',
    '--ww-shape-2': '#0891b2',
    '--ww-shape-3': '#facc15',
    '--ww-shape-4': '#84cc16',
    '--ww-shape-1-fg': '#ffffff',
    '--ww-shape-2-fg': '#1f2937',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#e9f7ec',
    '--ww-paper-ink': '#14311f',
    '--ww-success': '#84cc16',   // lima tropical (borde/acento de la jungla)
    '--ww-danger': '#dc2626',
    '--ww-warning': '#facc15'
  },
  bgImage: 'linear-gradient(180deg, #0f3a26 0%, #1a4d36 100%)',
  fontFamily: null
};
