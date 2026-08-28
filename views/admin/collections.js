// v1.51.629: adminView se partió POR PANEL (cirugía mapeada en CLAUDE.md,
// corte 3/4 de la deuda condicionada). Esta sección es «PocketBase —
// configuración de colecciones»: crea/actualiza TODAS las colecciones y sus
// reglas de acceso (botón «Crear colecciones»). Fábrica: la html() se monta
// dentro del contenedor de #/admin y wire(rootSel) cablea el botón.
import { escapeHtml } from '../../core/html.js';
import { on } from '../../core/events.js';
import { VERSION } from '../../core/constants.js';
import { QUOTAS } from '../../core/quotas.js';
import { rulesFor as pbRulesFor } from '../../core/pbRules.js';
import { camposQueFaltan } from '../../core/pbSchema.js';   // qué reparar de una colección que ya existe

export function createCollectionsSection() {
  return {
    html: () => `
      <h5 class="mt-4">PocketBase — configuración de colecciones</h5>
      <p class="small text-muted mb-2">Crea/actualiza TODAS las colecciones (activities, live_sessions, <code>live_players</code>, live_answers, assignments, results…) y aplica sus reglas de acceso. Append-only: añade lo que falte sin borrar datos. Re-córrelo tras cada actualización que toque el esquema (p.ej. reglas endurecidas). Necesita tu superadmin de PocketBase.</p>
      <div class="d-flex gap-2 align-items-end flex-wrap mb-1">
        <div>
          <label class="form-label small mb-1">Email admin PocketBase</label>
          <input id="pb-email" type="email" class="form-control form-control-sm" placeholder="admin@ejemplo.com" style="width:220px">
        </div>
        <div>
          <label class="form-label small mb-1">Contraseña admin</label>
          <input id="pb-pass" type="password" class="form-control form-control-sm" style="width:180px">
        </div>
        <button id="pb-setup" class="btn btn-warning btn-sm"><i class="bi bi-database-add"></i> Crear colecciones</button>
      </div>
      <div id="pb-setup-out" class="mt-2"></div>`,
    wire: (rootSel) => {
      on(rootSel, 'click', '#pb-setup', async () => {
        const email = document.getElementById('pb-email')?.value?.trim();
        const pass  = document.getElementById('pb-pass')?.value;
        const out   = document.getElementById('pb-setup-out');
        if (!email || !pass) { out.innerHTML = '<div class="alert alert-warning py-1 px-2 small">Introduce email y contraseña de admin de PocketBase.</div>'; return; }

        out.innerHTML = '<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Autenticando…</div>';
        const btn = document.getElementById('pb-setup');
        btn.disabled = true;

        try {
          // 1. Authenticate as PocketBase admin. La API cambió en PB 0.23:
          //    ≥0.23 → /api/collections/_superusers/auth-with-password
          //    <0.23 → /api/admins/auth-with-password
          //    Probamos la nueva primero; si da 404 caemos a la antigua.
          const { PB_URL } = await import('../../pocketbase.config.js');
          const tryAuth = async (url) => {
            const r = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identity: email, password: pass }),
            });
            if (r.ok) return (await r.json()).token;
            if (r.status === 404) return null; // endpoint inexistente en esta versión
            const b = await r.json().catch(() => ({}));
            throw new Error(b.message || `Error de autenticación (${r.status})`);
          };
          let isV23 = true;
          let token = await tryAuth(`${PB_URL}/api/collections/_superusers/auth-with-password`);
          if (!token) { isV23 = false; token = await tryAuth(`${PB_URL}/api/admins/auth-with-password`); }
          if (!token) throw new Error('No se pudo autenticar: el endpoint de admin no existe en ninguna versión conocida. Revisa la URL de PocketBase.');
          const headers = { 'Content-Type': 'application/json', 'Authorization': token };

          // 2. Definición de campos por colección (neutra respecto a la versión).
          const DEFS = [
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

          // En PB ≥0.23 la clave del esquema es `fields`; en <0.23 es `schema`. Los
          // campos json necesitan maxSize explícito en 0.23 vía API.
          const schemaKey = isV23 ? 'fields' : 'schema';
          const buildField = (f) => {
            // `__declara` = los atributos que el DEFS pone EXPLÍCITAMENTE. Los que
            // se rellenan aquí por defecto (required:false, el maxSize holgado de
            // los json que no son `activities.data`) NO son una decisión nuestra,
            // así que no pueden reportarse como "desvío" del servidor: la primera
            // verificación real gritó tres falsas alarmas (tags/overrides con
            // maxSize 0, que en PocketBase significa «sin tope explícito») junto a
            // la única de verdad. Un aviso que grita en falso entrena a ignorar los
            // de verdad — la misma lección del bloque de deuda del CLAUDE.md.
            const base = { name: f.name, type: f.type, required: !!f.required, __declara: Object.keys(f) };
            if (f.type === 'json') {
              // §25 CAPACIDAD: el tope de UNA actividad lo aplica el SERVIDOR aquí
              // (maxSize del campo `data`), y el número sale de core/quotas.js — no
              // se escribe a mano en el esquema. El resto de campos json (copias de
              // la actividad en salas y tareas) deben poder ALBERGAR una actividad
              // al máximo, así que van holgados.
              const max = (f.maxSize != null) ? f.maxSize : 5242880;
              if (isV23) base.maxSize = max;
              else base.options = { maxSize: max };
            }
            return base;
          };
          // REGLAS: fuente única en core/pbRules.js (ley de confianza §22). Antes
          // vivían escritas a mano aquí Y en tools/setup-pocketbase.ps1, y
          // divergieron; ahora las dos las leen del módulo y tests/pbRules.test.mjs
          // falla si se vuelven a separar.
          const rulesFor = (name) => pbRulesFor(name) || { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };
          // En PB ≥0.23 los campos created/updated NO se añaden solos al crear por API,
          // y el store ordena resultados por `sort=-created` → hay que crearlos como
          // autodate. En <0.23 se añaden automáticamente, así que no los duplicamos.
          const sysFields = isV23 ? [
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ] : [];
          // "Failed to update collection" a secas no dice QUÉ regla rebotó — PB manda
          // el detalle por campo en `data` (p.ej. createRule: "unknown collection...").
          // Aplanarlo al mensaje fue lo que faltó para diagnosticar el fallo de orden
          // live_answers→live_claims en la Pi.
          const pbErrDetail = (b, status) => {
            const parts = [];
            for (const [field, err] of Object.entries(b?.data || {})) {
              parts.push(`${field}: ${err?.message || JSON.stringify(err)}`);
            }
            return [b?.message || `error ${status}`, ...parts].join(' · ');
          };
          // `__declara` es marca INTERNA (qué atributos declara el DEFS, para no
          // reportar desvíos de lo que rellenamos por defecto). Nunca viaja a
          // PocketBase: el cuerpo de la petición se limpia aquí.
          const sinMarca = (f) => { const { __declara, ...limpio } = f; return limpio; };
          const COLLECTIONS = DEFS.map(d => ({
            name: d.name, type: 'base',
            [schemaKey]: [...d.fields.map(buildField), ...sysFields],
            ...(d.indexes ? { indexes: d.indexes } : {}),
            ...rulesFor(d.name),
          }));

          // Función auxiliar: busca la colección por nombre y devuelve su id o null.
          async function findCollection(name) {
            try {
              const r = await fetch(`${PB_URL}/api/collections/${name}`, { headers });
              if (r.ok) return (await r.json()).id;
              return null;
            } catch { return null; }
          }

          // 3. Para cada colección: si no existe → crear; si ya existe → solo
          //    actualizar las reglas de acceso (sin tocar campos ni datos).
          const results = [];
          for (const col of COLLECTIONS) {
            out.innerHTML = `<div class="text-muted small"><span class="spinner-border spinner-border-sm me-1"></span>Configurando <code>${col.name}</code>…</div>`;
            try {
              const existingId = await findCollection(col.name);
              if (existingId) {
                // Colección ya existe: actualiza reglas Y AÑADE los campos que falten
                // (append-only: nunca borra columnas existentes). Antes solo añadía
                // `activities.owner`; ahora cubre cualquier campo nuevo del DEF (p.ej.
                // `assignment_attempts.answers`, `live_answers.v0/c0`) → un update de la
                // app no exige recrear colecciones a mano.
                const patchBody = { ...rulesFor(col.name) };
                let addedFields = [], addedIdx = [], fixedAttrs = [];
                try {
                  const cur = await (await fetch(`${PB_URL}/api/collections/${existingId}`, { headers })).json();
                  const curFields = cur[schemaKey] || cur.fields || cur.schema || [];
                  // Qué falta = core/pbSchema.js (puro y testeado): ahí vive el
                  // porqué de que `created`/`updated` sí se reparen en PB ≥0.23.
                  const missing = camposQueFaltan({ actuales: curFields, deseados: col[schemaKey] || [], isV23 });
                  if (missing.length) {
                    patchBody[schemaKey] = [...curFields, ...missing.map(sinMarca)];
                    addedFields = missing.map(f => f.name);
                  }
                  // Índices que FALTAN (append-only). Sin esto, un índice nuevo (p.ej.
                  // el ÚNICO (session,player,item) de la deuda F, o (session,name) de la
                  // deuda A) NUNCA se crea si la colección ya existía → el fix no aplica.
                  // Deduplicamos por NOMBRE; nunca quitamos los que ya hay.
                  // ATRIBUTOS DECLARADOS que derivaron (p.ej. `activities.data.maxSize`
                  // en 0 = sin tope, cuando §25 exige 2097152). Hasta v1.51.425 esto
                  // solo se REPORTABA («AJUSTAR A MANO»): cambiar un atributo en una
                  // Pi compartida era decisión del dueño. El dueño la tomó
                  // (2026-08-09: «establécelo de una vez»), así que ahora se CORRIGE
                  // — solo atributos que el DEFS declara explícitamente (__declara),
                  // nunca los rellenos por defecto, y sin tocar campos de otras
                  // colecciones/proyectos. Subir o fijar maxSize no reescribe filas:
                  // PocketBase lo aplica en las escrituras siguientes.
                  {
                    const base = patchBody[schemaKey] ? [...patchBody[schemaKey]] : [...curFields];
                    let cambió = false;
                    for (const want of (col[schemaKey] || [])) {
                      const declarados = (want.__declara || []).filter(k => !['name', 'type'].includes(k));
                      if (!declarados.length) continue;
                      const i = base.findIndex(f => f.name === want.name);
                      if (i < 0) continue;
                      for (const k of declarados) {
                        const actual = base[i][k] ?? (base[i].options || {})[k];
                        // El valor DESEADO puede vivir plano (PB ≥0.23) o en
                        // `options` (<0.23, buildField lo mete ahí) — mirar ambos,
                        // o en la rama vieja se "corregía" a undefined (lo cazó la
                        // sonda de esta misma versión).
                        const deseado = want[k] ?? (want.options || {})[k];
                        if (actual !== undefined && deseado !== undefined && String(actual) !== String(deseado)) {
                          base[i] = { ...base[i], [k]: deseado };
                          if (base[i].options && k in base[i].options) base[i].options = { ...base[i].options, [k]: deseado };
                          fixedAttrs.push(`${want.name}.${k}: ${actual} → ${deseado}`);
                          cambió = true;
                        }
                      }
                    }
                    if (cambió) patchBody[schemaKey] = base;
                  }
                  const idxName = (sql) => (String(sql).match(/INDEX\s+[`"']?(\w+)[`"']?/i) || [])[1] || sql;
                  const curIdx = cur.indexes || [];
                  const curIdxNames = new Set(curIdx.map(idxName));
                  const missingIdx = (col.indexes || []).filter(sql => !curIdxNames.has(idxName(sql)));
                  if (missingIdx.length) {
                    patchBody.indexes = [...curIdx, ...missingIdx];
                    addedIdx = missingIdx.map(idxName);
                  }
                } catch (readErr) {
                  // ANTES este catch callaba y "reglas actualizadas" mentía por
                  // omisión (así se aplicó un esquema sin `qid` en producción sin que
                  // nadie lo viera). Si no se pudo leer el esquema actual, se DICE.
                  results.push({ name: col.name, ok: false, msg: `no se pudo LEER el esquema para el diff de campos (${readErr?.message || readErr}) — solo se aplicarían reglas; reintenta` });
                  continue;
                }
                const pr = await fetch(`${PB_URL}/api/collections/${existingId}`, {
                  method: 'PATCH', headers,
                  body: JSON.stringify(patchBody),
                });
                if (pr.ok) {
                  const extras = [...addedFields.map(f => `campo ${f}`), ...addedIdx.map(i => `índice ${i}`),
                                  ...fixedAttrs.map(a => `atributo ${a}`)];
                  // VERIFICACIÓN post-aplicación: se RELEE el servidor y se compara
                  // contra el DEF. La salida deja de ser "lo que intenté" y pasa a ser
                  // "lo que HAY" — un campo que falte se dice con nombre, nunca más un
                  // ✓ con esquema incompleto.
                  let verify = '';
                  try {
                    const post = await (await fetch(`${PB_URL}/api/collections/${existingId}`, { headers })).json();
                    const haveF = new Set((post[schemaKey] || post.fields || []).map(f => f.name));
                    const wantF = (col[schemaKey] || []).map(f => f.name).filter(n => !['id','created','updated'].includes(n));
                    const lackF = wantF.filter(n => !haveF.has(n));
                    const idxName = (sql) => (String(sql).match(/INDEX\s+[\`"']?(\w+)[\`"']?/i) || [])[1] || sql;
                    const haveI = new Set((post.indexes || []).map(idxName));
                    const lackI = (col.indexes || []).map(idxName).filter(n => !haveI.has(n));
                    if (lackF.length || lackI.length) {
                      results.push({ name: col.name, ok: false, msg: `reglas OK pero el servidor QUEDÓ SIN: ${[...lackF.map(f => 'campo ' + f), ...lackI.map(i => 'índice ' + i)].join(', ')}` });
                      continue;
                    }
                    // DERIVA DE ATRIBUTOS (R6 · fallar en silencio está prohibido).
                    // La rama "ya existía" es APPEND-ONLY: añade campos e índices que
                    // falten POR NOMBRE, pero nunca toca los atributos de un campo que
                    // ya está. Eso dejó un agujero mudo: cuando el tope de una
                    // actividad bajó de 5 MB a 2 MB (§25, v1.51.340), el `maxSize` de
                    // `activities.data` se quedó en 5 MB en la Pi y ni el panel ni
                    // `check-pb.sh` lo miraban — el límite de §25 era solo un aviso del
                    // cliente. NO se auto-corrige a propósito: cambiar el atributo de
                    // un campo con datos dentro, en una Pi COMPARTIDA con otros
                    // proyectos, es una decisión del dueño. Se DICE, con el valor
                    // exacto que hay que poner.
                    const desvíos = [];
                    for (const want of (col[schemaKey] || [])) {
                      const have = (post[schemaKey] || post.fields || []).find(f => f.name === want.name);
                      if (!have) continue;
                      const declarados = want.__declara || [];
                      for (const [k, v] of Object.entries(want)) {
                        if (k === 'name' || k === 'type' || k === '__declara' || v === undefined) continue;
                        // Solo lo que el DEFS DECLARA (ver buildField): comparar los
                        // rellenos por defecto convierte el aviso en ruido.
                        if (!declarados.includes(k)) continue;
                        const actual = have[k] ?? (have.options || {})[k];
                        if (actual !== undefined && String(actual) !== String(v)) {
                          desvíos.push(`${want.name}.${k}: el servidor tiene ${actual}, debería ser ${v}`);
                        }
                      }
                    }
                    verify = ` · verificado: ${wantF.length} campos`;
                    if (desvíos.length) verify += ` · ⚠ AJUSTAR A MANO en pb: ${desvíos.join(' · ')}`;
                  } catch { verify = ' · (sin verificar: relectura falló)'; }
                  results.push({ name: col.name, ok: true, msg: (extras.length ? `reglas + ${extras.join(', ')} (ya existía)` : 'reglas actualizadas (ya existía)') + verify });
                } else {
                  const b = await pr.json().catch(() => ({}));
                  results.push({ name: col.name, ok: false, msg: pbErrDetail(b, pr.status) });
                }
              } else {
                // No existe → crear completa.
                const cr = await fetch(`${PB_URL}/api/collections`, {
                  method: 'POST', headers,
                  body: JSON.stringify({ ...col, [schemaKey]: (col[schemaKey] || []).map(sinMarca) }),
                });
                if (cr.ok) {
                  results.push({ name: col.name, ok: true, msg: 'creada' });
                } else {
                  const b = await cr.json().catch(() => ({}));
                  results.push({ name: col.name, ok: false, msg: pbErrDetail(b, cr.status) });
                }
              }
            } catch (e) {
              results.push({ name: col.name, ok: false, msg: e.message });
            }
          }

          const allOk = results.every(r => r.ok);
          out.innerHTML = `
            <div class="alert ${allOk ? 'alert-success' : 'alert-warning'} py-2 px-3 small">
              <div class="text-muted">Aplicado con la app v${VERSION} — si acabas de actualizar, recarga con Ctrl+F5 ANTES de aplicar (una página cacheada aplica DEFS viejos).</div>
              ${results.map(r => `<div>${r.ok ? '✓' : '✗'} <code>${r.name}</code> — ${escapeHtml(r.msg)}</div>`).join('')}
              ${allOk ? '<div class="mt-1 fw-semibold">Listo. Recarga la página para activar Live, actividades en nube y tareas.</div>' : ''}
            </div>`;
        } catch (e) {
          out.innerHTML = `<div class="alert alert-danger py-1 px-2 small">Error: ${escapeHtml(e.message)}</div>`;
        } finally {
          btn.disabled = false;
          document.getElementById('pb-pass').value = '';
        }
      });
    },
  };
}
