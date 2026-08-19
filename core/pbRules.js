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
// `ms` ENTRÓ AQUÍ en v1.51.358: desde que el settle escribe en él el tiempo
// DERIVADO POR EL SERVIDOR (§22-1) y el ranking de la carrera se ordena por ese
// campo, `ms` dejó de ser una afirmación del cliente y pasó a ser veredicto. Sin
// esto, un alumno podía PATCHear SU PROPIA fila ya liquidada con {ms:0} —con su
// credencial legítima, sin tocar puntos— y salir primero en el podio con 0:00:
// en carrera la hora de meta es LO ÚNICO que ordena (todos acaban con todas
// bien). Reproducido con el evaluador de reglas del repo. El CREATE sigue
// aceptando `ms` (es el respaldo honesto cuando no hay sello de apertura).
const VERDICT_FIELDS = ['scored', 'points', 'ms'];
const notSet = (f) => `@request.body.${f}:isset = false`;
// §22-4 — LA RESPUESTA VA ATADA AL DISPOSITIVO. El `playerId` es público (la
// lista de jugadores de la sala se lee sin cuenta, y el host la necesita), así que
// bastaba con verlo para responder EN NOMBRE DE OTRO. Ahora, al entrar, el
// dispositivo se queda con un SECRETO que guarda en `live_claims` (colección
// CERRADA por API: nadie la lee ni la edita; el join de la regla es interno del
// servidor) y lo manda en una CABECERA con cada escritura. La cabecera no se
// guarda en la fila → no queda legible en `live_answers`, que sí es pública.
const CLAIM = '@collection.live_claims:cl';
const CLAIM_HEADER = `${CLAIM}.secret ?= @request.headers.x_ww_claim`;
/** Al CREAR, el jugador viene en el cuerpo. */
const CLAIM_BY_BODY = `${CLAIM}.player ?= @request.body.player && ${CLAIM_HEADER}`;
/** Al ACTUALIZAR, el jugador es el de la FILA (así nadie edita la fila de otro). */
const CLAIM_BY_ROW = `${CLAIM}.player ?= player && ${CLAIM_HEADER}`;

/** Anónimo: puede crear su respuesta, pero SIN veredicto (0 puntos, sin puntuar)
 *  y solo en su propio nombre (secreto del dispositivo). */
const ANON_ANSWER_CREATE = `@request.body.scored = false && @request.body.points = 0 && ${CLAIM_BY_BODY}`;
/** Anónimo: puede corregir el VALOR de SU fila, pero no el veredicto (que ahora
 *  incluye el tiempo: lo mide el servidor al liquidar). */
const ANON_ANSWER_UPDATE = [...VERDICT_FIELDS.map(notSet), CLAIM_BY_ROW].join(' && ');

// Campos de CONTROL de la sala: el blob `state` (fase, ítem actual, deadline,
// puntajes), la actividad con sus respuestas y el código. Todo eso es del HOST.
// El alumno solo escribe el campo `ql` (pedir la palabra en Pregunta en Vivo),
// que por eso vive FUERA del blob.
const ROOM_FIELDS = ['state', 'activity', 'code'];
const ANON_ROOM_UPDATE = ROOM_FIELDS.map(notSet).join(' && ');

// §22-3 — tope de intentos aplicado por el SERVIDOR (ver el comentario de
// `assignment_attempts` más abajo). Se declara aquí arriba para que la regla se
// lea de una pieza.
const ASG = '@collection.assignments:asg';
export const ATTEMPT_CREATE = [
  `${ASG}.id ?= @request.body.assignment_id`,
  `${ASG}.status ?!= "closed"`,
  `(@request.body.attempt_no = 1 || ${ASG}.max_attempts ?>= @request.body.attempt_no)`,
].join(' && ');

/**
 * `users` (colección de AUTH) — aparte del cuadro de abajo A PROPÓSITO: el panel
 * `#/admin` NO la toca (tocar el esquema de auth desde el navegador es la clase
 * de accidente que te deja sin poder entrar). La aplican las dos herramientas de
 * línea de comandos: `tools/pb-reglas-users.sh` (Pi) y `setup-pocketbase.ps1`
 * (Windows). Vive AQUÍ para que la regla esté escrita en UN solo sitio; que las
 * tres copias digan lo mismo lo vigila `tests/pbRules.test.mjs`.
 *
 * ALTA REABIERTA (decisión del dueño, 2026-08-11; U1 la había cerrado): el profe
 * se registra por correo desde `#/registro` porque no todos tienen Google. La
 * condición es que el cuerpo NO traiga `role` → nadie se registra como admin.
 * OJO: el login con OAuth2 no pasa por createRule, así que Google va igual.
 */
