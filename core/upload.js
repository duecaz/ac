// Media inline: convierte el archivo a data-URL y lo devuelve. Las imágenes
// viven DENTRO del JSON de la actividad (el stack es PocketBase, sin storage
// externo). Límite 200 KB para mantener el registro ligero — igual que el fondo
// personalizado y las imágenes de Pregunta/Ruleta Live.
// Los NÚMEROS viven en core/quotas.js (§25 · capacidad, un número un sitio);
// aquí solo se aplican. Antes el 200 KB estaba escrito aquí y el 5 MB del campo
// de PocketBase en otros dos ficheros: tres topes que nadie podía comparar.
import { QUOTAS, activityBytes, checkActivitySize } from './quotas.js';

const IMG_MAX_BYTES = QUOTAS.imageBytes;

const ALLOWED = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

// Presupuesto POR ACTIVIDAD (P1-6 → §25). El límite por imagen es uno, pero una
// actividad con muchas imágenes inline puede llegar a varios MB → (a) revienta la
// cuota del blob de localStorage (todas las actividades en una clave) y (b) supera
// el maxSize del campo `data` de PocketBase y queda imposible de sincronizar.
// El aviso salta ANTES del tope (QUOTAS.activityWarnRatio), no al rebotar.
export const ACTIVITY_SIZE_WARN_BYTES = QUOTAS.activityBytes * QUOTAS.activityWarnRatio;

export function activityTooLarge(a) { return checkActivitySize(a).level !== 'ok'; }

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
