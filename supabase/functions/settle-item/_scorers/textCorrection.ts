// Text-correction scorer used by settle-item (Tildes + Comas). Mirrors
// core/textMarks.js scoreMarks EXACTLY so server (Supabase) and local-engine
// scoring agree: one passage = one round, correct iff the student's marked
// positions match the answer-key positions for the kind. `value` is number[].
function scoreMarks(activity: any, item: any, value: any, kind: string) {
  const want = new Set((item?.marks || []).filter((m: any) => m.kind === kind).map((m: any) => m.pos));
  const got = new Set(Array.isArray(value) ? value.map(Number) : []);
  const correct = want.size === got.size && [...want].every((p) => got.has(p));
  const scoring = activity?.scoring || {};
  if (!correct) {
    const ppw = scoring.pointsPerWrong ?? 0;
    return { correct: false, points: ppw < 0 ? ppw : 0 };
  }
  return { correct: true, points: item?.points || scoring.pointsPerCorrect || 1 };
}

export const scoreTilde = (activity: any, item: any, ans: { value: any }) =>
  scoreMarks(activity, item, ans.value, "tilde");

export const scoreComa = (activity: any, item: any, ans: { value: any }) =>
  scoreMarks(activity, item, ans.value, "coma");
