// Quiz scorer used by settle-item. Mirrors templates/quiz/scorer.js semantics.
// Note: streak bonus, when enabled, is computed by the dispatcher (index.ts)
// because it needs the player's prior answers, which the dispatcher already
// knows. This scorer remains pure (no side reads).
function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function isCorrect(item: any, value: any): boolean | null {
  if (item.answer == null) return null;
  if (Array.isArray(item.answer)) return item.answer.map(norm).includes(norm(value));
  return norm(item.answer) === norm(value);
}

export function scoreOne(activity: any, item: any, ans: { value: any; ms_taken: number | null }) {
  const live = activity?.live || {};
  const scoring = activity?.scoring || {};
  const ok = isCorrect(item, ans.value);
  if (ok === null) return { correct: null, points: 0 };
  if (!ok) {
    const ppw = scoring.pointsPerWrong ?? 0;
    return { correct: false, points: ppw < 0 ? ppw : 0 };
  }
  const base = item.points || scoring.pointsPerCorrect || 1;
  if (live.pointsModel === "kahoot") {
    const max = (live.questionTimer || 20) * 1000;
    const remain = Math.max(0, 1 - (ans.ms_taken || 0) / max);
    return { correct: true, points: Math.round(base * 500 + (live.speedBonusMax ?? 1000) * remain) };
  }
  return { correct: true, points: base };
}
