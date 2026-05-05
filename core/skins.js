// Skin system. Each skin is a manifest of CSS variables, sound URLs, and
// metadata. Applied via document.documentElement.style + body class.
// Skins target THE PLAYER (per-activity via activity.presentation.skin).
// The editor uses a separate "Presentation" tab to pick + preview.

export const SKINS = {
  default: {
    label: 'Por defecto',
    description: 'Estilo limpio neutro.',
    cssVars: {
      '--ww-bg': '#ffffff',
      '--ww-bg-soft': '#f9fafb',
      '--ww-fg': '#1f2937',
      '--ww-card-bg': '#ffffff',
      '--ww-card-border': '#dee2e6',
      '--ww-accent': '#6366f1',
      '--ww-shape-1': '#e21b3c',
      '--ww-shape-2': '#1368ce',
      '--ww-shape-3': '#d89e00',
      '--ww-shape-4': '#26890c',
      '--ww-success': '#10b981',
      '--ww-danger': '#ef4444',
      '--ww-warning': '#f59e0b'
    },
    bgImage: null,
    fontFamily: null,
    sounds: {
      lobby: null, tick: null, reveal: null, correct: null, wrong: null, podium: null
    }
  },
  classroom: {
    label: 'Aula',
    description: 'Pizarra y madera.',
    cssVars: {
      '--ww-bg': '#fdf6e3',
      '--ww-bg-soft': '#f5edd3',
      '--ww-fg': '#3a2f1f',
      '--ww-card-bg': '#fffdf5',
      '--ww-card-border': '#c9b88a',
      '--ww-accent': '#b45309',
      '--ww-shape-1': '#dc2626',
      '--ww-shape-2': '#2563eb',
      '--ww-shape-3': '#ca8a04',
      '--ww-shape-4': '#16a34a'
    },
    bgImage: null,
    fontFamily: '"Georgia", serif'
  },
  space: {
    label: 'Espacio',
    description: 'Cosmos y neón.',
    cssVars: {
      '--ww-bg': '#0c0a1f',
      '--ww-bg-soft': '#1e1b4b',
      '--ww-fg': '#e0e7ff',
      '--ww-card-bg': '#1e1b4b',
      '--ww-card-border': '#6366f1',
      '--ww-accent': '#a855f7',
      '--ww-shape-1': '#f43f5e',
      '--ww-shape-2': '#3b82f6',
      '--ww-shape-3': '#eab308',
      '--ww-shape-4': '#22c55e'
    },
    bgImage: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0c0a1f 70%)',
    fontFamily: null
  },
  kahoot: {
    label: 'Kahoot',
    description: 'Magenta y azul vibrantes.',
    cssVars: {
      '--ww-bg': '#46178f',
      '--ww-bg-soft': '#1368ce',
      '--ww-fg': '#ffffff',
      '--ww-card-bg': '#ffffff',
      '--ww-card-border': '#46178f',
      '--ww-accent': '#ff3355',
      '--ww-shape-1': '#e21b3c',
      '--ww-shape-2': '#1368ce',
      '--ww-shape-3': '#d89e00',
      '--ww-shape-4': '#26890c'
    },
    bgImage: 'linear-gradient(135deg, #46178f 0%, #1368ce 100%)',
    fontFamily: null
  },
  retro: {
    label: 'Retro',
    description: 'Píxeles y arcade.',
    cssVars: {
      '--ww-bg': '#0a0a23',
      '--ww-bg-soft': '#1a1a3e',
      '--ww-fg': '#39ff14',
      '--ww-card-bg': '#1a1a3e',
      '--ww-card-border': '#39ff14',
      '--ww-accent': '#ff00ff',
      '--ww-shape-1': '#ff5555',
      '--ww-shape-2': '#5555ff',
      '--ww-shape-3': '#ffff55',
      '--ww-shape-4': '#55ff55'
    },
    bgImage: null,
    fontFamily: '"Courier New", monospace'
  },
  jungle: {
    label: 'Jungla',
    description: 'Verdes y tropical.',
    cssVars: {
      '--ww-bg': '#0f3a26',
      '--ww-bg-soft': '#155e3d',
      '--ww-fg': '#ecfccb',
      '--ww-card-bg': '#1a4d36',
      '--ww-card-border': '#84cc16',
      '--ww-accent': '#facc15',
      '--ww-shape-1': '#dc2626',
      '--ww-shape-2': '#0891b2',
      '--ww-shape-3': '#facc15',
      '--ww-shape-4': '#84cc16'
    },
    bgImage: 'linear-gradient(180deg, #0f3a26 0%, #1a4d36 100%)',
    fontFamily: null
  }
};

const ALL_CLS = Object.keys(SKINS).map(k => `skin-${k}`);

export function applySkin(name) {
  const skin = SKINS[name] ? SKINS[name] : SKINS.default;
  const root = document.documentElement;
  // Apply CSS variables.
  for (const [k, v] of Object.entries(skin.cssVars || {})) root.style.setProperty(k, v);
  // Body class for skin-specific overrides in CSS.
  document.body.classList.remove(...ALL_CLS);
  document.body.classList.add(`skin-${name in SKINS ? name : 'default'}`);
  // Background.
  if (skin.bgImage) document.body.style.background = skin.bgImage;
  else document.body.style.background = '';
  if (skin.fontFamily) document.body.style.fontFamily = skin.fontFamily;
  else document.body.style.fontFamily = '';
}

export function listSkins() { return Object.entries(SKINS).map(([name, s]) => ({ name, ...s })); }

// Render a tiny preview tile for a skin (used by the editor).
export function skinPreviewHtml(name) {
  const s = SKINS[name] || SKINS.default;
  const v = s.cssVars;
  return `<div class="ww-skin-preview" style="background:${s.bgImage || v['--ww-bg']};color:${v['--ww-fg']};border:2px solid ${v['--ww-card-border']}">
    <div class="d-flex gap-1">
      <span style="background:${v['--ww-shape-1']}"></span>
      <span style="background:${v['--ww-shape-2']}"></span>
      <span style="background:${v['--ww-shape-3']}"></span>
      <span style="background:${v['--ww-shape-4']}"></span>
    </div>
    <small>${s.label}</small>
  </div>`;
}
