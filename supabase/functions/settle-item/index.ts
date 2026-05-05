// Deployed via MCP. Mirror for repo history.
// Server-side scoring: clients can only INSERT answers with correct=null/points=0
// (RLS). This function (service role) computes correct + points and updates rows.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userRes, error: uErr } = await anonClient.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "invalid token" }, 401);
    const userId = userRes.user.id;

    const { session_id, item_index } = await req.json();
    if (!session_id || typeof item_index !== "number") return json({ error: "bad body" }, 400);

    const { data: sess, error: sErr } = await admin.from("sessions")
      .select("id, host_id, activity_snap").eq("id", session_id).single();
    if (sErr || !sess) return json({ error: "session not found" }, 404);
    if (sess.host_id !== userId) return json({ error: "not host" }, 403);

    const activity = sess.activity_snap as any;
    const item = activity?.content?.items?.[item_index];
    if (!item) return json({ error: "item out of range" }, 400);

    const live = activity?.live || {};
    const scoring = activity?.scoring || {};
    const pointsModel = live.pointsModel || "flat";
    const speedBonusMax = live.speedBonusMax ?? 1000;
    const questionTimer = live.questionTimer || 20;
    const ppc = scoring.pointsPerCorrect ?? 1;
    const ppw = scoring.pointsPerWrong ?? 0;

    const { data: answers, error: aErr } = await admin.from("answers")
      .select("id, player_id, value, ms_taken")
      .eq("session_id", session_id).eq("item_index", item_index);
    if (aErr) return json({ error: aErr.message }, 500);

    const updates: Array<{ id: string; player_id: string; correct: boolean | null; points: number }> = [];
    for (const a of answers || []) {
      const ok = isCorrect(item, a.value);
      let points = 0;
      let correct: boolean | null = null;
      if (ok === null) { correct = null; points = 0; }
      else if (!ok) { correct = false; points = ppw < 0 ? ppw : 0; }
      else {
        correct = true;
        if (pointsModel === "kahoot") {
          const ms = a.ms_taken || 0;
          const max = questionTimer * 1000;
          const remain = Math.max(0, 1 - ms / max);
          const base = item.points || ppc || 1;
          points = Math.round(base * 500 + speedBonusMax * remain);
        } else {
          points = item.points || ppc || 1;
        }
      }
      updates.push({ id: a.id, player_id: a.player_id, correct, points });
    }

    for (const u of updates) {
      await admin.from("answers").update({ correct: u.correct, points: u.points }).eq("id", u.id);
    }

    const { data: tally } = await admin.from("answers")
      .select("player_id, points").eq("session_id", session_id);
    const totals = new Map<string, number>();
    for (const r of tally || []) totals.set(r.player_id, (totals.get(r.player_id) || 0) + (r.points || 0));
    for (const [pid, score] of totals) {
      await admin.from("players").update({ score }).eq("id", pid);
    }

    await admin.from("sessions").update({ phase: "reveal", deadline: null }).eq("id", session_id);

    return json({ ok: true, settled: updates.length });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function norm(s: unknown) {
  return String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function isCorrect(item: any, value: any): boolean | null {
  if (item.answer == null) return null;
  if (Array.isArray(item.answer)) return item.answer.map(norm).includes(norm(value));
  return norm(item.answer) === norm(value);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
