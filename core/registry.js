// Unified template registry. registerTemplate(TemplateClass) is enough — it
// reads meta + renderPlayer + renderEditor from the class. No more separate
// editor registration.
const _templates = {};
export function registerTemplate(T) {
  if (!T?.meta?.name) throw new Error('Template must declare static meta.name');
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