export const USERS_RULES = {
  viewRule:   'id = @request.auth.id || @request.auth.role = "admin"',
  listRule:   '@request.auth.role = "admin"',
  createRule: '@request.body.role:isset = false || @request.auth.role = "admin"',
};

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
  // §22-4 — CREDENCIAL DEL DISPOSITIVO. Crear es abierto (el alumno anónimo se
  // registra al entrar) y el índice ÚNICO (session, player) hace que el primero
  // en llegar se quede el jugador: nadie puede reclamar un jugador ya reclamado.
  // Todo lo demás CERRADO: ni leer (el secreto no se puede espiar) ni editar (no
  // se puede robar un jugador ajeno cambiándole el secreto). Las reglas que la
  // consultan lo hacen por JOIN, que es interno del servidor y no pasa por estas
  // reglas de API.
  // BORRADO (§25 · retención): cerrado para las credenciales de HOY —si se
  // pudiera borrar la credencial viva de un jugador, se le podría robar el
  // puesto re-registrando otra— y abierto al PROFE para las de días anteriores,
  // que es lo que permite purgar salas caducadas sin superadmin. `@todayStart`
  // lo evalúa el servidor, así que el reloj del cliente no entra en la decisión.
  live_claims: { listRule: null, viewRule: null, createRule: '', updateRule: null,
                 deleteRule: `${AUTH} && created < @todayStart` },

  // §22-2 — CLAVE DE LA SALA: la actividad COMPLETA (con las respuestas) vive
  // aquí, CERRADA a quien no tiene sesión. La sala (`live_sessions`) guarda solo
  // el snapshot saneado, porque su lectura tiene que ser abierta (el alumno entra
  // por PIN). Antes la clave viajaba en la sala → el móvil se leía todas las
  // respuestas sin necesidad de trampa ninguna.
  live_keys: { listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: AUTH },

  // ── Tareas ────────────────────────────────────────────────────────────────
  // Crear/cerrar/rotar es del profe; el alumno solo LEE (buscar por código y
  // contar sus intentos). Antes un alumno podía reabrir una tarea cerrada,
  // mover la fecha o subirse el tope de intentos.
  assignments: { listRule: '', viewRule: '', createRule: AUTH, updateRule: AUTH, deleteRule: AUTH },
  // list/view ABIERTOS a propósito: el tope de intentos lo cuenta el alumno
  // ANÓNIMO (countOwnAttempts). Con auth aquí, el gateo de tareas revienta.
  //
  // §22-3 — EL TOPE DE INTENTOS LO APLICA EL SERVIDOR. Antes el límite vivía
  // ENTERO en el cliente: `countOwnAttempts` contaba y la vista decidía, así que
  // un POST a mano (o simplemente borrar `ww.anonId`) daba intentos infinitos.
  // Ahora el intento declara su número (`attempt_no`) y la regla lo compara con
  // el `max_attempts` de SU tarea vía join, y rechaza si la tarea está cerrada.
  // El índice ÚNICO (assignment_id, user_id, attempt_no) remata: un attempt_no
  // repetido no entra, así que no se puede "gastar" el mismo número dos veces.
  //   · `attempt_no = 1` se admite aunque `max_attempts` sea null: la semántica
  //     canónica es "null ⇒ 1 intento" (core/assignmentRules.js) y hay tareas
  //     antiguas sin el campo — sin esta rama la regla bloquearía al alumno
  //     legítimo, que es el otro modo de fallar.
  //   · Alias `:asg` = un solo join: las tres condiciones se evalúan sobre la
  //     MISMA fila de la tarea (sin alias podrían cumplirse en filas distintas).
  // LÍMITE conocido: el `user_id` es anónimo y el alumno puede rotarlo (borrar
  // el almacenamiento, incógnito) → el tope es por IDENTIDAD, no por persona.
  // Cerrar eso exige identidad de alumno (PIN/NFC, docs/handoff-acceso-docente.md).
  assignment_attempts: {
    listRule: '', viewRule: '',
    createRule: ATTEMPT_CREATE,
    updateRule: null, deleteRule: null,
  },

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
  // 🔐 CLAVES DE LA IA — la colección MÁS CERRADA del proyecto: las CINCO reglas
  // a `null` (solo superadmin, ni siquiera un profe con sesión). Una clave de
  // Gemini o Grok cuesta dinero y sirve fuera de AulaReto, así que no puede
  // llegar a ningún navegador que no sea el del dueño al escribirla. Quien la
  // usa es el hook de la Pi (`pb_hooks/aulareto.pb.js`), y el código de servidor
  // se salta las reglas — por eso puede leerla sin abrirle la puerta a nadie.
  ia_config: {
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
  },
  // Contador de uso de la IA: cada fila es una generación. El profe puede CREAR
  // la suya (el hook la escribe en su nombre) y ver las suyas para saber cuánto
  // le queda; no puede ver las de nadie más ni borrar ninguna — si pudiera
  // borrarlas, el tope diario no sería un tope.
  ia_usos: {
    listRule: 'profe = @request.auth.id',
    viewRule: 'profe = @request.auth.id',
    createRule: null, updateRule: null, deleteRule: null,
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
// Los nombres van como SÍMBOLO para que otros módulos declaren "escribo aquí"
// SIN repetir el literal (ley de datos §21: el nombre de una colección vive en
// su dueño; core/modes.js hace `writes: LIVE_SESSIONS`).
export const LIVE_SESSIONS = 'live_sessions';
export const ASSIGNMENTS = 'assignments';
export const HOST_ONLY_WRITES = [LIVE_SESSIONS, ASSIGNMENTS];
