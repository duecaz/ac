// Template registry. Each template registers itself by name.
const _templates = {};
const _editors = {};

export function registerTemplate(name, mod) { _templates[name] = mod; }
export function registerEditor(name, mod) { _editors[name] = mod; }
export function getTemplate(name) { return _templates[name]; }
export function getEditor(name) { return _editors[name]; }
export function listTemplates() { return Object.keys(_templates); }
