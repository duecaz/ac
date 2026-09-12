// APLICAR EL ESQUEMA A UN POCKETBASE — una cosa: coger lo declarado
// (`core/pbSchema.js` DEFS + `core/pbRules.js` reglas) y dejar el servidor así,
// append-only, contando lo que pasó colección a colección.
//
// No pinta nada: devuelve una línea de resultado por colección y va avisando del
// progreso por callback, para que la vista (`views/admin/collections.js`) se
// quede solo con la pantalla. Vivía entero dentro del handler del botón.
//
// `fetch` se INYECTA, así que esto se puede probar sin red ni navegador.
//
// §21 — no escribe DATOS de ninguna colección: toca la API de ADMINISTRACIÓN
// (`/api/collections`), que es otra cosa que ser el dueño de una colección.
import { DEFS } from './pbSchema.js';
import { camposQueFaltan } from './pbSchema.js';
import { rulesFor as pbRulesFor } from './pbRules.js';
import { mensajeDe } from './frontera.js';

/**
 * Un campo tal como viaja a PocketBase: plano en ≥0.23, dentro de `options` en
 * <0.23, más la marca interna `__declara` (que nunca sale de aquí).
 * @typedef {{name: string, type: string, __declara?: string[], options?: Record<string, unknown>} & Record<string, unknown>} CampoPB
 */
/**
 * El cuerpo de una colección para la API de PocketBase. La clave del esquema es
 * `fields` (≥0.23) o `schema` (<0.23) — por eso las dos son opcionales.
 * @typedef {{name: string, type: string, fields?: CampoPB[], schema?: CampoPB[], indexes?: string[],
 *   listRule?: string|null, viewRule?: string|null, createRule?: string|null,
 *   updateRule?: string|null, deleteRule?: string|null}} ColPB
 */
/**
 * Lo que se PATCHea a una colección que ya existe: reglas y, si falta algo, el
 * esquema y los índices. Nunca `name`/`type` (no se renombra nada).
 * @typedef {{fields?: CampoPB[], schema?: CampoPB[], indexes?: string[],
 *   listRule?: string|null, viewRule?: string|null, createRule?: string|null,
 *   updateRule?: string|null, deleteRule?: string|null}} CuerpoPatch
 */
/**
 * Una línea del parte: qué colección, si salió bien y qué se hizo.
 * @typedef {{name: string, ok: boolean, msg: string}} ResultadoColeccion
 */
/** @typedef {typeof fetch} Fetch */

