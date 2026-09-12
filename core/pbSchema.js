// EL ESQUEMA DE POCKETBASE, COMO DATO — qué colecciones existen, con qué campos
// y con qué índices. Y el cálculo puro de QUÉ LE FALTA a una que ya existe.
//
// Aquí NO se habla con ningún servidor (eso es `core/pbProvision.js`) ni se
// pinta nada (eso es `views/admin/collections.js`). Era un literal enterrado
// dentro del handler del botón «Crear colecciones», y por eso el test que lo
// cruza con `tools/check-pb.sh` tenía que RASPARLO con `indexOf` en vez de
// leerlo; ahora se importa.
//
// Las REGLAS de acceso no viven aquí: fuente única en `core/pbRules.js` (§22).
import { QUOTAS } from './quotas.js';

/**
 * Un campo tal como lo DECLARA el DEFS (lo que queremos que haya).
 * @typedef {{name: string, type: string, required?: boolean, maxSize?: number,
 *   onCreate?: boolean, onUpdate?: boolean}} CampoDef
 */
/**
 * Una colección declarada: nombre, campos e índices SQL (append-only).
 * @typedef {{name: string, fields: CampoDef[], indexes?: string[]}} ColeccionDef
 */

/**
 * EL ESQUEMA, COMO DATO. Orden significativo: `live_claims` va ANTES que
 * `live_answers` porque la regla de aquélla hace join a ésta y PocketBase VALIDA
 * las reglas al guardarlas — con el orden invertido, aplicar en un servidor sin
 * `live_claims` fallaba con "Failed to update collection" (pasó en la Pi).
 * @type {ColeccionDef[]}
 */
