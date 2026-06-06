// UI glue for the Wordwall-style "switch format" feature. Thin layer over the
// pure engine in kernel/content (switchOptions/applySwitch); keeps registry +
// storage wiring out of the engine so the engine stays Node-testable.
import { listTemplates } from '../core/registry.js';
import { switchOptions, applySwitch } from '../kernel/content/index.js';
import { save } from '../core/storage.js';

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
