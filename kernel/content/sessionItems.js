// The ordered list of "rounds" for a session, independent of content model.
// Each model names its list differently (quiz→items, ruleta→entries,
// match/memory→pairs, tildes/comas→passages); a session treats any of them as
// the sequence of rounds. Mirrors core/migrate.js activityItemCount.
//
// v1.51.630: mudada aquí (CONTENIDO) desde kernel/session/engine.js — leer la
// forma de `content{}` no sabe nada de sesiones, plantillas ni modos (§0), así
// que vivía mal ubicada en el motor. Era una DEUDA declarada en
// tests/helpers/layerRules.mjs (excepción de capas para
// templates/question-live/player.js→kernel/session/engine.js); al mudarla, esa
// excepción ya no hace falta.
import { ITEM_KEYS } from '../../core/migrate.js';

export function sessionItems(activity) {
  const c = activity?.content || {};
  // Las claves salen de ITEM_KEYS (core/migrate.js), que es la MISMA lista que
  // usa activityItemCount. Estaban escritas a mano en los dos sitios y ya
  // habían divergido: `pins` (Etiqueta el Diagrama) se añadió solo a una, así
  // que para esa plantilla el contador decía N y esta función devolvía [] —
  // `core/editorModes.js` y el contrato la trataban como si no tuviera
  // contenido (auditoría v1.51.405).
  for (const k of ITEM_KEYS) if (c[k] != null) return c[k];
  return [];
}
