// Switch-template engine — the Wordwall "change format in one click" backbone.
// Given an activity, it lists which other templates can render the same content
// (directly, same model) or could after a conversion, and applies the switch.
//
// Decoupled from core/registry by taking the template list as an argument, so it
// is pure and unit-testable in Node. A thin wrapper in the app passes
// registry.listTemplates().

import { getModel } from './models.js';
import { canConvert, convert } from './convert.js';

/** Find a template's declared contentModel from a list. */
function modelOf(templateName, templates) {
  const t = templates.find(t => t.meta?.name === templateName);
  return t?.meta?.contentModel || null;
}

/**
 * @typedef {Object} SwitchOption
 * @property {Object} template  The target template class.
 * @property {'direct'|'convert'} kind
 * @property {string} from      Source content model.
 * @property {string} to        Target content model.
 * @property {boolean} valid    Whether the (converted) content validates for the target.
 */

/**
 * List the templates an activity can switch to.
 * @param {Object} activity   { template, content }
 * @param {Object[]} templates Registered template classes.
 * @returns {SwitchOption[]} ordered: direct first, then convertible; by label.
 */
export function switchOptions(activity, templates) {
  const fromModel = modelOf(activity.template, templates);
  if (!fromModel) return [];
  const out = [];
  for (const t of templates) {
    if (!t.meta?.name || t.meta.name === activity.template) continue;
    const toModel = t.meta.contentModel;
    if (!toModel || !canConvert(fromModel, toModel)) continue;
    const converted = convert(fromModel, toModel, activity.content);
    const model = getModel(toModel);
    const valid = converted != null && (!model || model.validate(converted).ok);
    out.push({ template: t, kind: toModel === fromModel ? 'direct' : 'convert', from: fromModel, to: toModel, valid });
  }
  return out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'direct' ? -1 : 1;          // direct first
    if (a.valid !== b.valid) return a.valid ? -1 : 1;                     // valid first
    return (a.template.meta.label || '').localeCompare(b.template.meta.label || '');
  });
}

/**
 * Produce a new activity switched to `targetName`, converting content if the
 * target uses a different model. Returns null if the switch isn't possible.
 * Does not mutate the input.
 * @returns {Object|null}
 */
export function applySwitch(activity, targetName, templates) {
  const fromModel = modelOf(activity.template, templates);
  const target = templates.find(t => t.meta?.name === targetName);
  const toModel = target?.meta?.contentModel;
  if (!fromModel || !toModel || !canConvert(fromModel, toModel)) return null;
  const content = convert(fromModel, toModel, activity.content);
  if (content == null) return null;
  return {
    ...activity,
    template: targetName,
    content,
    // Reset template-specific knobs to the target's defaults; keep meta/content.
    rules: target.meta.defaultRules ? target.meta.defaultRules() : (activity.rules || {}),
    scoring: target.meta.defaultScoring ? target.meta.defaultScoring() : (activity.scoring || {}),
    live: target.meta.defaultLive ? target.meta.defaultLive() : (activity.live || {}),
    updatedAt: new Date().toISOString(),
  };
}