export const DEFS = [
  { name: 'activities', fields: [
    // El tope REAL de una actividad (§25) — lo aplica PocketBase.
    { name: 'data',       type: 'json', maxSize: QUOTAS.activityBytes },
    { name: 'visibility', type: 'text' },
    { name: 'tags',       type: 'json' },
    { name: 'language',   type: 'text' },
    { name: 'owner',      type: 'text' },   // id del profe dueño (Fase 1 seguridad PB)
  ]},
  { name: 'results', fields: [
    { name: 'activity_id', type: 'text' },
    { name: 'session_id',  type: 'text' },
    { name: 'user_id',     type: 'text' },
    { name: 'player_name', type: 'text' },
    { name: 'score_auto',  type: 'number' },
    { name: 'score_final', type: 'number' },
    { name: 'max_score',   type: 'number' },
    { name: 'time_used',   type: 'number' },
    { name: 'overrides',   type: 'json' },
    // Deuda D (R1) — clave de idempotencia: el índice único PARCIAL
    // (qid != '') deja en paz las filas antiguas y convierte el reintento
    // tras un ACK perdido en 400 = "ya guardado".
    { name: 'qid',         type: 'text' },
  ], indexes: ["CREATE UNIQUE INDEX `idx_results_qid` ON `results` (`qid`) WHERE `qid` != ''"] },
  { name: 'live_sessions', fields: [
    { name: 'code',     type: 'text', required: true },
    { name: 'activity', type: 'json' },
    { name: 'state',    type: 'json' },
    // `ql` FUERA del blob a propósito (ley de confianza §22): es lo único
    // que un alumno escribe en la sala (pedir la palabra en Pregunta en
    // Vivo). Al tener campo propio, la regla puede dejar `state` —fase,
    // ítem, deadline, puntajes— como HOST-ONLY.
    { name: 'ql',       type: 'json' },
  ]},
  // §22-4 — credencial del dispositivo del alumno (secreto). CERRADA por API:
  // solo se escribe al entrar y solo la consultan las reglas por join.
  // ANTES que live_answers a propósito: la regla de live_answers hace join a
  // esta colección y PocketBase VALIDA las reglas al guardarlas — con el
  // orden invertido, aplicar en un servidor sin live_claims fallaba con
  // "Failed to update collection" (pasó en la Pi).
  { name: 'live_claims', fields: [
    { name: 'session', type: 'text', required: true },
    { name: 'player',  type: 'text', required: true },
    { name: 'secret',  type: 'text', required: true },
  ], indexes: ['CREATE UNIQUE INDEX `idx_lc_session_player` ON `live_claims` (`session`, `player`)'] },
  // §22-2 — contenido COMPLETO de la sala (host-only). La sala guarda el
  // snapshot saneado; la clave, aquí.
  { name: 'live_keys', fields: [
    { name: 'session',  type: 'text', required: true },
    { name: 'activity', type: 'json' },
  ], indexes: ['CREATE UNIQUE INDEX `idx_lk_session` ON `live_keys` (`session`)'] },
  // One record per student answer → concurrent answers never clobber each
  // other (the lost-update fix). Once this exists, the realtime adapter
  // routes answers here instead of the live_sessions.state blob.
  { name: 'live_answers', fields: [
    { name: 'session', type: 'text', required: true },
    { name: 'player',  type: 'text', required: true },
    { name: 'item',    type: 'number' },
    { name: 'value',   type: 'json' },
    { name: 'ms',      type: 'number' },
    { name: 'scored',  type: 'bool' },
    { name: 'correct', type: 'bool' },
    { name: 'points',  type: 'number' },
    { name: 'unscorable', type: 'bool' },   // deuda C: liquidada pero sin clave (no puntuable)
    { name: 'v0',      type: 'json' },   // primer intento en carrera (analítica)
    { name: 'c0',      type: 'bool' },   // ¿el primer intento fue correcto?
  ], indexes: ['CREATE UNIQUE INDEX `idx_la_session_player_item` ON `live_answers` (`session`, `player`, `item`)'] },
  // One record per player (deuda A: lost-update del join). Un CREATE nunca
  // pisa a otro → 30 alumnos entrando a la vez ya no se clobbean en el blob.
  // playerId = id de la FILA. Índice único (session,name) → apodos únicos
  // ATÓMICOS (el 400 de colisión dispara el retry "Juan 2"). Ver
  // docs/historico/handoff-deuda-a.md.
  { name: 'live_players', fields: [
    { name: 'session', type: 'text', required: true },
    { name: 'name',    type: 'text', required: true },
    { name: 'user_id', type: 'text' },
  ], indexes: ['CREATE UNIQUE INDEX `idx_lp_session_name` ON `live_players` (`session`, `name`)'] },
  { name: 'assignments', fields: [
    { name: 'code',          type: 'text', required: true },
    { name: 'activity_id',   type: 'text' },
    { name: 'activity_snap', type: 'json' },
    { name: 'author_id',     type: 'text' },
    { name: 'title',         type: 'text' },
    { name: 'due_at',        type: 'text' },
    { name: 'max_attempts',  type: 'number' },
    { name: 'status',        type: 'text' },
    { name: 'created_at',    type: 'text' },
  ]},
  { name: 'assignment_attempts', fields: [
    { name: 'assignment_id', type: 'text' },
    { name: 'activity_id',   type: 'text' },
    { name: 'user_id',       type: 'text' },
    { name: 'player_name',   type: 'text' },
    { name: 'score_auto',    type: 'number' },
    { name: 'score_final',   type: 'number' },
    { name: 'max_score',     type: 'number' },
    { name: 'time_used',     type: 'number' },
    { name: 'answers',       type: 'json' },   // detalle por ítem (analítica F3)
    { name: 'attempt_no',    type: 'number' },  // §22-3: nº de intento, lo acota la regla
    { name: 'qid',           type: 'text' },    // deuda D (R1): idempotencia del reintento
    { name: 'created_at',    type: 'text' },
  ], indexes: ['CREATE UNIQUE INDEX `idx_aa_asg_user_no` ON `assignment_attempts` (`assignment_id`, `user_id`, `attempt_no`)',
               "CREATE UNIQUE INDEX `idx_aa_qid` ON `assignment_attempts` (`qid`) WHERE `qid` != ''"] },
  // ❤ Likes de la biblioteca pública (S2): una fila por (actividad, profe).
  { name: 'activity_likes', fields: [
    { name: 'activity', type: 'text', required: true },
    { name: 'user',     type: 'text', required: true },
  ], indexes: ['CREATE UNIQUE INDEX `idx_like_act_user` ON `activity_likes` (`activity`, `user`)'] },
  // 🚩 Reportes de contenido (S3): un profe reporta; solo el admin los ve/borra.
  { name: 'reports', fields: [
    { name: 'activity', type: 'text', required: true },
    { name: 'by',       type: 'text' },
    { name: 'reason',   type: 'text' },
  ]},
  // 👤 Perfil PÚBLICO del profe (colegio, frase, avatar): separado de `users`
  // (privada por el email). Lectura pública; escritura solo del dueño. Una fila
  // por profe (id de fila = id de usuario). Ver core/profile.js.
  { name: 'profiles', fields: [
    { name: 'owner',  type: 'text', required: true },
    { name: 'name',   type: 'text' },
    { name: 'school', type: 'text' },
    { name: 'bio',    type: 'text' },
    { name: 'avatar', type: 'text' },
    { name: 'banner', type: 'text' },   // portada estilo Facebook (data-URL o vacío)
  ], indexes: ['CREATE UNIQUE INDEX `idx_profile_owner` ON `profiles` (`owner`)'] },
  // 🔐 La clave de la IA. Reglas a null (solo superadmin) en core/pbRules.js:
  // quien la LEE es el hook de la Pi, que al ser código de servidor se
  // salta las reglas. Ver docs/handoff-ia-contenido.md.
  { name: 'ia_config', fields: [
    { name: 'proveedor', type: 'text' },
    { name: 'clave',     type: 'text' },
    // Varias claves conviven: `etiqueta` para reconocerlas de un vistazo
    // («la del cole», «la mía») y `activa` para jubilar una sin borrarla
    // —probar una nueva sin perder la que funciona—. Una fila antigua no
    // tiene `activa`, y el hook la cuenta como encendida a propósito:
    // estrenar esto no puede apagar lo que ya iba bien.
    { name: 'etiqueta',  type: 'text' },
    { name: 'activa',    type: 'bool' },
  ]},
  // Una fila por generación: es el tope diario por profe (§25 aplicado a
  // la IA — el coste lo paga el dueño y una clase no puede vaciarle la cuota).
  { name: 'ia_usos', fields: [
    { name: 'profe',  type: 'text', required: true },
    { name: 'dia',    type: 'text', required: true },
    { name: 'modelo', type: 'text' },
  ], indexes: ['CREATE INDEX `idx_ia_usos` ON `ia_usos` (`profe`, `dia`)'] },
];

