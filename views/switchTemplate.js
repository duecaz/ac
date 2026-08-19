// UI glue for the Wordwall-style "switch format" feature. Thin layer over the
// pure engine in kernel/content (switchOptions/applySwitch); keeps registry +
// storage wiring out of the engine so the engine stays Node-testable.
import { listTemplates } from '../core/registry.js';
import { switchOptions, applySwitch, duplicateSwitch } from '../kernel/content/index.js';
import { save } from '../core/storage.js';
import { newActivityId } from '../core/migrate.js';

/** Options this activity can switch to (direct + convertible), against the live registry. */
export function buildSwitchOptions(activity) {
  return switchOptions(activity, listTemplates());
}

/**
 * Convert `activity` to `targetName`, persist it (same id), and return the new
 * activity. Returns null if the switch isn't possible. Title, presentation, tags
 * and visibility are preserved; only the content (converted) and template-specific
 * knobs (rules/scoring/live → target defaults) change.
 */
export function applyAndSave(activity, targetName) {
  const next = applySwitch(activity, targetName, listTemplates());
  if (!next) return null;
  save(next);
  return next;
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
 * @returns {Object|null} la actividad nueva ya guardada, o null si no se puede.
 */
export function duplicateAsTemplate(activity, targetName) {
  const copia = duplicateSwitch(activity, targetName, listTemplates(),
    { id: newActivityId(), now: new Date().toISOString() });
  if (!copia) return null;
  save(copia);
  return copia;
}
