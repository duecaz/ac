// REGLAS de PocketBase — FUENTE ÚNICA (ley de confianza, docs/leyes.md §22).
//
// Por qué existe: las reglas vivían escritas a mano en DOS sitios
// (`views/adminView.js` y `tools/setup-pocketbase.ps1`) y DIVERGIERON — la
// variante del script exigía sesión para leer `assignment_attempts`, lo que
// rompía el tope de intentos del alumno anónimo. Ahora las dos las LEEN de
// aquí, y `tests/pbRules.test.mjs` falla si vuelven a separarse.
//
// Módulo PURO (sin DOM ni fetch) → los tests pueden EVALUAR las reglas contra
// peticiones simuladas (`tests/liveRules.test.mjs` hace correr el adaptador
// real contra ellas). Las reglas dejan de ser configuración de servidor sin
// vigilancia y pasan a ser contrato ejecutable.
//
// Semántica de PocketBase:
//   ''    = abierto a cualquiera (incluido anónimo)
//   null  = CERRADO por API (ni el dueño puede; solo superadmin)
//   expr  = se evalúa por petición (@request.auth.*, @request.body.*)

/** Hay sesión (profe). El ALUMNO es anónimo y nunca cumple esto. */
export const AUTH = '@request.auth.id != ""';
export const ADMIN = '@request.auth.role = "admin"';
/** Dueño de la fila, o un admin (aditiva: solo concede). */
export const OWN = `owner = @request.auth.id || ${ADMIN}`;

// Campos de VEREDICTO de una respuesta en vivo: los pone el settle del HOST.
// Un alumno anónimo no puede ni mencionarlos en un PATCH (sin esto, un PATCH
// desde DevTools con {scored:true, points:9999} se saltaba C6 por completo: el
// settle respeta lo "ya puntuado" y el marcador suma esos puntos).
const VERDICT_FIELDS = ['scored', 'points'];
const notSet = (f) => `@request.body.${f}:isset = false`;
/** Anónimo: puede crear su respuesta, pero SIN veredicto (0 puntos, sin puntuar). */
const ANON_ANSWER_CREATE = '@request.body.scored = false && @request.body.points = 0';
/** Anónimo: puede corregir su valor/tiempo, pero NO tocar el veredicto. */
const ANON_ANSWER_UPDATE = VERDICT_FIELDS.map(notSet).join(' && ');

// Campos de CONTROL de la sala: el blob `state` (fase, ítem actual, deadline,
// puntajes), la actividad con sus respuestas y el código. Todo eso es del HOST.
// El alumno solo escribe el campo `ql` (pedir la palabra en Pregunta en Vivo),
// que por eso vive FUERA del blob.
const ROOM_FIELDS = ['state', 'activity', 'code'];
const ANON_ROOM_UPDATE = ROOM_FIELDS.map(notSet).join(' && ');

/**
 * Reglas por colección. Cambiar algo aquí exige re-aplicarlas desde
 * `#/admin` → "Crear colecciones" (y verificar con `bash tools/check-pb.sh`).
 */
export const RULES = {
  // ── Contenido del profe ────────────────────────────────────────────────────
  activities: {
    listRule: `visibility = "public" || ${OWN}`,
    viewRule: `visibility = "public" || ${OWN}`,
    // Crear exige sesión Y que el owner enviado seas tú (no a nombre de otro).
    createRule: `${AUTH} && owner = @request.auth.id`,
    updateRule: OWN,
    deleteRule: OWN,
  },
  // Historial individual: el alumno anónimo CREA su fila; nadie la edita/borra.
  // LEER exige sesión (privacidad: nombres y puntajes de menores). El único
  // lector real es el diagnóstico de `#/admin`, donde el profe está dentro.
  results: { listRule: AUTH, viewRule: AUTH, createRule: '', updateRule: null, deleteRule: null },

  // ── EN VIVO (fase de reglas live) ─────────────────────────────────────────
  // Dirigir una sala es acto del PROFE: crear/cerrar/avanzar exige sesión. El
  // alumno solo puede pedir la palabra (campo `ql`).
  live_sessions: {
    listRule: '', viewRule: '',
    createRule: AUTH,
    updateRule: `${AUTH} || (${ANON_ROOM_UPDATE})`,
    deleteRule: AUTH,
  },
  live_answers: {
    listRule: '', viewRule: '',
    createRule: `${AUTH} || (${ANON_ANSWER_CREATE})`,
    updateRule: `${AUTH} || (${ANON_ANSWER_UPDATE})`,
    deleteRule: AUTH,
  },
  // El alumno CREA su fila al entrar (apodo único por índice). Nadie renombra
  // (update cerrado) y solo el PROFE expulsa (antes cualquier alumno podía
  // echar a un compañero).
  live_players: { listRule: '', viewRule: '', createRule: '', updateRule: null, deleteRule: AUTH },

  // ── Tareas ────────────────────────────────────────────────────────────────
  // Crear/cerrar/rotar es del profe; el alumno solo LEE (buscar por código y
  // contar sus intentos). Antes un alumno podía reabrir una tarea cerrada,
  // mover la fecha o subirse el tope de intentos.
  assignments: { listRule: '', viewRule: '', createRule: AUTH, updateRule: AUTH, deleteRule: AUTH },
  // list/view ABIERTOS a propósito: el tope de intentos lo cuenta el alumno
  // ANÓNIMO (countOwnAttempts). Con auth aquí, el gateo de tareas revienta.
  assignment_attempts: { listRule: '', viewRule: '', createRule: '', updateRule: null, deleteRule: null },

  // ── Biblioteca pública ────────────────────────────────────────────────────
  activity_likes: {
    listRule: '', viewRule: '',
    createRule: `${AUTH} && user = @request.auth.id`,
    updateRule: null,
    deleteRule: `${AUTH} && user = @request.auth.id`,
  },
  reports: { listRule: ADMIN, viewRule: ADMIN, createRule: AUTH, updateRule: null, deleteRule: ADMIN },
  profiles: {
    listRule: '', viewRule: '',
    createRule: `${AUTH} && owner = @request.auth.id`,
    updateRule: 'owner = @request.auth.id',
    deleteRule: 'owner = @request.auth.id',
  },
};

/** Reglas de una colección (o `null` si no está declarada). */
export function rulesFor(name) {
  return RULES[name] || null;
}

/**
 * Colecciones cuyas ESCRITURAS exigen sesión de profe. La UI las usa para
 * avisar ANTES de empezar (dirigir una sala sin haber entrado fallaría a mitad
 * de clase, que es el peor momento para descubrirlo).
 */
export const HOST_ONLY_WRITES = ['live_sessions', 'assignments'];
