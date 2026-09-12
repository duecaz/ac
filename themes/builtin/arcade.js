// ARCADE — recreativa retro.
/** @type {import('../../core/skins.js').Skin} */
export const skinArcade = {
  // ARCADE — recreativa retro: marquesina de neón arriba, "INSERT COIN" abajo,
  // rejilla de neón al fondo, líneas de escaneo, fuente de píxeles y paneles que
  // parecen máquinas (cian vs rojo). Todo el CSS en themes/arcade/skin.css,
  // scoped bajo .skin-arcade y .vs-skin-arcade. Solo tokens ESTÁNDAR + de teclado.
  name: 'arcade',
  label: 'Arcade',
  description: 'Recreativa retro: marquesina de neón, INSERT COIN y píxeles.',
  vsLayout: 'arcade',
  stylesheet: 'themes/arcade/skin.css',
  cssVars: {
    '--ww-bg': '#0a0820',
    '--ww-bg-soft': '#120c33',
    '--ww-fg': '#eafcff',
    '--ww-card-bg': '#0c0a26',
    '--ww-card-fg': '#eafcff',
    '--ww-card-border': '#22d3ee',
    '--ww-accent': '#ffd400',
    '--ww-accent-ink': '#0b0a1c',
    '--ww-shape-1': '#ff2e88',
    '--ww-shape-2': '#22d3ee',
    '--ww-shape-3': '#a3e635',
    '--ww-shape-4': '#ffd400',
    '--ww-shape-1-fg': '#1f2937',
    '--ww-shape-2-fg': '#1f2937',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#0b0a1c',
    '--ww-paper-ink': '#eafcff',
    '--ww-success': '#39ff7a',
    '--ww-danger': '#ff3b6b',
    '--ww-warning': '#ffd400',
    '--key-radius': '.4rem',
    '--key-bg': 'rgba(34,211,238,.10)',
    '--key-fg': '#eafcff',
    '--key-border': '2px solid rgba(34,211,238,.5)',
    '--key-shadow': '0 0 10px rgba(34,211,238,.25), inset 0 0 6px rgba(34,211,238,.15)',
    '--key-fn-bg': 'rgba(255,255,255,.04)',
    '--display-bg': 'rgba(0,0,0,.55)',
    '--display-fg': '#39ff7a',
    '--display-border': '2px solid rgba(57,255,122,.6)',
    '--display-radius': '.35rem',
    '--math-q-color': '#ffd400'
  },
  bgImage: 'linear-gradient(180deg, #0a0820 0%, #1a0a3a 100%)',
  fontFamily: '"Press Start 2P", "Courier New", ui-monospace, monospace'
};
