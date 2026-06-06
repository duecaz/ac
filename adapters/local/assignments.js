// Local assignments (tareas) driver — async homework with no backend. Stores
// assignments and attempts in a key-value store (localStorage in the browser;
// injectable for tests). Mirrors the snake_case shape that views read from the
// Supabase rows (due_at, max_attempts, activity_snap, status, …).
import { LETTERS, PIN_LENGTH } from '../../core/constants.js';
import { normalizeCode } from '../../core/assignmentRules.js';

const K_ASSIGN = 'ww.assignments';
const K_ATTEMPTS = 'ww.assignment_attempts';

function defaultKV() { try { return globalThis.localStorage || null; } catch { return null; } }
function genCode() { let s = ''; for (let i = 0; i < PIN_LENGTH; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return s; }
function genId() { return 'asg_' + Math.random().toString(36).slice(2, 10); }

export function createLocalAssignments({ kv = defaultKV(), userId } = {}) {
  const mem = new Map();
  const read = (key, fallback) => {
    if (kv) { try { return JSON.parse(kv.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
    return mem.has(key) ? mem.get(key) : fallback;
  };
  const write = (key, val) => { if (kv) kv.setItem(key, JSON.stringify(val)); else mem.set(key, val); };
  const uid = () => userId || 'local-anon';

  const assignments = () => read(K_ASSIGN, {});
  const attempts = () => read(K_ATTEMPTS, []);

  return {
    async createAssignment(activity, { title, dueAt, maxAttempts } = {}) {
      const map = assignments();
      const id = genId();
      const row = {
        id, code: genCode(),
        activity_id: activity.id, activity_snap: activity,
        author_id: uid(),
        title: title || activity.title,
        due_at: dueAt || null,
        max_attempts: maxAttempts ?? 1,
        status: 'open',
        created_at: new Date().toISOString(),
      };
      map[id] = row; write(K_ASSIGN, map);
      return { id, code: row.code };
    },

    async listAssignmentsForActivity(activityId) {
      return Object.values(assignments())
        .filter(a => a.activity_id === activityId)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    },

    async findAssignmentByCode(code) {
      const target = normalizeCode(code);
      return Object.values(assignments()).find(a => a.code === target) || null;
    },

    async closeAssignment(id) {
      const map = assignments();
      if (map[id]) { map[id].status = 'closed'; write(K_ASSIGN, map); }
    },

    async rotateAssignmentCode(id) {
      const map = assignments();
      if (!map[id]) throw new Error('Tarea no encontrada');
      map[id].code = genCode(); write(K_ASSIGN, map);
      return map[id].code;
    },

    async listAttempts(assignmentId) {
      return attempts()
        .filter(r => r.assignment_id === assignmentId)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    },

    async countOwnAttempts(assignmentId) {
      const me = uid();
      return attempts().filter(r => r.assignment_id === assignmentId && r.user_id === me).length;
    },

    async recordAttempt(assignmentId, activityId, playerName, scoreAuto, maxScore, timeUsed) {
      const log = attempts();
      log.push({
        assignment_id: assignmentId, activity_id: activityId, user_id: uid(),
        player_name: playerName, score_auto: scoreAuto, score_final: scoreAuto,
        max_score: maxScore, time_used: timeUsed, created_at: new Date().toISOString(),
      });
      write(K_ATTEMPTS, log);
    },
  };
}

export default createLocalAssignments;
