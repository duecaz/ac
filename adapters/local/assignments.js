// Local assignments (tareas) driver — async homework with no backend. Stores
// assignments and attempts in a key-value store (localStorage in the browser;
// injectable for tests). Mirrors the snake_case shape that views read from the
// Supabase rows (due_at, max_attempts, activity_snap, status, …).
import { rid } from '../../core/ids.js';
import { normalizeCode, esMiTarea, genCode, identidadDeTareas } from '../../core/assignmentRules.js';
// FRONTERA (JSON del almacén): `unknown` estrechado, nunca creído.
import { esFila } from '../frontera.js';
import { crearKV } from './kv.js';

// Sin prefijo común: son las dos claves `ww.*` que declara `LS_OWNERS` (§21).
const K_ASSIGN = 'ww.assignments';
const K_ATTEMPTS = 'ww.assignment_attempts';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/dataPort.js').AssignmentsPort} AssignmentsPort
 * @typedef {import('../../kernel/contracts/persistencia.js').AssignmentAttempt} AssignmentAttempt
 * @typedef {import('../../kernel/contracts/persistencia.js').AssignmentRecord} AssignmentRecord
 * @typedef {import('./kv.js').KV} KV
 * @typedef {import('../../core/assignmentRules.js').Identidad} Identidad
 */

function genId() { return rid('asg_'); }

/**
 * @param {{ kv?: KV|null, userId?: Identidad, identities?: string[]|(() => string[]) }} [deps]
 * @returns {AssignmentsPort}
 */
export function createLocalAssignments({ kv, userId, identities } = {}) {
  // Almacén compartido con los otros dos drivers locales (`adapters/local/kv.js`).
  const { read, write } = crearKV('', kv);
  // La identidad (quién sella y quién filtra) es la MISMA de los dos drivers:
  // vive en core/assignmentRules.js.
  const { uid, mios } = identidadDeTareas({ userId, identities });

  /** @returns {Record<string, AssignmentRecord>} */
  const assignments = () => {
    const m = read(K_ASSIGN);
    return esFila(m) ? /** @type {Record<string, AssignmentRecord>} */ (m) : {};
  };
  /** @returns {AssignmentAttempt[]} */
  const attempts = () => {
    const l = read(K_ATTEMPTS);
    return Array.isArray(l) ? /** @type {AssignmentAttempt[]} */ (l) : [];
  };

  return {
    async createAssignment(activity, { title, dueAt, maxAttempts } = {}) {
      const map = assignments();
      const id = genId();
      /** @type {AssignmentRecord} */
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
