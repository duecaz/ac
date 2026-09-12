// EL SKIN POR DEFECTO — y, por contrato, LA LISTA CANÓNICA DE TOKENS: todo
// skin debe declarar al menos lo que declara este (core/skinContract.js). Añadir
// un token aquí OBLIGA a los otros seis, y eso es a propósito: un token que un
// tema olvida cae al fallback de `styles/theme.css :root` y se ve genérico.
/** @type {import('../../core/skins.js').Skin} */
export const skinDefault = {
  name: 'default',
  label: 'Por defecto',
  description: 'Estilo limpio neutro.',
  cssVars: {
    '--ww-bg': '#ffffff',
    '--ww-bg-soft': '#f9fafb',
    '--ww-fg': '#1f2937',
    '--ww-card-bg': '#ffffff',
    '--ww-card-fg': '#1f2937',   // text INSIDE cards — contrasts with card-bg
    '--ww-card-border': '#dee2e6',
    '--ww-accent': '#6366f1',
    '--ww-accent-ink': '#ffffff',  // TINTA sobre el acento (4.5:1 medido) — el par nació del Lápiz ilegible en arcade
    '--ww-shape-1': '#e21b3c',
    '--ww-shape-2': '#1368ce',
    '--ww-shape-3': '#d89e00',
    '--ww-shape-4': '#26890c',
    '--ww-shape-1-fg': '#ffffff',   // TINTA por forma: la mejor contra ESTE color (medido, no estimado)
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#ffffff',
    
    // LA HOJA. El papel es una superficie propia: el marco lo tematiza el skin,
    // pero encima se ESCRIBE, así que necesita su propio par fondo/tinta. Sin
    // estos dos, el papel caía siempre al crema y el tema solo llegaba al borde —
    // y lo que se pintara encima con `--ww-fg` (tinta del MARCO) quedaba ilegible.
    '--ww-paper': '#fffdf6',
    '--ww-paper-ink': '#1f2937',
    '--ww-success': '#10b981',
    '--ww-danger': '#ef4444',
    '--ww-warning': '#f59e0b'
  },
  bgImage: null,
  fontFamily: null
};
