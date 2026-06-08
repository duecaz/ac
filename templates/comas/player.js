// Comas player — solo mode. Thin wrapper over the shared text-correction
// runner: one passage per screen, tap the gap where a comma is missing,
// "Listo" reveals, advance. Same mechanic and scoring as VS/Equipos/LIVE.
import { runTextCorrectionSolo } from '../../core/textCorrectionRound.js';

export function renderComasPlayer(rootSel, activity, opts = {}) {
  return runTextCorrectionSolo(rootSel, activity, opts, { kind: 'coma', title: activity.title || 'Comas' });
}
