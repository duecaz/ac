// Pure wheel logic — no DOM, fully testable. Extracted from player.js so the
// landing maths and the "remove after spin" handling can be verified in Node.

const EMPTY = '(vacío)';

/** Clean entries to non-empty strings; never return an empty wheel. */
export function normalizeEntries(entries) {
  const out = (entries || []).map(e => String(e)).filter(e => e.trim());
  return out.length ? out : [EMPTY];
}

/** Random slice index in [0, count). `rnd` injectable for deterministic tests. */
export function pickIndex(count, rnd = Math.random) {
  return Math.floor(rnd() * count);
}

/**
 * Degrees of rotation so slice `target` (of `count`) ends centered under the
 * top pointer, after at least `turns` full spins.
 */
export function landingRotation(target, count, turns = 5) {
  const arc = 360 / count;
  return 360 * turns + (360 - (target * arc + arc / 2));
}

/** Immutable remove; never collapses to an empty wheel. */
export function removeAt(entries, index) {
  const out = entries.filter((_, i) => i !== index);
  return out.length ? out : [EMPTY];
}

/** Slice label for the wheel face: truncate long text with an ellipsis. */
export function truncLabel(s, max = 16) {
  const str = String(s ?? '');
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}
