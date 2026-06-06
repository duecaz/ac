// Deployed via MCP. Mirror for repo history.
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
    const jwt = auth.replace("Bearer ", "");
    if (!jwt) return json({ error: "missing token" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }
    });
    const admin = createClient(url, serviceKey, { db: { schema: "repo_ac" } });

    const { data: userRes, error: uErr } = await anonClient.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "invalid token" }, 401);
    const userId = userRes.user.id;

    const body = await req.json();
    const { activity_id, activity, rules } = body;
    if (!activity || !Array.isArray(activity?.content?.items) || activity.content.items.length === 0) {
      return json({ error: "activity required with items" }, 400);
    }

    const { data: codeData, error: cErr } = await admin.rpc("generate_session_code");
    if (cErr) return json({ error: cErr.message }, 500);
    const code = codeData as string;

    const { data: session, error: sErr } = await admin.from("sessions").insert({
      code,
      host_id: userId,
      activity_id: activity_id || null,
      activity_snap: activity,
      rules: rules || {},
      status: "lobby",
      phase: "idle",
      current_item: -1
    }).select("id, code").single();
    if (sErr) return json({ error: sErr.message }, 500);
    return json({ id: session.id, code: session.code });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
