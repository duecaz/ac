// Per-passage comma scoring for the session formats (VS / Equipos-auto / Solo).
// Thin binding over the shared mark scorer: correct iff the student's inserted
// comma positions exactly match the answer key's 'coma' positions. `value` is
// the array of character positions after which the student placed a comma.
import { scoreMarks } from '../../core/textMarks.js';

export function scoreComasSubmission({ value, item, activity }) {
  return scoreMarks(value, item, ['coma'], activity);
}
