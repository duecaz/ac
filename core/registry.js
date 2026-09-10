// Unified template registry. registerTemplate(TemplateClass) is enough — it
// reads meta + renderPlayer + renderEditor from the class. No more separate
// editor registration.
//
//
// QUÉ VALIDA ESTE FICHERO Y QUÉ NO (decidido en la auditoría del 2026-09-10):
// aquí va solo el MÍNIMO ESTRUCTURAL para que la app no se rompa más tarde y de
// forma confusa — falta `meta.name`, falta un render, o `modes.live` sin lo que
// una sala necesita. El contrato COMPLETO (meta.play, editor, kind/skill, forma
// del scorer, migraciones, contenido jugable…) lo comprueba
// `core/templateContract.js`, que es la autoridad y corre en CI y en `#/admin`.
// Los requisitos CONDICIONALES los responde `core/templateCapability.js`, para
// que registro y contrato no puedan decir cosas distintas.
import { faltaParaLive } from './templateCapability.js';

/**
 * @typedef {import('../kernel/contracts/template.js').TemplateStatic} TemplateStatic
 * @typedef {import('../kernel/contracts/template.js').BaseTemplateMeta} BaseTemplateMeta
 *
 * LO QUE EL REGISTRO GUARDA, y por qué no es `TemplateStatic` a secas:
 *   · la META entra ANCHA (`BaseTemplateMeta`): los `static meta` de las 16 son
 *     literales sin anotar y TypeScript los ensancha (`kind: 'juego'` → string).
 *     Quien quiera el tipo exacto lo pide en su plantilla, no aquí.
 *   · lo OBLIGATORIO son las dos bocas que valida `validateTemplate`; el resto
 *     del contrato es OPCIONAL y se pregunta con `typeof` antes de llamarlo,
 *     que es como lo consume la plataforma entera.
 * @typedef {{meta: BaseTemplateMeta,
 *   renderPlayer: TemplateStatic['renderPlayer'],
 *   renderEditor: TemplateStatic['renderEditor']}
 *   & Partial<Omit<TemplateStatic, 'meta'|'renderPlayer'|'renderEditor'>>} PlantillaRegistrada
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 */

/** @type {Record<string, PlantillaRegistrada>} */
const _templates = {};

// Validate a template against TemplateContract and fail loudly. Catches at boot
// the mistakes that used to fail silently mid-game (e.g. a live-capable template
// missing getRoundPayload, which would break a hosted room only once played).
// Entra lo que sea: la guarda existe justamente para lo MAL FORMADO (una
// plantilla a medio escribir), así que la firma no puede exigir el contrato.
/** @param {Partial<PlantillaRegistrada>} T */
function validateTemplate(T) {
  const where = T?.meta?.name ? `Template "${T.meta.name}"` : 'Template';
  if (!T?.meta?.name) throw new Error('Template must declare static meta.name');
  if (!T.meta.contentModel) throw new Error(`${where} must declare meta.contentModel`);
  if (typeof T.renderPlayer !== 'function') throw new Error(`${where} must implement renderPlayer`);
  if (typeof T.renderEditor !== 'function') throw new Error(`${where} must implement renderEditor`);
  // El requisito condicional de `modes.live` NO se reescribe aquí: lo responde
  // su dueño (`core/templateCapability.js`), el mismo que consulta el contrato
  // ejecutable. Estaban escritos por separado y decían cosas distintas — el
  // registro exigía `scoreSubmission` siempre y el contrato aceptaba una
  // `renderRoundHost` propia como alternativa, así que una plantilla podía pasar
  // CI y reventar al arrancar.
  if (T.meta.modes?.live) {
    const falta = faltaParaLive(T);
    if (falta.length) {
      throw new Error(`${where} declares modes.live but is missing ${falta.join(' + ')} — LIVE rounds need it`);
    }
  }
}

/** @param {PlantillaRegistrada} T */
export function registerTemplate(T) {
  validateTemplate(T);
  _templates[T.meta.name] = T;
}
// Se llama con `a?.template` por todas partes: el nombre puede no llegar, y la
// respuesta a «no hay plantilla» es la misma que a «no la conozco».
/**
 * @param {string|null|undefined} name
 * @returns {PlantillaRegistrada|null}
 */
export function getTemplate(name) { return (name && _templates[name]) || null; }
/** @param {string|null|undefined} name */
export function getEditor(name) {
  const T = getTemplate(name);
  return T ? {
    /**
     * @param {Element} root
     * @param {Activity} a
     * @param {(activity: Activity) => void} oc
     */
    render: (root, a, oc) => T.renderEditor(root, a, oc)
  } : null;
}
export function listTemplates() { return Object.values(_templates); }

// Templates that accept the same content as `name` (same contentModel).
// Excludes `name` itself. Returns Template classes ordered by label.
/**
 * @param {string|null|undefined} name
 * @returns {PlantillaRegistrada[]}
 */
export function compatibleTemplates(name) {
  const cm = getTemplate(name)?.meta?.contentModel;
  if (!cm) return [];
  return Object.values(_templates)
    .filter(t => t.meta.name !== name && t.meta.contentModel === cm)
    .sort((a, b) => (a.meta.label || '').localeCompare(b.meta.label || ''));
}
