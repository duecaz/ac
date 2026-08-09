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

// ── COMPRESIÓN AUTOMÁTICA (v1.51.426, decisión del usuario) ──────────────────
// Antes una foto de móvil (3-8 MB) REBOTABA con «máximo 200 KB» y el profe
// tenía que reducirla él, con la clase esperando. Ahora se comprime aquí:
// se REESCALA al lado máximo útil (una imagen inline se ve en tarjetas y
// rondas, nunca a pantalla 4K) y se recodifica a WebP bajando calidad hasta
// entrar en el tope de §25. SIN librería externa a propósito: el navegador lo
// trae nativo (canvas + toBlob) y una dependencia añadiría justo el peso que
// queremos quitar (R1: pizarras de gama baja).
// GIF (animación) y SVG (vectorial, ya ligero) no se recomprimen: se aceptan
// si caben y se explican si no.
const RECOMPRIMIBLES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const LADO_MAX = 1280;          // px del lado mayor tras reescalar
const CALIDADES = [0.85, 0.7, 0.55, 0.4];

/** ¿El lado mayor supera LADO_MAX? Best-effort: sin APIs de imagen, `false`
 *  (se comporta como siempre — aceptar si cabe en bytes). */
async function superaLadoMax(file) {
  if (typeof createImageBitmap !== 'function') return false;
  try {
    const bmp = await createImageBitmap(file);
    const lado = Math.max(bmp.width, bmp.height);
    bmp.close?.();
    return lado > LADO_MAX;
  } catch { return false; }
}

async function comprimir(file) {
  // Sin las APIs (navegador viejo, test en Node) no se comprime: se cae al
  // comportamiento de siempre (aceptar si cabe, rebotar si no).
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * escala));
    const h = Math.max(1, Math.round(bmp.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    for (const q of CALIDADES) {
      const url = canvas.toDataURL('image/webp', q);
      // data-URL ≈ bytes·4/3: comparar en su propia unidad, no contra file.size.
      if (url.length <= IMG_MAX_BYTES * 4 / 3 && url.startsWith('data:image/webp')) return url;
    }
    return null;                 // ni a calidad mínima entra (imagen enorme)
  } catch { return null; }       // best-effort: si falla, manda el camino clásico
}

export async function uploadMedia(file) {
  if (!file) throw new Error('no file');
  if (!ALLOWED[file.type]) throw new Error(`Tipo no permitido: ${file.type || 'desconocido'}`);

  // 1º intenta COMPRIMIR lo recomprimible que no cabe — o que cabe en BYTES
  // pero viene enorme de PÍXELES (un JPEG progresivo de 150 KB puede medir
  // 6000×4000): reescalar también acelera el render en gama baja (R1). La
  // condición solo miraba los bytes y el comentario prometía lo otro — la
  // revisión de v1.51.429 los puso de acuerdo: ahora se miran las DOS cosas.
  if (RECOMPRIMIBLES.has(file.type)) {
    const pasaBytes = file.size > IMG_MAX_BYTES;
    const pasaPixeles = !pasaBytes && await superaLadoMax(file);
    if (pasaBytes || pasaPixeles) {
      const url = await comprimir(file);
      if (url) return url;
      // Sin APIs de canvas (test en Node, navegador viejo): si al menos cabía
      // en bytes, se acepta como antes; si no cabía, se explica.
      if (pasaBytes) throw new Error(`Imagen demasiado grande (${Math.round(file.size / 1024)} KB) incluso comprimida. Recórtala o usa una más pequeña.`);
    }
  }
  if (file.size > IMG_MAX_BYTES) {
    // GIF/SVG que no caben: no se recomprimen (se perdería la animación / no aplica).
    throw new Error(`Imagen demasiado grande (${Math.round(file.size / 1024)} KB). Máximo ${Math.round(IMG_MAX_BYTES / 1024)} KB.`);
  }
  // Lee como data-URL (base64 inline). No hay subida a ningún bucket.
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => resolve(e.target.result);
    r.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    r.readAsDataURL(file);
  });
}
