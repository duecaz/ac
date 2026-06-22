// Background system. Independent axis from skins.
//   - skin = colors + sounds (per-activity, applied in player)
//   - background = visual texture (paper, blackboard, …)
// The combo lets a "notebook" paper coexist with any skin's color palette.
// Backgrounds are CSS-only (class on body); no JS-rendered canvas — EXCEPT
// 'custom', whose image travels in the activity (presentation.backgroundImage)
// and is applied as an inline CSS var so it can be any teacher-uploaded photo.
//
// Heavier backgrounds (interactive whiteboard, IR pen) will live in
// optional modules under core/canvas/ that load lazily — this stays small.

export const BACKGROUNDS = {
  none:       { label: 'Ninguno',      description: 'Sin fondo.' },
  notebook:   { label: 'Cuaderno',     description: 'Hoja con renglones.' },
  blackboard: { label: 'Pizarra',      description: 'Pizarra de tiza.' },
  greenboard: { label: 'Pizarra verde',description: 'Pizarra escolar verde.' },
  paper:      { label: 'Papel',        description: 'Papel beige liso.' },
  grid:       { label: 'Cuadrícula',   description: 'Hoja cuadriculada.' },
  corkboard:  { label: 'Corcho',       description: 'Tablero de corcho.' },
  classroom:  { label: 'Aula',         description: 'Pared de aula cálida.' },
  arena:      { label: 'Arena',        description: 'Escenario de concurso.' },
  stars:      { label: 'Estrellado',   description: 'Cielo de noche.' },
  custom:     { label: 'Mi imagen',    description: 'Sube tu propia foto.' }
};

const ALL_CLS = Object.keys(BACKGROUNDS).map(k => `bg-${k}`);

// target=null applies globally (body); target=Element scopes the bg to that
// element only (e.g. the player frame). The two paths are independent — a
// scoped apply NEVER touches <body> and vice versa — so a textured embed can't
// leak its background onto the page chrome.
//
// imageUrl is only consulted for the 'custom' background: it's a data-URL (or
// any URL) painted via the --ww-bg-image inline var so each activity can carry
// its own photo without a dedicated CSS class.
export function applyBackground(name, target = null, imageUrl = null) {
  const valid = name in BACKGROUNDS ? name : 'none';
  const el = target || document.body;
  el.classList.remove(...ALL_CLS);
  el.classList.add(`bg-${valid}`);
  if (valid === 'custom' && imageUrl) {
    el.style.setProperty('--ww-bg-image', `url("${imageUrl}")`);
  } else {
    el.style.removeProperty('--ww-bg-image');
  }
}

// Cap on uploaded background images. They travel inside the activity JSON
// (presentation.backgroundImage) as a data-URL, so keep it modest.
export const BG_IMAGE_MAX_BYTES = 800 * 1024; // 800 KB

// Read a File into a data-URL, rejecting oversized ones with a friendly message.
export function readBackgroundImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No se eligió ninguna imagen.'));
    if (file.size > BG_IMAGE_MAX_BYTES) {
      return reject(new Error(`Imagen demasiado grande (${Math.round(file.size / 1024)} KB). Máximo: 800 KB.`));
    }
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

export function listBackgrounds() {
  return Object.entries(BACKGROUNDS).map(([name, b]) => ({ name, ...b }));
}

// Tiny preview tile (used in the editor picker). For 'custom' it shows the
// uploaded image when present, otherwise an "upload" affordance.
export function backgroundPreviewHtml(name, imageUrl = '') {
  const b = BACKGROUNDS[name] || BACKGROUNDS.none;
  const style = 'width:100%;height:60px;border-radius:6px;border:1px solid #dee2e6';
  if (name === 'custom') {
    const inner = imageUrl
      ? `background:center/cover no-repeat url("${imageUrl}")`
      : 'display:flex;align-items:center;justify-content:center;background:#f1f3f5;color:#868e96';
    return `<div class="ww-bg-preview bg-custom" style="${style};${inner}">${imageUrl ? '' : '<i class="bi bi-upload"></i>'}</div>
            <small class="d-block text-center mt-1">${b.label}</small>`;
  }
  return `<div class="ww-bg-preview bg-${name}" style="${style}"></div>
          <small class="d-block text-center mt-1">${b.label}</small>`;
}
