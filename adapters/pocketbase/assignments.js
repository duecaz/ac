// PocketBase Assignments driver — async homework persisted in PocketBase.
//
// Required PocketBase collection `assignments` fields:
//   code         text   (required, unique index)
//   activity_id  text
//   activity_snap json
//   author_id    text
//   title        text
//   due_at       text   (ISO datetime, nullable)
//   max_attempts number (default 1)
//   status       text   ('open' | 'closed')
//   created_at   text   (ISO datetime)
//
// Required PocketBase collection `assignment_attempts` fields:
//   assignment_id text
//   activity_id   text
//   user_id       text
//   player_name   text
//   score_auto    number
//   score_final   number
//   max_score     number
//   time_used     number
//   created_at    text
//
// API rules: allow all (or restrict by author_id for mutations).
import { LETTERS, PIN_LENGTH } from '../../core/constants.js';
import { normalizeCode } from '../../core/assignmentRules.js';
import { PB_URL } from '../../pocketbase.config.js';

function genCode() {
  let s = '';
  for (let i = 0; i < PIN_LENGTH; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}

async function pbFetch(path, opts = {}) {
  const { body: reqBody, method, headers: extra, ...rest } = opts;
  const headers = {};
  if (reqBody && typeof reqBody === 'string') headers['Content-Type'] = 'application/json';
  if (extra) Object.assign(headers, extra);
  const r = await fetch(`${PB_URL}${path}`, {
    method: method || 'GET',
    headers,
    ...(reqBody !== undefined ? { body: reqBody } : {}),
    ...rest,
  });
  if (r.status === 204) return null;
  const text = await r.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { throw Object.assign(new Error(`PocketBase error ${r.status}: respuesta no-JSON`), { status: r.status }); }
  }
  if (!r.ok) throw Object.assign(new Error(body?.message || `PocketBase error ${r.status}`), { status: r.status, pb: body });
  return body;
}

export function createPocketbaseAssignments({ userId = 'local-anon' } = {}) {
  const uid = () => userId;

  return {
    async createAssignment(activity, { title, dueAt, maxAttempts } = {}) {
      const code = genCode();
      const now = new Date().toISOString();
      const rec = await pbFetch('/api/collections/assignments/records', {
        method: 'POST',
        body: JSON.stringify({
          code,
          activity_id: activity.id,
          activity_snap: activity,
          author_id: uid(),
          title: title || activity.title,
          due_at: dueAt || null,
          max_attempts: maxAttempts ?? 1,
          status: 'open',
          created_at: now,
        }),
      });
      return { id: rec.id, code: rec.code };
    },

    async listAssignmentsForActivity(activityId) {
      const res = await pbFetch(
        `/api/collections/assignments/records?filter=(activity_id='${encodeURIComponent(activityId)}')&sort=-created_at&perPage=200`
      );
      return res?.items || [];
    },

    async findAssignmentByCode(code) {
      const target = normalizeCode(code);
      const res = await pbFetch(
        `/api/collections/assignments/records?filter=(code='${encodeURIComponent(target)}')`
      );
      return res?.items?.[0] || null;
    },

    async closeAssignment(id) {
      await pbFetch(`/api/collections/assignments/records/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
    },

    async rotateAssignmentCode(id) {
      const code = genCode();
      await pbFetch(`/api/collections/assignments/records/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ code }),
      });
      return code;
    },

    async listAttempts(assignmentId) {
      const res = await pbFetch(
        `/api/collections/assignment_attempts/records?filter=(assignment_id='${encodeURIComponent(assignmentId)}')&sort=-created_at&perPage=200`
      );
      return res?.items || [];
    },

    async countOwnAttempts(assignmentId) {
      const me = uid();
      const res = await pbFetch(
        `/api/collections/assignment_attempts/records?filter=(assignment_id='${encodeURIComponent(assignmentId)}'%26%26user_id='${encodeURIComponent(me)}')&perPage=1`
      );
      return res?.totalItems ?? 0;
    },

    async recordAttempt(assignmentId, activityId, playerName, scoreAuto, maxScore, timeUsed) {
      await pbFetch('/api/collections/assignment_attempts/records', {
        method: 'POST',
        body: JSON.stringify({
          assignment_id: assignmentId,
          activity_id: activityId,
          user_id: uid(),
          player_name: playerName,
          score_auto: scoreAuto,
          score_final: scoreAuto,
          max_score: maxScore,
          time_used: timeUsed,
          created_at: new Date().toISOString(),
        }),
      });
    },
  };
}

export default createPocketbaseAssignments;
