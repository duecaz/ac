// Thin wrapper that delegates to the template's renderer. Applies the
// activity's skin AND background during play and reverts when the user
// navigates away (via lifecycle ctx).
//
// Pass opts.skipChrome = true when the caller (e.g. playerView) is already
// managing skin/background at the page level — avoids fighting the user's
// live skin pills.
import { getTemplate } from './registry.js';
import { applyScene } from './presentation.js';
import { acquire } from './lifecycle.js';

/**
 * @param {string|Element} rootSel
 * @param {import('../kernel/contracts/activity.js').Activity} activity
 * @param {import('../kernel/contracts/template.js').PlayerOpts & {skipChrome?: boolean}} [opts]
 */
export async function runPlayer(rootSel, activity, opts = {}) {
  const T = getTemplate(activity.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity.template}`);
  if (!opts.skipChrome) {
    const ctx = acquire('player');
    applyScene(activity, ctx);
  }
  return T.renderPlayer(rootSel, activity, opts);
}
