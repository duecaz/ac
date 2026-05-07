// Live session operations and realtime subscriptions.
import { getClient, ensureAuth } from '../supabase.js';
import { getAnonId } from '../state.js';
import { isAcceptableNickname } from '../nicknameFilter.js';
import { SUPABASE_URL } from '../../supabase.config.js';

export async function startSession(sessionId) {
  const sb = await getClient();
  await sb.from('sessions').update({
    status: 'running', phase: 'question', current_item: 0, started_at: new Date().toISOString()
  }).eq('id', sessionId);
}

export async function setSessionState(sessionId, patch) {
  const sb = await getClient();
  const { error } = await sb.from('sessions').update(patch).eq('id', sessionId);
  if (error) throw error;
}

export async function endSession(sessionId) {
  const sb = await getClient();
  await sb.from('sessions').update({ status: 'ended', phase: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId);
  // Persist final results per player for this session.
  await sb.rpc('finalize_session_results', { p_session_id: sessionId });
}

// Calls the settle-item Edge Function. Server-side anti-cheat: scoring
// happens with service role; clients can't write correct/points.
export async function settleItem(sessionId, itemIndex) {
  await ensureAuth();
  const sb = await getClient();
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/settle-item`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, item_index: itemIndex })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'settle-item failed');
  return data;
}

export async function listPlayers(sessionId) {
  const sb = await getClient();
  const { data, error } = await sb.from('players').select('*').eq('session_id', sessionId).order('joined_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listAnswers(sessionId, itemIndex) {
  const sb = await getClient();
  const { data, error } = await sb.from('answers').select('*').eq('session_id', sessionId).eq('item_index', itemIndex);
  if (error) throw error;
  return data || [];
}

export async function leaderboard(sessionId, limit = 50) {
  const sb = await getClient();
  const { data, error } = await sb.from('players').select('id, name, score').eq('session_id', sessionId).order('score', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// Join: validates nickname client-side, upserts player by (session_id, user_id).
export async function joinSession(code, nickname) {
  const f = isAcceptableNickname(nickname);
  if (!f.ok) throw new Error('Apodo: ' + f.reason);
  await ensureAuth();
  const sb = await getClient();
  const { data: sess, error: sErr } = await sb.from('sessions').select('id, status, activity_snap').eq('code', code.toUpperCase()).maybeSingle();
  if (sErr) throw sErr;
  if (!sess) throw new Error('Sala no encontrada');
  if (sess.status === 'ended') throw new Error('La sala ha terminado');
  const live = sess.activity_snap?.live || {};
  if (sess.status !== 'lobby' && !live.allowLateJoin) throw new Error('La partida ya empezó');

  const userId = getAnonId();
  const { data: existing } = await sb.from('players').select('id, name').eq('session_id', sess.id).eq('user_id', userId).maybeSingle();
  if (existing) {
    // Reconnect.
    await sb.from('players').update({ last_seen: new Date().toISOString() }).eq('id', existing.id);
    return { sessionId: sess.id, playerId: existing.id, name: existing.name };
  }

  const { data: ins, error: iErr } = await sb.from('players').insert({
    session_id: sess.id, user_id: userId, name: f.value
  }).select('id').single();
  if (iErr) {
    if (iErr.code === '23505') throw new Error('Ese apodo o usuario ya está unido');
    if (iErr.message?.includes('MAX_PLAYERS_REACHED')) throw new Error('La sala está llena');
    throw iErr;
  }
  return { sessionId: sess.id, playerId: ins.id, name: f.value };
}

export async function submitAnswer(sessionId, playerId, itemIndex, value, msTaken) {
  const sb = await getClient();
  const { error } = await sb.from('answers').upsert({
    session_id: sessionId, player_id: playerId, item_index: itemIndex,
    value, ms_taken: msTaken, correct: null, points: 0
  }, { onConflict: 'session_id,player_id,item_index' });
  if (error) throw error;
}

export async function getOwnAnswer(sessionId, playerId, itemIndex) {
  const sb = await getClient();
  const { data } = await sb.from('answers').select('*')
    .eq('session_id', sessionId).eq('player_id', playerId).eq('item_index', itemIndex).maybeSingle();
  return data;
}

export async function kickPlayer(sessionId, playerId) {
  const sb = await getClient();
  await sb.from('players').delete().eq('session_id', sessionId).eq('id', playerId);
}

export async function pingPresence(playerId) {
  const sb = await getClient();
  await sb.from('players').update({ last_seen: new Date().toISOString() }).eq('id', playerId);
}

// Host heartbeat. Updates sessions.host_seen_at via RPC (RLS already
// restricts to host_id=auth.uid()).
export async function pingHost(sessionId) {
  const sb = await getClient();
  await sb.rpc('ping_host_session', { p_session_id: sessionId });
}

// Subscribe to realtime changes for a session: sessions row + players + answers.
// onChange({ table, eventType, new, old }).
// Subscribe to realtime changes for a session: sessions row + players + answers.
// onChange({ table, eventType, new, old }).
// Connection state changes are forwarded to setConnectionState (banner UI).
import { setConnectionState } from '../connection.js';

export async function subscribeRoom(sessionId, onChange) {
  const sb = await getClient();
  // Unique channel name so two simultaneous mounts don't collide on the same
  // already-subscribed channel (which throws "cannot add postgres_changes").
  const tag = Math.random().toString(36).slice(2, 8);
  const name = `room:${sessionId}:${tag}`;
  let torndown = false;
  const ch = sb.channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (p) => onChange({ table: 'sessions', eventType: p.eventType, new: p.new, old: p.old }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` },
        (p) => onChange({ table: 'players', eventType: p.eventType, new: p.new, old: p.old }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `session_id=eq.${sessionId}` },
        (p) => onChange({ table: 'answers', eventType: p.eventType, new: p.new, old: p.old }));
  await ch.subscribe((status) => {
    // Ignore status updates after we've manually torn the channel down —
    // those CLOSED events would otherwise trigger a false "reconnecting".
    if (torndown) return;
    if (status === 'SUBSCRIBED') setConnectionState('connected');
    else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') setConnectionState('reconnecting');
    else if (status === 'CLOSED') setConnectionState('reconnecting');
  });
  return () => { torndown = true; sb.removeChannel(ch); };
}