/** @param {string} sql @returns {string} */
const idxName = (sql) => (String(sql).match(/INDEX\s+[`"']?(\w+)[`"']?/i) || [])[1] || sql;

// "Failed to update collection" a secas no dice QUÉ regla rebotó — PB manda el
// detalle por campo en `data` (p.ej. createRule: "unknown collection..."):
// aplanarlo al mensaje fue lo que faltó para diagnosticar el fallo de orden
// live_answers→live_claims en la Pi.
/** @param {{message?: unknown, data?: unknown}} b @param {number} status @returns {string} */
function pbErrDetail(b, status) {
  /** @type {string[]} */
  const parts = [];
  const datos = (b?.data && typeof b.data === 'object') ? /** @type {Record<string, unknown>} */ (b.data) : {};
  for (const [field, err] of Object.entries(datos)) {
    const detalle = (err && typeof err === 'object' && 'message' in err) ? err.message : null;
    parts.push(`${field}: ${detalle || JSON.stringify(err)}`);
  }
  return [b?.message || `error ${status}`, ...parts].join(' · ');
}

// `__declara` es marca INTERNA (qué atributos declara el DEFS, para no reportar
// desvíos de lo que rellenamos por defecto). Nunca viaja a PocketBase.
/** @param {Record<string, unknown>} f @returns {Record<string, unknown>} */
const sinMarca = (f) => { const { __declara, ...limpio } = f; return limpio; };

/**
 * AUTENTICARSE COMO SUPERADMIN. La API cambió en PB 0.23:
 *   ≥0.23 → /api/collections/_superusers/auth-with-password
 *   <0.23 → /api/admins/auth-with-password
 * Se prueba la nueva primero; si da 404, se cae a la antigua. Devuelve además
 * QUÉ versión respondió, porque de eso depende la clave del esquema.
 * @param {{pbUrl: string, email: string, pass: string, fetchFn?: Fetch}} o
 * @returns {Promise<{token: string, isV23: boolean}>}
 */
async function autenticarAdminPb({ pbUrl, email, pass, fetchFn = fetch }) {
  /** @param {string} url @returns {Promise<string|null>} */
  const tryAuth = async (url) => {
    const r = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password: pass }),
    });
    if (r.ok) {
      /** @type {{token?: unknown}} */
      const d = await r.json();
      return String(d?.token ?? '');
    }
    if (r.status === 404) return null; // endpoint inexistente en esta versión
    /** @type {{message?: unknown}} */
    const b = await r.json().catch(() => ({}));
    throw new Error(String(b.message || `Error de autenticación (${r.status})`));
  };
  let isV23 = true;
  let token = await tryAuth(`${pbUrl}/api/collections/_superusers/auth-with-password`);
  if (!token) { isV23 = false; token = await tryAuth(`${pbUrl}/api/admins/auth-with-password`); }
  if (!token) throw new Error('No se pudo autenticar: el endpoint de admin no existe en ninguna versión conocida. Revisa la URL de PocketBase.');
  return { token, isV23 };
}

/**
 * LOS CUERPOS que se le mandan a PocketBase, derivados del DEFS declarado + las
 * reglas de `core/pbRules.js`. Puro: mismo DEFS y misma versión, mismo cuerpo.
 * @param {{isV23: boolean, defs?: import('./pbSchema.js').ColeccionDef[]}} o
 * @returns {{colecciones: ColPB[], schemaKey: 'fields'|'schema'}}
 */