/** Los nombres declarados, en orden. @returns {string[]} */
export const nombresDeColecciones = () => DEFS.map(d => d.name);

// ── QUÉ CAMPOS LE FALTAN A UNA COLECCIÓN QUE YA EXISTE (append-only) ─────────
//
// La regla que encierra, y que costó un fallo real:
//   · `created`/`updated` en PocketBase <0.23 son campos de SISTEMA — declararlos
//     revienta la actualización de la colección.
//   · En ≥0.23 son campos normales `autodate`. Una colección creada ANTES de que
//     los declaráramos se quedaba SIN ELLOS para siempre, porque la reparación
//     los excluía igual que en <0.23. Eso dejó a `live_sessions` de la Pi sin
//     `updated`, y sin ese dato el sello de apertura (§22-1) NI SE INTENTABA:
//     el tiempo de la carrera caía al que afirma el móvil, en silencio absoluto.
//     Lo cazó el botón «Probar carrera» del panel.

/**
 * `actuales` son los campos que HOY tiene la colección; `deseados` los que el
 * DEFS declara; `isV23`, si PocketBase es 0.23 o mayor (allí created/updated son
 * campos y no se tocan).
 * @param {{actuales?: {name?: string}[], deseados?: {name?: string}[], isV23?: boolean}} [o]
 * @returns {{name?: string}[]} los que faltan, en el orden del DEFS (nunca `id`)
 */
export function camposQueFaltan({ actuales = [], deseados = [], isV23 = false } = {}) {
  const hay = new Set((actuales || []).map(f => f?.name));
  const nuncaTocar = isV23 ? ['id'] : ['id', 'created', 'updated'];
  return (deseados || []).filter(f => f?.name && !hay.has(f.name) && !nuncaTocar.includes(f.name));
}
