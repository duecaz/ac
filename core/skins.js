// Visual themes. Apply via document.body.classList: 'skin-<name>'.
// Templates inherit; CSS lives in styles/skins.css.
export const SKINS = {
  default: { label: 'Por defecto', bg: '#fff' },
  classroom: { label: 'Aula' },
  space: { label: 'Espacio' },
  kahoot: { label: 'Kahoot' }
};

const ALL = Object.keys(SKINS).map(k => `skin-${k}`);

export function applySkin(name) {
  const cls = `skin-${SKINS[name] ? name : 'default'}`;
  document.body.classList.remove(...ALL);
  document.body.classList.add(cls);
}

export function listSkins() { return Object.entries(SKINS).map(([k, v]) => ({ name: k, ...v })); }
