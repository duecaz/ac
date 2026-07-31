// SNAPSHOT DE SALA PARA EL ALUMNO (ley de confianza §22-2).
//
// El bug: `live_sessions.activity` guardaba la actividad ENTERA —con la clave de
// respuesta— y la regla de esa colección es de lectura ABIERTA (tiene que serlo:
// el alumno anónimo entra por PIN). Así que R5 (payload de ronda sin solución) no
// servía de nada en vivo: el móvil NO necesitaba esperar el payload del host, se
// leía la sala y tenía todas las respuestas. Peor: el propio alumno construía su
// payload en local desde ese snapshot (`roundPayloadOf(tpl, activity, idx)`).
//
// El arreglo: la sala guarda un snapshot SIN contenido. Lo que el alumno necesita
// para jugar son los PAYLOADS de ronda (que R5 ya sanea, plantilla por plantilla)
// y unos pocos metadatos (título, tema, config de live). El contenido completo
// vive en una colección host-only (`live_keys`) que solo lee el profe con sesión.
//
// EXCEPCIÓN DECLARADA — "carrera libre": en ese modo el alumno resuelve a su
// ritmo y su propio dispositivo JUZGA cada intento (colorea al instante y
// re-encola los fallos). Sin clave en el móvil no hay veredicto instantáneo, y
// pedirle uno al host por cada intento convierte la carrera en una espera. Así
// que una sala en carrera SÍ lleva el contenido completo, y queda dicho aquí en
// vez de escondido. Cerrarlo de verdad pide un validador en el SERVIDOR (hook de
// PocketBase en la Pi), no un parche de cliente: ver docs/leyes.md §22.
//
// Módulo PURO (sin fetch): entra actividad, sale snapshot.
import { getTemplate } from './registry.js';
import { sessionItems, roundPayloadOf } from '../kernel/session/engine.js';
import { VERSION } from './constants.js';

/** Campos de la actividad que el alumno SÍ necesita (whitelist: un campo nuevo
 *  del modelo no se cuela solo). `content` NO está, a propósito. */
const KEEP = ['id', 'title', 'template', 'presentation', 'live', 'rules', 'scoring', 'schemaVersion'];

/** ¿Este modo de juego exige que el móvil pueda juzgar en local? Hoy solo la
 *  carrera libre (ver la excepción declarada arriba). */
export function needsClientKey(phase) {
  return phase === 'race';
}

/**
 * Snapshot que se guarda en la sala (lo lee cualquiera con el PIN).
 * @param {object} activity actividad completa (la del profe)
 * @returns {object} snapshot sin clave de respuesta
 */
export function studentSnapshot(activity) {
  if (!activity || typeof activity !== 'object') return activity;
  const T = getTemplate(activity.template);
  const items = sessionItems(activity);
  const out = {};
  for (const k of KEEP) if (activity[k] !== undefined) out[k] = activity[k];
  // Payloads de ronda YA saneados por la plantilla (R5). El alumno pinta con
  // estos y nunca con `content`.
  out.payloads = items.map((item, i) => roundPayloadOf(T, activity, i, null) ?? null);
  // `content.items` queda como una lista de huecos VACÍOS: existe solo para que
  // `sessionItems(activity).length` siga dando el número de ítems (la vista del
  // alumno cuenta preguntas y pinta cajas por índice). Ni texto ni solución: lo
  // que el alumno puede ver de un ítem sale del PAYLOAD, no de aquí.
  //
  // Por qué no un stub "con los campos inofensivos": en una pregunta de opción
  // múltiple la respuesta correcta ES uno de los textos del ítem, así que
  // cualquier heurística de "copiar lo que no parezca clave" acaba copiándola.
  // Vacío y que el payload manda: la única regla que no se puede colar.
  out.content = { items: items.map(() => ({})) };
  out.itemCount = items.length;
  // Versión de la app del PROFE al crear la sala. El alumno la compara con la
  // suya: en un aula real conviven móviles con módulos cacheados de versiones
  // distintas (el F5 del móvil NO refresca los ES modules), y una mezcla
  // vieja-app/nuevo-snapshot se muere en silencio al pasar de lobby a pregunta.
  // Con esto, el alumno desfasado se AUTO-RECARGA una vez (ver studentLive).
  out.appVersion = VERSION;
  return out;
}

/** Lo que el alumno puede LEER de un ítem: su payload de ronda. Las vistas que
 *  antes tiraban de `sessionItems(activity)[i]` (pedir la palabra) pasan por aquí
 *  y así funcionan igual con snapshot saneado o con actividad completa. */
export function visibleItem(activity, itemIndex) {
  const pre = activity?.payloads;
  if (Array.isArray(pre)) return pre[itemIndex] || null;
  const T = getTemplate(activity?.template);
  return roundPayloadOf(T, activity, itemIndex, sessionItems(activity)[itemIndex] ?? null);
}

/** ¿Este snapshot es el saneado (sin clave)? Lo usan las vistas/tests para no
 *  suponer. */
export function isStudentSnapshot(a) {
  return !!(a && Array.isArray(a.payloads));
}
