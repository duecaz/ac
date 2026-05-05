// Thin wrapper that delegates to the template's renderer.
import { getTemplate } from './registry.js';

export async function runPlayer(rootSel, activity, opts = {}) {
  const T = getTemplate(activity.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity.template}`);
  return T.renderPlayer(rootSel, activity, opts);
}
