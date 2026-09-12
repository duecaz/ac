// Tildes player — solo mode. Thin wrapper over the shared text-correction
// runner: one passage per screen, tap the vowels that take an accent, "Listo"
// reveals, advance. Same mechanic and scoring as VS/Equipos/LIVE.
import { runTextCorrectionSolo } from '../../core/textCorrectionSolo.js';

/**
 * @param {string|Element} rootSel
 * @param {import('../../kernel/contracts/activity.js').Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export function renderTildesPlayer(rootSel, activity, opts = {}) {
  return runTextCorrectionSolo(rootSel, activity, opts, { kind: 'tilde', title: activity.title || 'Tildes' });
}
