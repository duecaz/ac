import { getClient } from './supabase.js';

export async function saveResult(r) {
  try {
    const sb = await getClient();
    await sb.from('results').insert({
      activity_id: r.activityId || null,
      session_id: r.sessionId || null,
      user_id: r.userId || null,
      player_name: r.playerName || null,
      score_auto: r.scoreAuto ?? null,
      score_final: r.scoreFinal ?? null,
      max_score: r.maxScore ?? null,
      time_used: r.timeUsed ?? null,
      overrides: r.overrides || []
    });
  } catch (e) {
    console.warn('[results] save failed:', e.message);
  }
}
