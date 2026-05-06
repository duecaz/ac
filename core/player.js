// Thin wrapper that delegates to the template's renderer. Applies the
// activity's skin AND background during play and reverts when the user
// navigates away (via lifecycle ctx).
import { getTemplate } from './registry.js';
import { applySkin } from './skins.js';
import { applyBackground } from './backgrounds.js';
import { acquire } from './lifecycle.js';

export async function runPlayer(rootSel, activity, opts = {}) {
  const T = getTemplate(activity.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity.template}`);
  const ctx = acquire('player');
  const skin = activity.presentation?.skin || 'default';
  const bg = activity.presentation?.background || 'none';
  applySkin(skin);
  applyBackground(bg);
  ctx.add(() => { applySkin('default'); applyBackground('none'); });
  return T.renderPlayer(rootSel, activity, opts);
}
