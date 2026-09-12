// Pure rules for async assignments (tareas) — no DOM, no backend. Extracted from
// views/studentTask.js so the gating (closed / past-due / attempts) is testable
// and identical across drivers.
import { clock } from './clock.js';
import { LETTERS, PIN_LENGTH } from './constants.js';

/** La identidad de quien crea tareas: un VALOR (los tests) o una FUNCIÓN (la app).
 *  @typedef {string|(() => string|null)} Identidad */

/** EL PIN PÚBLICO de una tarea. Estaba tecleado igual en los dos drivers.
 *  `Math.random` a propósito y declarado en ALLOW (§23 azar-primitivo): un PIN
 *  tiene que ser IMPREDECIBLE — reproducirlo sería el fallo, así que no sale del
 *  primitivo sembrable.
 *  @returns {string} */
export function genCode() {
  let s = '';
  for (let i = 0; i < PIN_LENGTH; i++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}

/**
 * QUIÉN SELLA Y QUIÉN FILTRA — las dos identidades de un driver de tareas,
 * resueltas EN CADA LLAMADA y no al construirlo: el driver se memoiza por carga
 * de página y el profe suele entrar DESPUÉS, así que con la identidad congelada
 * sus tareas se sellarían como anónimas toda la sesión (y él perdería de vista
 * sus PIN). Los dos adaptadores tenían estas dos líneas copiadas.
 * @param {{userId?: Identidad, identities?: string[]|(() => string[])}} deps
 * @returns {{uid: () => string, mios: () => (string|null|undefined)[]}}
 */
export function identidadDeTareas({ userId, identities }) {
  const uid = () => (typeof userId === 'function' ? userId() : userId) || 'local-anon';
  const mios = () => (typeof identities === 'function' ? identities() : identities) || [uid()];
  return { uid, mios };
}

/** Public codes are matched upper-cased and trimmed.
 *  @param {unknown} code @returns {string} */
export function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

/** Has the due date passed? `now` may be ms or a Date/ISO. No due date → never.
 *  @param {string|Date|null|undefined} dueAt
 *  @param {number|string|Date} [now]
 *  @returns {boolean} */
export function isPastDue(dueAt, now = clock.now()) {
  if (!dueAt) return false;
  const nowMs = typeof now === 'number' ? now : new Date(now).getTime();
  return new Date(dueAt).getTime() < nowMs;
}

/** Attempts still available (maxAttempts defaults to 1). Never negative.
 *  @param {number|null|undefined} maxAttempts @param {number|null|undefined} taken
 *  @returns {number} */
export function attemptsRemaining(maxAttempts, taken) {
  const max = maxAttempts ?? 1;
  return Math.max(0, max - (taken || 0));
}

/**
 * Can this student start an attempt? Mirrors views/studentTask.js order:
 * not found → closed → past due → no attempts left.
 * @param {{status?: string, due_at?: string|null, max_attempts?: number|null}|null|undefined} assignment
 * @param {number|null|undefined} taken
 * @param {number|string|Date} [now]
 * @returns {import('../kernel/contracts/session.js').AssignmentGate}
 */
export function assignmentGate(assignment, taken, now = clock.now()) {
  if (!assignment) return { allowed: false, reason: 'notFound' };
  if (assignment.status === 'closed') return { allowed: false, reason: 'closed' };
  if (isPastDue(assignment.due_at, now)) return { allowed: false, reason: 'pastDue' };
  if (attemptsRemaining(assignment.max_attempts, taken) <= 0) return { allowed: false, reason: 'noAttemptsLeft' };
  return { allowed: true, reason: null };
}

/** ¿ESTA TAREA ES MÍA? — el criterio, escrito una vez para los dos adaptadores.
 *
 *  Nació al abrir «Tarea» sobre toda la biblioteca (v1.51.621): la pantalla de
 *  tareas de una actividad listaba las de CUALQUIER profe que la hubiera mandado
 *  (PIN, intentos y los botones de «Cerrar» y «Rotar PIN», que además funcionan
 *  porque la regla del servidor es solo AUTH).
 *
 *  DOS identidades, a propósito. `author_id` se sellaba con el id ANÓNIMO del
 *  navegador (`getAnonId`), así que filtrar solo por él significaba «tareas
 *  creadas en este navegador»: el mismo profe en otra pizarra o tras limpiar la
 *  caché perdía de vista sus PIN — justo el fallo que se acaba de arreglar para
 *  las actividades. Desde v1.51.623 se sella con la cuenta (`getAuthUserId`,
 *  obligatoria para llegar a `#/tasks`), y el id anónimo se sigue aceptando para
 *  no dejar huérfanas las tareas creadas antes ni las del backend local.
 *
 *  @param {{author_id?: string}|null|undefined} row  fila de `assignments`
 *  @param {(string|null|undefined)[]} mios   identidades de este profe (cuenta y/o navegador)
 *  @returns {boolean}
 */
export function esMiTarea(row, mios) {
  const ids = (mios || []).filter(Boolean);
  return !!row && ids.includes(row.author_id);
}
