// Per-passage tildes scoring for the session formats (VS / Equipos-auto / Solo).
// Thin binding over the shared mark scorer: correct iff the student's accented
// positions exactly match the answer key's 'tilde' positions. `value` is the
// array of character positions the student marked.
import { scoreMarks } from '../../core/textMarks.js';

export function scoreTildesSubmission({ value, item, activity }) {
  return scoreMarks(value, item, ['tilde'], activity);
}