function cuerposDeColecciones({ isV23, defs = DEFS }) {
  // En PB ≥0.23 la clave del esquema es `fields`; en <0.23 es `schema`. Los
  // campos json necesitan maxSize explícito en 0.23 vía API.
  /** @type {'fields'|'schema'} */
  const schemaKey = isV23 ? 'fields' : 'schema';
  /** @param {import('./pbSchema.js').CampoDef} f @returns {CampoPB} */
  const buildField = (f) => {
    // `__declara` = los atributos que el DEFS pone EXPLÍCITAMENTE. Los que se
    // rellenan aquí por defecto (required:false, el maxSize holgado de los json
    // que no son `activities.data`) NO son una decisión nuestra, así que no
    // pueden reportarse como "desvío" del servidor: la primera verificación real
    // gritó tres falsas alarmas (tags/overrides con maxSize 0, que en PocketBase
    // significa «sin tope explícito») junto a la única de verdad. Un aviso que
    // grita en falso entrena a ignorar los de verdad — la misma lección del
    // bloque de deuda del CLAUDE.md.
    /** @type {CampoPB} */
    const base = { name: f.name, type: f.type, required: !!f.required, __declara: Object.keys(f) };
    if (f.type === 'json') {
      // §25 CAPACIDAD: el tope de UNA actividad lo aplica el SERVIDOR aquí
      // (maxSize del campo `data`), y el número sale de core/quotas.js — no se
      // escribe a mano en el esquema. El resto de campos json (copias de la
      // actividad en salas y tareas) deben poder ALBERGAR una actividad al
      // máximo, así que van holgados.
      const max = (f.maxSize != null) ? f.maxSize : 5242880;
      if (isV23) base.maxSize = max;
      else base.options = { maxSize: max };
    }
    return base;
  };
  // REGLAS: fuente única en core/pbRules.js (ley de confianza §22). Antes vivían
  // escritas a mano aquí Y en tools/setup-pocketbase.ps1, y divergieron; ahora
  // las dos las leen del módulo y tests/pbRules.test.mjs falla si se separan.
  /** @param {string} name */
  const rulesFor = (name) => pbRulesFor(name) || { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' };
  // En PB ≥0.23 los campos created/updated NO se añaden solos al crear por API,
  // y el store ordena resultados por `sort=-created` → hay que crearlos como
  // autodate. En <0.23 se añaden automáticamente, así que no los duplicamos.
  /** @type {CampoPB[]} */
  const sysFields = isV23 ? [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ] : [];
  const colecciones = defs.map(d => /** @type {ColPB} */ ({
    name: d.name, type: 'base',
    [schemaKey]: [...d.fields.map(buildField), ...sysFields],
    ...(d.indexes ? { indexes: d.indexes } : {}),
    ...rulesFor(d.name),
  }));
  return { colecciones, schemaKey };
}

/**
 * APLICAR EL ESQUEMA. Autentica, y para cada colección: si no existe, la crea;
 * si existe, actualiza reglas y AÑADE lo que falte (nunca borra), corrige los
 * atributos DECLARADOS que derivaron y RELEE el servidor para decir lo que HAY,
 * no lo que se intentó.
 *
 * @param {{pbUrl: string, email: string, pass: string, fetchFn?: Fetch,
 *   onProgreso?: (nombre: string) => void,
 *   defs?: import('./pbSchema.js').ColeccionDef[]}} o
 * @returns {Promise<ResultadoColeccion[]>}
 */
export async function aplicarEsquemaPb({ pbUrl, email, pass, fetchFn = fetch, onProgreso = () => {}, defs = DEFS }) {
  const { token, isV23 } = await autenticarAdminPb({ pbUrl, email, pass, fetchFn });
  const headers = { 'Content-Type': 'application/json', 'Authorization': token };
  const { colecciones, schemaKey } = cuerposDeColecciones({ isV23, defs });

  /** Busca la colección por nombre y devuelve su id o null. @param {string} name @returns {Promise<string|null>} */
  async function findCollection(name) {
    try {
      const r = await fetchFn(`${pbUrl}/api/collections/${name}`, { headers });
      if (!r.ok) return null;
      /** @type {{id?: unknown}} */
      const d = await r.json();
      return d?.id == null ? null : String(d.id);
    } catch { return null; }
  }

  /** @type {ResultadoColeccion[]} */
  const resultados = [];
  for (const col of colecciones) {
    onProgreso(col.name);
    try {
      const existingId = await findCollection(col.name);
      if (!existingId) {
        // No existe → crear completa.
        const cr = await fetchFn(`${pbUrl}/api/collections`, {
          method: 'POST', headers,
          body: JSON.stringify({ ...col, [schemaKey]: (col[schemaKey] || []).map(sinMarca) }),
        });
        if (cr.ok) resultados.push({ name: col.name, ok: true, msg: 'creada' });
        else {
          /** @type {{message?: unknown, data?: unknown}} */
          const b = await cr.json().catch(() => ({}));
          resultados.push({ name: col.name, ok: false, msg: pbErrDetail(b, cr.status) });
        }
        continue;
      }
      const parte = await repararColeccion({ pbUrl, headers, fetchFn, schemaKey, col, existingId });
      resultados.push(parte);
    } catch (e) {
      resultados.push({ name: col.name, ok: false, msg: mensajeDe(e) });
    }
  }
  return resultados;
}

/**
 * UNA COLECCIÓN QUE YA EXISTE: reglas + lo que falte + los atributos declarados
 * que derivaron, y después la relectura que verifica lo aplicado.
 * @param {{pbUrl: string, headers: Record<string, string>, fetchFn: Fetch,
 *   schemaKey: 'fields'|'schema', col: ColPB, existingId: string}} o
 * @returns {Promise<ResultadoColeccion>}
 */
async function repararColeccion({ pbUrl, headers, fetchFn, schemaKey, col, existingId }) {
  // Colección ya existe: actualiza reglas Y AÑADE los campos que falten
  // (append-only: nunca borra columnas existentes). Antes solo añadía
  // `activities.owner`; ahora cubre cualquier campo nuevo del DEF (p.ej.
  // `assignment_attempts.answers`, `live_answers.v0/c0`) → un update de la app no
  // exige recrear colecciones a mano.
  /** @type {CuerpoPatch} */
  const patchBody = { ...pbRulesFor(col.name) || { listRule: '', viewRule: '', createRule: '', updateRule: '', deleteRule: '' } };
  /** @type {(string|undefined)[]} */
  let addedFields = [];
  /** @type {string[]} */
  let addedIdx = [];
  /** @type {string[]} */
  const fixedAttrs = [];
  try {
    const cur = await (await fetchFn(`${pbUrl}/api/collections/${existingId}`, { headers })).json();
    const curFields = /** @type {CampoPB[]} */ (cur[schemaKey] || cur.fields || cur.schema || []);
    // Qué falta = `camposQueFaltan` (puro y testeado): ahí vive el porqué de que
    // `created`/`updated` sí se reparen en PB ≥0.23.
    const missing = camposQueFaltan({ actuales: curFields, deseados: col[schemaKey] || [], isV23: schemaKey === 'fields' });
    if (missing.length) {
      patchBody[schemaKey] = /** @type {CampoPB[]} */ ([...curFields, ...missing.map(sinMarca)]);
      addedFields = missing.map(f => f.name);
    }
    // ATRIBUTOS DECLARADOS que derivaron (p.ej. `activities.data.maxSize` en 0 =
    // sin tope, cuando §25 exige 2097152). Hasta v1.51.425 esto solo se
    // REPORTABA («AJUSTAR A MANO»): cambiar un atributo en una Pi compartida era
    // decisión del dueño. El dueño la tomó (2026-08-09: «establécelo de una
    // vez»), así que ahora se CORRIGE — solo atributos que el DEFS declara
    // explícitamente (__declara), nunca los rellenos por defecto, y sin tocar
    // campos de otras colecciones/proyectos. Subir o fijar maxSize no reescribe
    // filas: PocketBase lo aplica en las escrituras siguientes.
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
          // El valor DESEADO puede vivir plano (PB ≥0.23) o en `options` (<0.23,
          // buildField lo mete ahí) — mirar ambos, o en la rama vieja se
          // "corregía" a undefined (lo cazó la sonda de esa misma versión).
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
    // Índices que FALTAN (append-only). Sin esto, un índice nuevo (p.ej. el
    // ÚNICO (session,player,item) de la deuda F, o (session,name) de la deuda A)
    // NUNCA se crea si la colección ya existía → el fix no aplica. Deduplicamos
    // por NOMBRE; nunca quitamos los que ya hay.
    const curIdx = /** @type {string[]} */ (cur.indexes || []);
    const curIdxNames = new Set(curIdx.map(idxName));
    const missingIdx = (col.indexes || []).filter(sql => !curIdxNames.has(idxName(sql)));
    if (missingIdx.length) {
      patchBody.indexes = [...curIdx, ...missingIdx];
      addedIdx = missingIdx.map(idxName);
    }
  } catch (readErr) {
    // ANTES este catch callaba y "reglas actualizadas" mentía por omisión (así se
    // aplicó un esquema sin `qid` en producción sin que nadie lo viera). Si no se
    // pudo leer el esquema actual, se DICE.
    return { name: col.name, ok: false, msg: `no se pudo LEER el esquema para el diff de campos (${mensajeDe(readErr)}) — solo se aplicarían reglas; reintenta` };
  }

  const pr = await fetchFn(`${pbUrl}/api/collections/${existingId}`, {
    method: 'PATCH', headers, body: JSON.stringify(patchBody),
  });
  if (!pr.ok) {
    /** @type {{message?: unknown, data?: unknown}} */
    const b = await pr.json().catch(() => ({}));
    return { name: col.name, ok: false, msg: pbErrDetail(b, pr.status) };
  }
  const extras = [...addedFields.map(f => `campo ${f}`), ...addedIdx.map(i => `índice ${i}`),
                  ...fixedAttrs.map(a => `atributo ${a}`)];
  const verificado = await verificarColeccion({ pbUrl, headers, fetchFn, schemaKey, col, existingId });
  if (verificado.falta) return { name: col.name, ok: false, msg: verificado.falta };
  return {
    name: col.name, ok: true,
    msg: (extras.length ? `reglas + ${extras.join(', ')} (ya existía)` : 'reglas actualizadas (ya existía)') + verificado.nota,
  };
}

/**
 * VERIFICACIÓN post-aplicación: se RELEE el servidor y se compara contra el DEF.
 * La salida deja de ser "lo que intenté" y pasa a ser "lo que HAY" — un campo
 * que falte se dice con nombre, nunca más un ✓ con esquema incompleto.
 * @param {{pbUrl: string, headers: Record<string, string>, fetchFn: Fetch,
 *   schemaKey: 'fields'|'schema', col: ColPB, existingId: string}} o
 * @returns {Promise<{falta: string, nota: string}>}
 */
async function verificarColeccion({ pbUrl, headers, fetchFn, schemaKey, col, existingId }) {
  try {
    const post = await (await fetchFn(`${pbUrl}/api/collections/${existingId}`, { headers })).json();
    const postFields = /** @type {CampoPB[]} */ (post[schemaKey] || post.fields || []);
    const haveF = new Set(postFields.map(f => f.name));
    const wantF = (col[schemaKey] || []).map(f => f.name).filter(n => !['id', 'created', 'updated'].includes(n));
    const lackF = wantF.filter(n => !haveF.has(n));
    const haveI = new Set(/** @type {string[]} */ (post.indexes || []).map(idxName));
    const lackI = (col.indexes || []).map(idxName).filter(n => !haveI.has(n));
    if (lackF.length || lackI.length) {
      return { falta: `reglas OK pero el servidor QUEDÓ SIN: ${[...lackF.map(f => 'campo ' + f), ...lackI.map(i => 'índice ' + i)].join(', ')}`, nota: '' };
    }
    // DERIVA DE ATRIBUTOS (R6 · fallar en silencio está prohibido). La rama "ya
    // existía" añade campos e índices que falten POR NOMBRE; los atributos que NO
    // declara el DEFS no se tocan, así que si el servidor tiene otro valor se
    // DICE, con el que hay que poner.
    /** @type {string[]} */
    const desvíos = [];
    for (const want of (col[schemaKey] || [])) {
      const have = postFields.find(f => f.name === want.name);
      if (!have) continue;
      const declarados = want.__declara || [];
      for (const [k, v] of Object.entries(want)) {
        if (k === 'name' || k === 'type' || k === '__declara' || v === undefined) continue;
        // Solo lo que el DEFS DECLARA (ver buildField): comparar los rellenos por
        // defecto convierte el aviso en ruido.
        if (!declarados.includes(k)) continue;
        const actual = have[k] ?? (have.options || {})[k];
        if (actual !== undefined && String(actual) !== String(v)) {
          desvíos.push(`${want.name}.${k}: el servidor tiene ${actual}, debería ser ${v}`);
        }
      }
    }
    let nota = ` · verificado: ${wantF.length} campos`;
    if (desvíos.length) nota += ` · ⚠ AJUSTAR A MANO en pb: ${desvíos.join(' · ')}`;
    return { falta: '', nota };
  } catch { return { falta: '', nota: ' · (sin verificar: relectura falló)' }; }
}
