// CAMBIAR DE PLANTILLA (estilo Wordwall) llevando el contenido: capa fina sobre
// el motor puro de kernel/content (switchOptions/applySwitch/duplicateSwitch),
// que le pone el registro de plantillas y el almacén — así el motor se sigue
// probando en Node.
//
// Vivía en `views/` y NO es una vista: no pinta nada. Estando allí, la capa de
// CONTENIDO y la de core no podían llamarlo (§0: nadie importa hacia arriba), y
// sus tres consumidores eran vistas por casualidad, no por naturaleza.
import { listTemplates } from './registry.js';
import { switchOptions, applySwitch, duplicateSwitch } from '../kernel/content/index.js';
import { save, ALMACEN_LLENO } from './storage.js';
import { revisarActividad } from './activityCheck.js';
import { newActivityId } from './migrate.js';

/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/template.js').TemplateStatic} TemplateStatic */

// El REGISTRO guarda la meta ANCHA (`BaseTemplateMeta`, porque los `static meta`
// de las 16 entran sin anotar) y el motor de conversión pide el contrato exacto.
// La lectura del registro es una, y aquí se dice una sola vez de qué forma entra.
/** @returns {TemplateStatic[]} */
const plantillas = () => /** @type {TemplateStatic[]} */ (listTemplates());

/**
 * Options this activity can switch to (direct + convertible), against the live registry.
 * @param {Activity} activity
 */
export function buildSwitchOptions(activity) {
  return switchOptions(activity, plantillas());
}

/**
 * Convert `activity` to `targetName`, persist it (same id), and return the new
 * activity. Returns null if the switch isn't possible. Title, presentation, tags
 * and visibility are preserved; only the content (converted) and template-specific
 * knobs (rules/scoring/live → target defaults) change.
 * @param {Activity} activity
 * @param {string} targetName
 * @returns {{actividad: Activity|null, error: string|null}}
 */
export function applyAndSave(activity, targetName) {
  const next = applySwitch(activity, targetName, plantillas());
  if (!next) return { actividad: null, error: 'No se pudo cambiar a ese formato.' };
  // Mira `persisted` igual que el duplicado: aquí es MÁS grave, porque esta vía
  // es la destructiva — con la cuota llena, el contenido ya está convertido en
  // memoria y decirle al profe que se guardó le hace perder el original.
  const { persisted } = save(next);
  if (persisted === false) return { actividad: null, error: ALMACEN_LLENO };
  return { actividad: next, error: null };
}

/**
 * DUPLICAR como otra plantilla — la versión NO DESTRUCTIVA de lo de arriba
 * (decisión del dueño, 2026-08-18; es la opción (b) de D2 en
 * docs/decisiones-pendientes.md, que ya venía recomendada por escrito).
 *
 * `applyAndSave` convierte EN EL SITIO: mismo id, y lo que la plantilla destino
 * no usa se pierde para siempre. Eso es asumible en el editor, donde uno va a
 * propósito a cambiar el formato. No lo es desde la página de JUGAR, donde se
 * toca por curiosidad —«a ver cómo queda de globos»— y nadie espera perder el
 * original. Aquí nace una actividad NUEVA y la de partida queda intacta.
 *
 * Mismas señas que "Duplicar" (`forkOf`, borrador, sin autor: lo pone `save`
 * con la sesión de quien duplica), más el nombre de la plantilla en el título
 * para que las dos se distingan en "Mis actividades" — que es donde van a
 * aparecer juntas.
 *
 * @param {Activity} activity
 * @param {string} targetName
 * @returns {{actividad: Activity, error: null}|{actividad: null, error: string}}
 *   Unión discriminada: sin copia SIEMPRE hay motivo, así que la vista no
 *   necesita una frase de respaldo (la tenía copiada, y B5 lo cazó).
 */
export function duplicateAsTemplate(activity, targetName) {
  const copia = duplicateSwitch(activity, targetName, plantillas(),
    { id: newActivityId(), now: new Date().toISOString() });
  if (!copia) return { actividad: null, error: 'No se pudo crear la copia con esa plantilla.' };
  // R6 · fallar en silencio está prohibido. `save` devuelve `persisted:false`
  // cuando el almacén del navegador está lleno; sin mirarlo, el usuario leía
  // «Copia creada» y acto seguido «Actividad no encontrada» al navegar a ella.
  // Se devuelve como VALOR y no como excepción: un `catch` que enseña
  // `err.message` es un embudo por donde acabaría saliendo cualquier fallo
  // técnico a la cara del profe. Misma forma que `save` y que `checkActivitySize`.
  const { persisted } = save(copia);
  if (persisted === false) return { actividad: null, error: ALMACEN_LLENO };
  return { actividad: copia, error: null };
}

/**
 * QUÉ QUEDARÁ POR COMPLETAR si se convierte a `targetName` — para decirlo ANTES,
 * no después (norma del proyecto: si una puerta se cierra a medias, la UI lo
 * avisa; nunca se deja fallar para explicarlo luego).
 *
 * Hay conversiones legítimas que NO pueden salir jugables por sí solas: Sopa de
 * Letras → Crucigrama traslada las palabras, pero una palabra suelta no trae
 * pista y sin pista no hay crucigrama. Eso no es un fallo del conversor —
 * inventar la pista sería peor, porque «pista: CABALLO» revela la respuesta—,
 * es trabajo del profe. Lo que sí era un fallo es no avisarlo.
 *
 * Se convierte en memoria (no se guarda nada) y se le pregunta al revisor de
 * siempre, el mismo que gatea el juego: una sola definición de "qué le falta".
 *
 * @param {Activity} activity
 * @param {string} targetName
 * @returns {string[]} lo que faltará (vacío si queda lista para jugar).
 */
export function switchWillNeed(activity, targetName) {
  // `soloForma`: es un SONDEO, no la conversión de verdad — se pregunta qué
  // faltará, no se construye el resultado. Sin esto, pintar la página de jugar
  // de una Sopa de 60 palabras colocaba el crucigrama entero para acabar
  // diciendo «faltan las pistas», que se sabe sin colocar nada (~1 s medido).
  const next = applySwitch(activity, targetName, plantillas(), { soloForma: true });
  if (!next) return [];
  const rev = revisarActividad(next);
  return rev.jugable ? [] : (rev.problemas || []);
}
