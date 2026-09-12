// EL EDITOR DE UNA ACTIVIDAD DE PARES — uno para Emparejar y Memoria.
//
// Hermano de `core/editorJuego.js`: las dos plantillas comparten el modelo
// `pairs` y con él la MISMA regla de arranque —si el contenido no es un array
// de pares, sembrarlo en blanco antes de montar el chasis— con solo el número
// de pares de partida distinto. Cada una aporta sus paneles y su `seedCount`.
//
// Vivía dentro de `core/contentModels/pairs.js`, que es CONTENIDO: un modelo de
// contenido no puede depender del formulario que lo edita — cualquiera que
// quisiera saber si un par está completo (el player, el revisor, el kernel)
// arrastraba `core/editorShell.js` entero detrás.
import { renderEditorShell } from './editorShell.js';
import { newPair } from './contentModels/pairs.js';

/**
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../kernel/contracts/activity.js').PairsContent} PairsContent
 */

/**
 * @param {Element} root
 * @param {import('../kernel/contracts/activity.js').Activity<PairsContent>} activity
 * @param {(activity: Activity) => void} onChange
 * @param {{seedCount: number, panels: import('./editorShell.js').EditorSpec}} opts
 * @returns {void}
 */
export function renderPairsEditor(root, activity, onChange, { seedCount, panels }) {
  const a = activity;
  if (!Array.isArray(a.content?.pairs)) a.content = { pairs: Array.from({ length: seedCount }, newPair) };
  renderEditorShell(root, /** @type {Activity} */ (a), onChange, panels);
}
