// Media inline: convierte el archivo a data-URL y lo devuelve. Las imágenes
// viven DENTRO del JSON de la actividad (el stack es PocketBase, sin storage
// externo). Límite 200 KB para mantener el registro ligero — igual que el fondo
// personalizado y las imágenes de Pregunta/Ruleta Live.
const IMG_MAX_BYTES = 200 * 1024; // 200 KB

const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

// Presupuesto POR ACTIVIDAD (P1-6). El límite de 200 KB es por imagen, pero una
// actividad con muchas imágenes inline puede llegar a varios MB → (a) revienta la
// cuota del blob de localStorage (todas las actividades en una clave) y (b) puede
// superar el maxSize del campo `data` de PocketBase (5 MB) y quedar imposible de
// sincronizar. Avisamos bastante por debajo para que el profe reaccione a tiempo.
export const ACTIVITY_SIZE_WARN_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

export function activitySizeBytes(a) {
  const s = typeof a === 'string' ? a : JSON.stringify(a);
  try { return new TextEncoder().encode(s).length; } catch { return s.length; }
}
export function activityTooLarge(a) { return activitySizeBytes(a) > ACTIVITY_SIZE_WARN_BYTES; }

export async function uploadMedia(file) {
  if (!file) throw new Error('no file');
  if (!ALLOWED[file.type]) throw new Error(`Tipo no permitido: ${file.type || 'desconocido'}`);
  if (file.size > IMG_MAX_BYTES) {
    throw new Error(`Imagen demasiado grande (${Math.round(file.size / 1024)} KB). Máximo 200 KB.`);
  }
  // Lee como data-URL (base64 inline). No hay subida a ningún bucket.
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    r.readAsDataURL(file);
  });
}
