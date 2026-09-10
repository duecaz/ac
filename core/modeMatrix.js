// Datos PUROS del panel de modos (sin DOM), para que la vista (views/modesAdmin)
// sea delgada y la lógica sea testeable (tests/modeMatrix.test.mjs). Deriva todo
// del registro único de modos (core/modes.js) y de lo que cada plantilla
// implementa — la misma fuente de verdad que el selector, el editor y la barra.
import { canAutoScoreRound } from './templateCapability.js';
import { listTemplates } from './registry.js';
import { MODE_DEFS, modesForTemplate, availableModes } from './modes.js';

/**
 * @typedef {import('../kernel/contracts/template.js').TemplateStatic} TemplateStatic
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 */

// Métodos del contrato que habilitan modos (columnas del panel).
/** @type {Array<keyof TemplateStatic>} */
export const CONTRACT_METHODS = ['renderPlayer', 'renderEditor', 'renderRound', 'getRoundPayload', 'scoreSubmission', 'renderRoundHost'];

// Por qué un modo (no) está disponible para una plantilla — EL MISMO criterio
// que core/modes.js, puesto en texto.
//
// «El mismo» de verdad, no «uno que hoy coincide»: hasta la auditoría del
// 2026-09-10 esta función reescribía a mano el cuerpo de `canAutoScoreRound`
// (`scoreSubmission && renderRound`) en vez de llamarla. El booleano de
// disponibilidad ya salía bien porque lo calcula `modesForTemplate`, así que lo
// único que podía desalinearse era ESTA EXPLICACIÓN — y una explicación que
// miente sobre por qué falta un modo es peor que no darla.
/**
 * @param {string} modeId
 * @param {import('./registry.js').PlantillaRegistrada|null|undefined} T
 * @returns {string}
 */
export function modeReason(modeId, T) {
  /** @param {keyof TemplateStatic} m */
  const has = (m) => typeof T?.[m] === 'function';
  switch (modeId) {
    case 'solo': return 'siempre (renderPlayer)';
    case 'vs': return canAutoScoreRound(T)
      ? 'scoreSubmission + renderRound ✓ (en actividad: ≥2 ítems)'
      : 'falta ' + /** @type {Array<keyof TemplateStatic>} */ (['scoreSubmission', 'renderRound']).filter(m => !has(m)).join(' + ');
    case 'teams': return canAutoScoreRound(T) ? 'renderRound ✓ (auto) o juez'
      : (T?.meta?.play?.teams === 'propio' ? 'mecánica propia declarada' : 'sin renderRound');
    case 'live': return T?.meta?.modes?.live ? 'meta.modes.live ✓' : 'meta.modes.live = false';
    case 'task': return T?.meta?.modes?.async ? 'meta.modes.async ✓' : 'meta.modes.async = false';
    default: return '';
  }
}

/** Capacidad de cada plantilla registrada: qué modos puede ofrecer (con motivo)
 *  y qué métodos del contrato implementa. */
export function templateCapabilities() {
  return listTemplates().map(T => {
    const supported = new Set(modesForTemplate(T).map(m => m.id));
    return {
      name: T.meta.name, label: T.meta.label, color: T.meta.color, icon: T.meta.icon,
      contentModel: T.meta.contentModel,
      modes: MODE_DEFS.map(m => ({ id: m.id, short: m.short, label: m.label, supported: supported.has(m.id), reason: modeReason(m.id, T) })),
      methods: Object.fromEntries(CONTRACT_METHODS.map(me => [me, typeof T[me] === 'function'])),
    };
  });
}

/** Disponibilidad real de modos por actividad concreta (con contenido). */
/** @param {Activity[]} activities */
export function activityAvailability(activities) {
  return (activities || []).map(a => {
    const avail = new Set(availableModes(a).filter(m => m.isAvailable(a)).map(m => m.id));
    return {
      id: a.id, title: a.title || '(sin título)', template: a.template,
      modes: MODE_DEFS.map(m => ({ id: m.id, short: m.short, available: avail.has(m.id) })),
    };
  });
}
