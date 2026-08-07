// EL BUSCADOR DE ACTIVIDADES — uno solo, para "Mis actividades" y la biblioteca.
//
// POR QUÉ EXISTE. El tramo "buscar/crear" es por el que pasa TODA clase
// (`docs/norte.md` §1) y era el peor cubierto del repo (0,29 líneas de test por
// línea de código, ver `docs/arquitectura-modulos.md`). Además el filtro estaba
// escrito DOS veces —`views/home.js` y `views/explore.js`— con la misma lógica
// copiada: `includes` sobre título, subtítulo y tags. Dos copias de una regla
// que el profe usa todos los días.
//
// LA REGLA DE PRODUCTO (decidida, `docs/norte.md` §2b): **buscar es BINARIO**.
// El profe teclea el TEMA ("puntos notables"), y en dos toques la actividad
// aparece o no aparece. No hay tercera opción: si no aparece, se va a crear. De
// ahí las tres decisiones de este módulo, que no son cosmética:
//
//   1. SIN TILDES NI MAYÚSCULAS. En una pizarra táctil se teclea rápido y mal:
//      "matematicas" tiene que encontrar "Matemáticas". Un acento no puede ser
//      la diferencia entre encontrarla y ponerse a crear una que ya existe.
//   2. POR PALABRAS, NO POR FRASE (Y lógica). "notables puntos" encuentra
//      "Puntos notables del triángulo". El orden en que uno recuerda el tema no
//      debería decidir el resultado.
//   3. TAMBIÉN DENTRO DEL CONTENIDO. El tema muchas veces no está en el título:
//      está en las preguntas. Se recorre el contenido y se recogen sus textos,
//      genéricamente (sin un `switch` por plantilla, que se quedaría viejo a la
//      siguiente plantilla nueva).
//
// Es un módulo PURO: sin DOM, sin red. Lo vigila `tests/search.test.mjs`.
import { ITEM_KEYS } from './migrate.js';
import { getTemplate } from './registry.js';

/** Texto comparable: minúsculas y SIN diacríticos (NFD + fuera las marcas). */
export function fold(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Tope del texto que se indexa por actividad. Una actividad son 2 MB como mucho
// (ley §25) y casi todo eso puede ser una imagen en data-URL: recorrerla entera
// en cada tecleo congelaría la pizarra. 4 KB de texto sobran para un tema.
const MAX_TEXT = 4000;
// Las data-URL de imagen son ruido: caben miles de caracteres base64 que además
// harían coincidir cualquier búsqueda por casualidad.
const isNoise = (s) => s.length > 300 || s.startsWith('data:');

/** Recoge los textos de un valor cualquiera del contenido (objeto, array o
 *  string), sin saber de qué plantilla es. Genérico a propósito: una plantilla
 *  nueva queda buscable sin tocar este archivo. */
function collect(v, out, depth = 0) {
  if (out.len >= MAX_TEXT || depth > 6) return;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s && !isNoise(s)) { out.parts.push(s); out.len += s.length; }
    return;
  }
  if (Array.isArray(v)) { for (const x of v) collect(x, out, depth + 1); return; }
  if (v && typeof v === 'object') { for (const x of Object.values(v)) collect(x, out, depth + 1); }
}

/** Todo el texto por el que se puede encontrar una actividad, ya plegado.
 *  Memoizado por `id:updatedAt` — el mismo criterio que `core/homePreview.js`:
 *  el profe teclea letra a letra y cada tecla re-filtra la lista entera. */
const cache = new Map();
export function haystackOf(a) {
  const key = a?.id ? `${a.id}:${a.updatedAt || ''}` : null;
  if (key && cache.has(key)) return cache.get(key);
  const out = { parts: [], len: 0 };
  // LA ETIQUETA DE LA PLANTILLA también se busca. La tarjeta la ENSEÑA en
  // grande ("Ordena las Pelotas", "Quiz")… y el buscador no la miraba: teclear
  // "ordena" no encontraba una actividad de Ordena las Pelotas titulada "Nueva
  // actividad" (prueba real, v1.51.386). Lo que la tarjeta muestra, el buscador
  // lo encuentra — si no, el profe cree que no existe y se pone a crearla.
  const T = getTemplate(a?.template);
  for (const s of [a?.title, a?.subtitle, T?.meta?.label, ...(a?.tags || [])]) collect(s, out);
  // El contenido de un JUEGO no se indexa (§4c): lo genera la plantilla, no el
  // profe — son datos de tablero ('orange', niveles…), y esa basura producía
  // FALSOS POSITIVOS ("or" encontraba Pelotas por el color de una bola). Un
  // juego se encuentra por su nombre y su habilidad, no por sus tripas.
  if (T?.meta?.kind !== 'juego') {
    const c = a?.content || {};
    for (const k of ITEM_KEYS) if (c[k]) collect(c[k], out);
  }
  if (T?.meta?.kind === 'juego') collect(T?.meta?.skill, out);
  const text = fold(out.parts.join(' '));
  if (key) {
    if (cache.size > 300) cache.clear();   // tope duro: nunca crece sin límite
    cache.set(key, text);
  }
  return text;
}

/** ¿Casa esta actividad con lo tecleado? Todas las palabras, en cualquier orden
 *  y en cualquier parte del texto. Sin término → sí (el filtro vacío no filtra). */
export function matches(activity, q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = haystackOf(activity);
  return words.every(w => hay.includes(w));
}

/**
 * Filtra una lista conservando su orden.
 * @param {Array} rows        actividades, o filas que las contienen
 * @param {{q?:string, template?:string}} filter
 * @param {(x:any)=>object} pick  cómo sacar la actividad de cada elemento
 *                                (la biblioteca guarda el blob en `row.data`)
 * @returns {Array} los elementos ORIGINALES que casan
 */
export function searchActivities(rows, filter = {}, pick = (x) => x) {
  const { q = '', template = '' } = filter;
  return (rows || []).filter(x => {
    const a = pick(x) || {};
    if (template && a.template !== template) return false;
    return matches(a, q);
  });
}
