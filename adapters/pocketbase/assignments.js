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
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';
import { pbJson } from '../../core/pbHttp.js';

function genCode() {
  let s = '';
  for (let i = 0; i < PIN_LENGTH; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}

// El wrapper JSON vive UNA vez en core/pbHttp.js (el profe firma; el alumno va
// anónimo, exactamente como antes). Alias local para los llamadores.
const pbFetch = (path, opts) => pbJson(path, opts);

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
        `/api/collections/assignments/records?filter=${pbFilterParam(`activity_id='${pbEscape(activityId)}'`)}&sort=-created_at&perPage=200`
      );
      return res?.items || [];
    },

    async findAssignmentByCode(code) {
      const target = normalizeCode(code);
      const res = await pbFetch(
        `/api/collections/assignments/records?filter=${pbFilterParam(`code='${pbEscape(target)}'`)}`
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
        `/api/collections/assignment_attempts/records?filter=${pbFilterParam(`assignment_id='${pbEscape(assignmentId)}'`)}&sort=-created_at&perPage=200`
      );
      return res?.items || [];
    },

    async countOwnAttempts(assignmentId) {
      const me = uid();
      const res = await pbFetch(
        `/api/collections/assignment_attempts/records?filter=${pbFilterParam(`assignment_id='${pbEscape(assignmentId)}' && user_id='${pbEscape(me)}'`)}&perPage=1`
      );
      return res?.totalItems ?? 0;
    },

    // §22-3 — el intento declara su NÚMERO y el servidor lo acota contra el
    // `max_attempts` de su tarea (regla + índice único). Antes el tope vivía solo
    // en el cliente: un POST a mano daba intentos infinitos.
    //   · 400 = el índice único rechazó ese attempt_no (dos entregas a la vez, o
    //     una cuenta desfasada) → se vuelve a contar y se reintenta con el
    //     siguiente número, igual que el retry de apodos del live.
    //   · 403 = la regla dijo NO: tope agotado o tarea cerrada. Eso no se
    //     reintenta, se explica.
    //   · `qid` (deuda D) = clave de idempotencia del reintento. Sin ella, un ACK
    //     perdido + reintento de la cola offline recontaba, entraba con
    //     attempt_no+1 y DUPLICABA la fila — gastándole un intento al alumno.
    //     Ahora, ante cualquier 400 se comprueba primero si una fila con nuestro
    //     qid ya existe: si sí, el primer envío llegó → éxito, no reintento.
    async recordAttempt(assignmentId, activityId, playerName, scoreAuto, maxScore, timeUsed, answers = [], qid = '') {
      const mine = () => pbFetch(
        `/api/collections/assignment_attempts/records?filter=${pbFilterParam(`assignment_id='${pbEscape(assignmentId)}' && user_id='${pbEscape(uid())}'`)}&perPage=50&fields=qid`
      ).then(r => r?.items || []).catch(() => []);
      let taken = await this.countOwnAttempts(assignmentId).catch(() => 0);
      for (let tries = 0; tries < 4; tries++) {
        try {
          return await postAttempt(taken + 1);
        } catch (e) {
          if (e?.status === 403) {
            throw Object.assign(new Error('El servidor no aceptó el intento: la tarea está cerrada o ya has agotado los intentos.'), { status: 403 });
          }
          if (e?.status !== 400 || tries === 3) throw e;
          if (qid && (await mine()).some(r => r.qid === qid)) return;   // ya entregado
          const fresh = await this.countOwnAttempts(assignmentId).catch(() => taken + 1);
          taken = Math.max(taken + 1, fresh);
        }
      }

      async function postAttempt(attemptNo) {
        return pbFetch('/api/collections/assignment_attempts/records', {
        method: 'POST',
        body: JSON.stringify({
          attempt_no: attemptNo,
          qid: qid || '',
          assignment_id: assignmentId,
          activity_id: activityId,
          user_id: uid(),
          player_name: playerName,
          score_auto: scoreAuto,
          score_final: scoreAuto,
          max_score: maxScore,
          time_used: timeUsed,
          answers,   // detalle por ítem para la analítica (F3)
          created_at: new Date().toISOString(),
        }),
        });
      }
    },
  };
}

export default createPocketbaseAssignments;
