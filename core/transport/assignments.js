// Async assignments: a teacher creates a task with a PIN and a due date.
// Students enter via #/task/:code and play SOLO at their own pace.
import { getClient, ensureAuth } from '../supabase.js';
import { getAnonId } from '../state.js';

export async function createAssignment(activity, { title, dueAt, maxAttempts } = {}) {
  await ensureAuth();
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: codeRes, error: cErr } = await sb.rpc('generate_assignment_code');
  if (cErr) throw cErr;
  const { data, error } = await sb.from('assignments').insert({
    code: codeRes,
    activity_id: activity.id,
    activity_snap: activity,
    author_id: user.id,
    title: title || activity.title,
    due_at: dueAt || null,
    max_attempts: maxAttempts ?? 1
  }).select('id, code').single();
  if (error) throw error;
  return data;
}

export async function listAssignmentsForActivity(activityId) {
  const sb = await getClient();
  const { data, error } = await sb.from('assignments')
    .select('*').eq('activity_id', activityId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function findAssignmentByCode(code) {
  const sb = await getClient();
  const { data } = await sb.from('assignments').select('*').eq('code', code.toUpperCase()).maybeSingle();
  return data;
}

export async function closeAssignment(id) {
  const sb = await getClient();
  await sb.from('assignments').update({ status: 'closed' }).eq('id', id);
}

export async function listAttempts(assignmentId) {
  const sb = await getClient();
  const { data, error } = await sb.from('results').select('*').eq('assignment_id', assignmentId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function countOwnAttempts(assignmentId) {
  const sb = await getClient();
  const userId = getAnonId();
  const { count, error } = await sb.from('results').select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId).eq('user_id', userId);
  if (error) throw error;
  return count || 0;
}

export async function recordAttempt(assignmentId, activityId, playerName, scoreAuto, maxScore, timeUsed) {
  const sb = await getClient();
  await sb.from('results').insert({
    assignment_id: assignmentId,
    activity_id: activityId,
    user_id: getAnonId(),
    player_name: playerName,
    score_auto: scoreAuto,
    score_final: scoreAuto,
    max_score: maxScore,
    time_used: timeUsed
  });
}
