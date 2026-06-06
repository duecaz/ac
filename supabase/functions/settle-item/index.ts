// Dispatcher. Loads activity_snap, picks the scorer for activity.template,
// scores all answers for the round, updates rows, recomputes player totals,
// flips phase to 'reveal'. Adding a new template only requires a new scorer
// in _scorers/ and an entry in the SCORERS map below.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scoreOne as quizScoreOne } from "./_scorers/quiz.ts";

type Scorer = (activity: any, item: any, ans: any) => { correct: boolean | null; points: number };
const SCORERS: Record<string, Scorer> = {
  quiz: quizScoreOne
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ error: "missing token" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "repo_ac" } });

    const { data: userRes, error: uErr } = await anonClient.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "invalid token" }, 401);
    const userId = userRes.user.id;

    const { session_id, item_index } = await req.json();
    if (!session_id || typeof item_index !== "number") return json({ error: "bad body" }, 400);

    const { data: sess, error: sErr } = await admin.from("sessions")
      .select("id, host_id, activity_snap, phase, current_item, status").eq("id", session_id).single();
    if (sErr || !sess) return json({ error: "session not found" }, 404);
    if (sess.host_id !== userId) return json({ error: "not host" }, 403);

    // Idempotent: if we're already in reveal for THIS item (or beyond), don't
    // re-score. Saves work and avoids races on double-click.
    if (sess.status === 'ended') return json({ ok: true, alreadySettled: true, reason: 'session ended' });
    if (sess.phase === 'reveal' && sess.current_item === item_index) {
      return json({ ok: true, alreadySettled: true });
    }
    if (sess.phase === 'leaderboard' && sess.current_item >= item_index) {
      return json({ ok: true, alreadySettled: true });
    }

    const activity = sess.activity_snap as any;
    const scorer = SCORERS[activity?.template];
    if (!scorer) return json({ error: `no scorer for template ${activity?.template}` }, 400);

    const item = activity?.content?.items?.[item_index];
    if (!item) return json({ error: "item out of range" }, 400);

    const { data: answers, error: aErr } = await admin.from("answers")
      .select("id, player_id, value, ms_taken")
      .eq("session_id", session_id).eq("item_index", item_index);
    if (aErr) return json({ error: aErr.message }, 500);

    // Score each answer.
    const scored = (answers || []).map(a => ({ a, r: scorer(activity, item, a) }));

    // Streak bonus (server-side, anti-cheat). When live.streakBonus enabled,
    // look up each player's prior answers up to item_index-1 ordered, count
    // consecutive corrects ending right before this item, and add a flat
    // bonus per streak step. Default bonus = 50 pts per consecutive prior.
    if (activity?.live?.streakBonus && item_index > 0) {
      const playerIds = scored.filter(({ r }) => r.correct === true).map(({ a }) => a.player_id);
      if (playerIds.length) {
        const { data: history } = await admin.from("answers")
          .select("player_id, item_index, correct")
          .eq("session_id", session_id)
          .in("player_id", playerIds)
          .lt("item_index", item_index);
        const byPlayer = new Map<string, Array<{i: number; c: boolean | null}>>();
        for (const h of history || []) {
          const arr = byPlayer.get(h.player_id) || [];
          arr.push({ i: h.item_index, c: h.correct });
          byPlayer.set(h.player_id, arr);
        }
        const bonusPerStep = Number(activity.live.streakBonusPerStep ?? 50);
        for (const { a, r } of scored) {
          if (r.correct !== true) continue;
          const arr = (byPlayer.get(a.player_id) || []).sort((x, y) => x.i - y.i);
          // Count tail of consecutive corrects.
          let streak = 0;
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].c === true) streak++;
            else break;
          }
          if (streak >= 1) r.points = (r.points || 0) + bonusPerStep * streak;
        }
      }
    }

    // Update answers in parallel.
    await Promise.all(scored.map(({ a, r }) =>
      admin.from("answers").update({ correct: r.correct, points: r.points }).eq("id", a.id)
    ));
    const settled = scored.length;

    // Incremental score update: add this round's delta per player. Atomic via
    // the increment_player_score RPC (single UPDATE) so concurrent settles can't
    // lose a delta to a read-modify-write race.
    const deltas = new Map<string, number>();
    for (const { a, r } of scored) deltas.set(a.player_id, (deltas.get(a.player_id) || 0) + (r.points || 0));
    await Promise.all([...deltas].map(([pid, delta]) =>
      delta ? admin.rpc("increment_player_score", { p_player_id: pid, p_delta: delta }) : Promise.resolve()
    ));

    await admin.from("sessions").update({ phase: "reveal", deadline: null }).eq("id", session_id);

    return json({ ok: true, settled, template: activity.template });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
