// Background system. Independent axis from skins.
//   - skin = colors + sounds (per-activity, applied in player)
//   - background = visual texture (paper, blackboard, …)
// The combo lets a "notebook" paper coexist with any skin's color palette.
// Backgrounds are CSS-only (class on body); no JS-rendered canvas.
//
// Heavier backgrounds (interactive whiteboard, IR pen) will live in
// optional modules under core/canvas/ that load lazily — this stays small.

export const BACKGROUNDS = {
  none:       { label: 'Ninguno',     description: 'Sin fondo.' },
  notebook:   { label: 'Cuaderno',    description: 'Hoja con renglones.' },
  blackboard: { label: 'Pizarra',     description: 'Pizarra de tiza.' },
  paper:      { label: 'Papel',       description: 'Papel beige liso.' },
  grid:       { label: 'Cuadrícula',  description: 'Hoja cuadriculada.' },
  corkboard:  { label: 'Corcho',      description: 'Tablero de corcho.' },
  stars:      { label: 'Estrellado',  description: 'Cielo de noche.' }
};

const ALL_CLS = Object.keys(BACKGROUNDS).map(k => `bg-${k}`);

// target=null applies globally (body); target=Element scopes the bg to that
// element only (e.g. the player frame). The two paths are independent — a
// scoped apply NEVER touches <body> and vice versa — so a textured embed can't
// leak its background onto the page chrome.
export function applyBackground(name, target = null) {
  const valid = name in BACKGROUNDS ? name : 'none';
  const cls = `bg-${valid}`;
  if (target) {
    target.classList.remove(...ALL_CLS);
    target.classList.add(cls);
  } else {
    document.body.classList.remove(...ALL_CLS);
    document.body.classList.add(cls);
  }
}

export function listBackgrounds() {
  return Object.entries(BACKGROUNDS).map(([name, b]) => ({ name, ...b }));
}

// Tiny preview tile (used in the editor picker).
export function backgroundPreviewHtml(name) {
  const b = BACKGROUNDS[name] || BACKGROUNDS.none;
  return `<div class="ww-bg-preview bg-${name}" style="width:100%;height:60px;border-radius:6px;border:1px solid #dee2e6"></div>
          <small class="d-block text-center mt-1">${b.label}</small>`;
}
