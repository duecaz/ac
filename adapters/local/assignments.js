// Local assignments (tareas) driver — async homework with no backend. Stores
// assignments and attempts in a key-value store (localStorage in the browser;
// injectable for tests). Mirrors the snake_case shape that views read from the
// Supabase rows (due_at, max_attempts, activity_snap, status, …).
import { rid } from '../../core/ids.js';
import { LETTERS, PIN_LENGTH } from '../../core/constants.js';
import { normalizeCode, esMiTarea } from '../../core/assignmentRules.js';

const K_ASSIGN = 'ww.assignments';
const K_ATTEMPTS = 'ww.assignment_attempts';

function defaultKV() { try { return globalThis.localStorage || null; } catch { return null; } }
function genCode() { let s = ''; for (let i = 0; i < PIN_LENGTH; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return s; }
function genId() { return rid('asg_'); }

export function createLocalAssignments({ kv = defaultKV(), userId, identities } = {}) {
  const mem = new Map();
  const read = (key, fallback) => {
    if (kv) { try { return JSON.parse(kv.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
    return mem.has(key) ? mem.get(key) : fallback;
  };
  const write = (key, val) => { if (kv) kv.setItem(key, JSON.stringify(val)); else mem.set(key, val); };
  // La identidad puede venir como VALOR (tests) o como FUNCIÓN (la app): el
  // driver se memoiza por carga de página y el profe entra después, así que
  // preguntarla en cada llamada es lo que hace que sus tareas queden selladas
  // con su cuenta y no con el id anónimo del navegador.
  const val = (x, def) => (typeof x === 'function' ? x() : x) || def;
  const uid = () => val(userId, 'local-anon');
  const mios = () => val(identities, null) || [uid()];

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

    // MIS tareas de esta actividad, con el MISMO predicado que PocketBase
    // (`esMiTarea`, core/assignmentRules.js): dos frases escritas por separado
    // ya habían divergido —el local toleraba filas sin autor y el de PB no—, y
    // entonces el e2e local deja de probar lo que ocurre en producción.
    async listAssignmentsForActivity(activityId) {
      return Object.values(assignments())
        .filter(a => a.activity_id === activityId && esMiTarea(a, mios()))
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

    async recordAttempt(assignmentId, activityId, playerName, scoreAuto, maxScoreVal, timeUsed, answers = [], qid = '') {
      const log = attempts();
      // Espejo del índice único remoto (deuda D): un reintento con el mismo qid
      // no duplica el intento.
      if (qid && log.some(a => a.qid === qid)) return;
      log.push({
        qid,
        assignment_id: assignmentId, activity_id: activityId, user_id: uid(),
        player_name: playerName, score_auto: scoreAuto, score_final: scoreAuto,
        max_score: maxScoreVal, time_used: timeUsed, answers,
        created_at: new Date().toISOString(),
      });
      write(K_ATTEMPTS, log);
    },
  };
}

export default createLocalAssignments;
