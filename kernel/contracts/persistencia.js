// LO QUE QUEDA ESCRITO AL TERMINAR — resultados, tareas y entregas.
//
// Es el OTRO vocabulario de `session.js`: aquel describe JUGAR (modos, bucles,
// fases, la sala); este, lo que sobrevive a la partida y quién lo escribe
// (`core/persistPolicy.js` decide cuál de los tres, y nunca dos a la vez).
// Estaban en el mismo fichero y por eso ninguna lectura lo podía describir en
// una línea.
//
// Se consume igual que el resto:
//   /** @typedef {import('../kernel/contracts/persistencia.js').ResultRecord} ResultRecord */

/**
 * @typedef {import('./activity.js').Activity} Activity
 */

/**
 * EL RESULTADO QUE AFIRMA EL CLIENTE (`core/results.js` `saveResult`), en
 * camelCase. Solo lo escribe el modo Individual (`core/persistPolicy.js`).
 * @typedef {Object} ResultRecord
 * @property {string} activityId
 * @property {string} [sessionId]
 * @property {string} [userId]
 * @property {string} [playerName]
 * @property {number} [scoreAuto]
 * @property {number} [scoreFinal]
 * @property {number} [maxScore]     El techo lo DERIVA el shell del scorer, no una fórmula paralela.
 * @property {number} [timeUsed]     Segundos.
 * @property {unknown[]} [overrides]
 * @property {string} [_qid]         Clave de idempotencia de la cola offline (deuda D).
 */

/**
 * LA FILA de la colección `results` de PocketBase, en snake_case. OJO: NO es lo
 * mismo que `ResultRecord` — el adaptador local guarda y devuelve el objeto
 * camelCase tal cual, y el de PocketBase devuelve ESTA fila (ver el informe de
 * la Fase A: es una divergencia real de `listResults`, no un descuido de tipos).
 * @typedef {Object} ResultRow
 * @property {string} [id]
 * @property {string} activity_id
 * @property {string|null} [session_id]
 * @property {string|null} [user_id]
 * @property {string|null} [player_name]
 * @property {number|null} [score_auto]
 * @property {number|null} [score_final]
 * @property {number|null} [max_score]
 * @property {number|null} [time_used]
 * @property {unknown[]} [overrides]
 * @property {string} [qid]
 * @property {string} [created]
 */

/**
 * LA FILA de `assignments` (una TAREA). Snake_case en los dos adaptadores.
 * `activity_snap` es la actividad CONGELADA al mandarla: editarla después no
 * cambia lo que el alumno tiene delante (§24).
 * @typedef {Object} AssignmentRecord
 * @property {string} id
 * @property {string} code            PIN público, mayúsculas (`normalizeCode`).
 * @property {string} activity_id
 * @property {Activity} activity_snap
 * @property {string} author_id       La CUENTA del profe (o su id anónimo, en tareas legadas).
 * @property {string} title
 * @property {string|null} due_at      ISO.
 * @property {number} max_attempts     Defecto 1.
 * @property {'open'|'closed'} status
 * @property {string} created_at
 */

/**
 * LA FILA de `assignment_attempts` (una ENTREGA). `attempt_no` lo acota el
 * SERVIDOR contra `max_attempts` (§22-3): el tope no vive solo en el cliente.
 * @typedef {Object} AssignmentAttempt
 * @property {string} [id]
 * @property {number} [attempt_no]
 * @property {string} [qid]           Idempotencia del reintento (deuda D).
 * @property {string} assignment_id
 * @property {string} activity_id
 * @property {string} user_id
 * @property {string} player_name
 * @property {number} score_auto
 * @property {number} score_final
 * @property {number} max_score
 * @property {number} time_used
 * @property {unknown[]} [answers]    Detalle por ítem, para la analítica.
 * @property {string} created_at
 */

/**
 * El veredicto de `assignmentGate` (`core/assignmentRules.js`): en ese orden —
 * no existe, cerrada, vencida, sin intentos.
 * @typedef {Object} AssignmentGate
 * @property {boolean} allowed
 * @property {'notFound'|'closed'|'pastDue'|'noAttemptsLeft'|null} reason
 */

export {};
