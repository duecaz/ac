// Skin system. Each skin is a manifest of CSS variables, optional stylesheet,
// and metadata. Skins register themselves via registerSkin() — no object needs
// to be edited here to add a new skin. Built-in skins are registered at the
// bottom of this file; external skins call registerSkin() from their own module.
//
// ── TOKEN CONTRACT ────────────────────────────────────────────────────────────
// These are the CSS vars activity stylesheets read. Skins override them.
// All activity CSS defines fallback defaults so a skin only needs to set
// what it actually changes.
//
// GLOBAL
//   --ww-bg            page / player background
//   --ww-bg-soft       secondary / soft background
//   --ww-fg            primary text
//   --ww-card-bg       card / panel fill
//   --ww-card-border   card / panel border
//   --ww-accent        brand accent (buttons, links)
//   --ww-shape-1..4    answer option colours (maps to quiz/froggy/live)
//   --ww-success       correct answer green
//   --ww-danger        wrong answer red
//   --ww-warning       warning / time-running-out amber
//
// KEYPAD  (math activity)
//   --key-bg           key fill                  default: #fff
//   --key-fg           key text                  default: #212529
//   --key-border       key border shorthand       default: 2px solid #ced4da
//   --key-radius       key corner radius          default: .5rem
//   --key-size         key font-size              default: clamp(1.1rem,3.6vmin,1.9rem)
//   --key-weight       key font-weight            default: 700
//   --key-pad          key padding shorthand      default: clamp(.4rem,1.6vmin,1rem) 0
//   --key-shadow       key box-shadow             default: none
//   --key-cols         keypad grid columns        default: 3
//   --key-gap          keypad grid gap            default: clamp(.3rem,1.2vmin,.7rem)
//   --key-ok-bg        submit key fill            default: --ww-success
//   --key-ok-fg        submit key text            default: #fff
//   --key-fn-bg        backspace key fill         default: #f1f3f5
//   --display-bg       answer display fill        default: #fff
//   --display-fg       answer display text        default: #212529
//   --display-border   answer display border      default: 3px solid #dee2e6
//   --display-radius   answer display radius      default: .6rem
//   --display-size     answer display font-size   default: clamp(1.6rem,6vmin,3rem)
//   --display-pad      answer display padding     default: .15rem 1rem
//   --math-q-size      question font-size         default: clamp(1.6rem,6vmin,3.4rem)
//   --math-q-weight    question font-weight       default: 800
//   --math-q-color     question text color        default: inherit
//   --math-gap         round flex gap             default: clamp(.5rem,1.6vh,1.1rem)
//
// VS LAYOUT (set by vsView on each panel; skins read in skin.css overrides)
//   --panel-bg         device panel fill
//   --panel-glow       device panel box-shadow glow
//   --panel-radius     device panel corner radius
//   --bar-bg           scorebar background
//   --bar-team-l       left team accent colour
//   --bar-team-r       right team accent colour
//   --badge-bg         VS badge fill
// ─────────────────────────────────────────────────────────────────────────────

const _registry = new Map();

/** Register a skin. Can be called from any module — no core file needs editing.
 *  def must have: name (string), label (string), cssVars (object).
 *  Optional: description, bgImage, fontFamily, vsLayout, stylesheet, cssVars.
 */
export function registerSkin(def) {
  if (!def?.name) throw new Error('registerSkin: missing name');
  _registry.set(def.name, def);
}

/** Return a skin by name, falling back to 'default'. */
export function getSkin(name) {
  return _registry.get(name) || _registry.get('default');
}

export function listSkins() { return [..._registry.values()]; }

// Apply skin globally (page-wide) when target=null, or scoped to a single
// element (e.g. the player frame) when target is an Element.
export function applySkin(name, target = null) {
  const skin = getSkin(name);
  const validName = _registry.has(name) ? name : 'default';
  const cls = `skin-${validName}`;
  const allCls = [..._registry.keys()].map(k => `skin-${k}`);
  const el = target || document.documentElement;
  for (const [k, v] of Object.entries(skin.cssVars || {})) el.style.setProperty(k, v);
  if (target) {
    target.classList.remove(...allCls);
    target.classList.add(cls);
    target.style.fontFamily = skin.fontFamily || '';
  } else {
    document.body.classList.remove(...allCls);
    document.body.classList.add(cls);
    document.body.style.background = '';
    document.body.style.fontFamily = skin.fontFamily || '';
  }
  // Load optional skin-specific stylesheet declared in the manifest.
  // Each skin is responsible for its own CSS — core never needs updating.
  if (skin.stylesheet) {
    const id = `skin-css-${validName}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet'; link.href = skin.stylesheet;
      document.head.appendChild(link);
    }
  }
}

// Render a tiny preview tile for a skin (used by the editor).
export function skinPreviewHtml(name) {
  const s = getSkin(name);
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

// ── Built-in skins ────────────────────────────────────────────────────────────
// To add a new skin without touching this file: create themes/<name>/index.js
// and call registerSkin() there, then import it from themes/index.js.

registerSkin({
  name: 'default',
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
  fontFamily: null
});

registerSkin({
  name: 'classroom',
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
});

registerSkin({
  name: 'space',
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
});

registerSkin({
  name: 'kahoot',
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
});

registerSkin({
  name: 'retro',
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
});

registerSkin({
  name: 'jungle',
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
});

registerSkin({
  name: 'colegios',
  label: 'Colegios',
  description: 'Concurso escolar: scoreboard oscuro y deportivo.',
  vsLayout: 'school',
  stylesheet: 'themes/colegios/skin.css',
  cssVars: {
    '--ww-bg': '#09111e',
    '--ww-bg-soft': '#0d1b2a',
    '--ww-fg': '#e2e8f0',
    '--ww-card-bg': '#162236',
    '--ww-card-border': '#1976d2',
    '--ww-accent': '#f9a800',
    '--ww-shape-1': '#b71c1c',
    '--ww-shape-2': '#1565c0',
    '--ww-shape-3': '#2e7d32',
    '--ww-shape-4': '#e65100',
    '--ww-success': '#16a34a',
    '--ww-danger': '#dc2626',
    '--ww-warning': '#f9a800',
    '--key-radius': '.8rem',
    '--key-bg': 'rgba(255,255,255,.08)',
    '--key-fg': '#e2e8f0',
    '--key-border': '1px solid rgba(255,255,255,.15)',
    '--key-shadow': '0 2px 6px rgba(0,0,0,.4)',
    '--key-fn-bg': 'rgba(255,255,255,.05)',
    '--display-bg': 'rgba(0,0,0,.4)',
    '--display-fg': '#fff',
    '--display-border': '2px solid rgba(255,255,255,.2)',
    '--display-radius': '.8rem',
    '--math-q-color': '#e2e8f0'
  },
  bgImage: 'radial-gradient(ellipse at center, #0d1b2a 0%, #09111e 100%)',
  fontFamily: null
});
