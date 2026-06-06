// Unified template registry. registerTemplate(TemplateClass) is enough — it
// reads meta + renderPlayer + renderEditor from the class. No more separate
// editor registration.
//
// @typedef {import('../kernel/contracts/template.js').TemplateContract} TemplateContract
const _templates = {};

// Validate a template against TemplateContract and fail loudly. Catches at boot
// the mistakes that used to fail silently mid-game (e.g. a live-capable template
// missing getRoundPayload, which would break a hosted room only once played).
/** @param {any} T */
function validateTemplate(T) {
  const where = T?.meta?.name ? `Template "${T.meta.name}"` : 'Template';
  if (!T?.meta?.name) throw new Error('Template must declare static meta.name');
  if (!T.meta.contentModel) throw new Error(`${where} must declare meta.contentModel`);
  if (typeof T.renderPlayer !== 'function') throw new Error(`${where} must implement renderPlayer`);
  if (typeof T.renderEditor !== 'function') throw new Error(`${where} must implement renderEditor`);
  if (T.meta.modes?.live) {
    if (typeof T.getRoundPayload !== 'function')
      throw new Error(`${where} declares modes.live but is missing getRoundPayload — LIVE rounds need it`);
    if (typeof T.scoreSubmission !== 'function')
      throw new Error(`${where} declares modes.live but is missing scoreSubmission — LIVE scoring needs it`);
  }
}

/** @param {TemplateContract} T */
export function registerTemplate(T) {
  validateTemplate(T);
  _templates[T.meta.name] = T;
}
export function getTemplate(name) { return _templates[name]; }
export function getEditor(name) {
  const T = _templates[name];
  return T ? { render: (root, a, oc) => T.renderEditor(root, a, oc) } : null;
}
export function listTemplates() { return Object.values(_templates); }
export function listTemplateNames() { return Object.keys(_templates); }

// Templates that accept the same content as `name` (same contentModel).
// Excludes `name` itself. Returns Template classes ordered by label.
export function compatibleTemplates(name) {
  const T = _templates[name];
  const cm = T?.meta?.contentModel;
  if (!cm) return [];
  return Object.values(_templates)
    .filter(t => t.meta.name !== name && t.meta.contentModel === cm)
    .sort((a, b) => (a.meta.label || '').localeCompare(b.meta.label || ''));
}
