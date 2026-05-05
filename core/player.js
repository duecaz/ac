// Thin wrapper that delegates to the template's renderer. Applies the
// activity's skin during play and reverts when the user navigates away.
import { getTemplate } from './registry.js';
import { applySkin } from './skins.js';
import { acquire } from './lifecycle.js';

export async function runPlayer(rootSel, activity, opts = {}) {
  const T = getTemplate(activity.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity.template}`);
  const ctx = acquire('player');
  const skin = activity.presentation?.skin || 'default';
  applySkin(skin);
  ctx.add(() => applySkin('default'));
  return T.renderPlayer(rootSel, activity, opts);
}
