// Persistence for custom VS animations added from the admin panel.
// Each entry: { id, label, description, src, jsonStr? }
// jsonStr is set when the user uploaded a file instead of pasting a URL;
// on load we create a blob: URL from it so lottie-web can fetch it.
const KEY = 'ww.vs.anims';

export function loadCustomAnims() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function persist(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {
    throw new Error('localStorage lleno — elimina alguna animación antes de añadir otra.');
  }
}

export function addCustomAnim({ id, label, description, src, jsonStr }) {
  if (!id || !label) throw new Error('ID y nombre son obligatorios.');
  const list = loadCustomAnims();
  if (list.some(a => a.id === id)) throw new Error(`Ya existe una animación con ID "${id}".`);
  list.push({ id, label, description: description || '', src: src || '', jsonStr: jsonStr || '' });
  persist(list);
}

export function removeCustomAnim(id) {
  persist(loadCustomAnims().filter(a => a.id !== id));
}

// Creates a blob: URL from jsonStr so lottie-web can load it without CORS.
export function blobSrc(entry) {
  if (entry.jsonStr) {
    return URL.createObjectURL(new Blob([entry.jsonStr], { type: 'application/json' }));
  }
  return entry.src;
}
