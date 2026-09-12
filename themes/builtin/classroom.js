// AULA — pizarra y madera: crema cálido, acento teja y serif.
/** @type {import('../../core/skins.js').Skin} */
export const skinClassroom = {
  name: 'classroom',
  label: 'Aula',
  description: 'Pizarra y madera.',
  cssVars: {
    '--ww-bg': '#fdf6e3',
    '--ww-bg-soft': '#f5edd3',
    '--ww-fg': '#3a2f1f',
    '--ww-card-bg': '#fffdf5',
    '--ww-card-fg': '#3a2f1f',
    '--ww-card-border': '#c9b88a',
    '--ww-accent': '#b45309',
    '--ww-accent-ink': '#ffffff',
    '--ww-shape-1': '#dc2626',
    '--ww-shape-2': '#2563eb',
    '--ww-shape-3': '#ca8a04',
    '--ww-shape-4': '#16a34a',
    '--ww-shape-1-fg': '#ffffff',
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#fdf8ec',
    '--ww-paper-ink': '#1f2937',
    '--ww-success': '#16a34a',   // verde tiza, encaja con la madera cálida
    '--ww-danger': '#dc2626',
    '--ww-warning': '#ca8a04'    // ámbar de la paleta (no el genérico)
  },
  bgImage: null,
  fontFamily: '"Georgia", serif'
};
