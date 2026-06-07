// Shared podium component. Bar height reflects the player's PLACE BY SCORE, so
// players who tie get the same height (and the same place number) — which reads
// as a real tie instead of an arbitrary 1/2/3 staircase. Used by the live host
// podium and the VS duel result so they look identical.
import { escapeHtml } from './html.js';

/** `list`: entries sorted by score desc, shape { name, score }. Shows top 3. */
export function podiumHtml(list) {
  const top = (list || []).slice(0, 3);
  if (!top.length) return '<div class="ww-podium mb-4"></div>';
  // Standard competition ranking: same score → same place (ties share height).
  const placeOf = (i) => top.filter(p => p.score > top[i].score).length + 1;
  // Classic arrangement: 2nd · 1st · 3rd (winner centered) when we have 3;
  // for 2 players show them side by side; for 1, just the one.
  const order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [0, 1] : [0];
  const steps = order.map(i => top[i] ? `
    <div class="step s${Math.min(placeOf(i), 3)}">
      <div class="display-6">${placeOf(i)}</div>
      <div class="fw-bold">${escapeHtml(top[i].name)}</div>
      <div>${top[i].score} pts</div>
    </div>` : '<div></div>').join('');
  return `<div class="ww-podium mb-4">${steps}</div>`;
}
