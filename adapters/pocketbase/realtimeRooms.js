// LA FILA DE `live_sessions` — load/save del estado, los mapeos de Pregunta en
// Vivo (`qlOf`), el sello de apertura de ítem (`noteItemOpened`), los
// patches de sala (`setSessionState`) y el par `fullActivity`/`keyCache` que
// trae la actividad COMPLETA desde `live_keys` (host-only, §22-2). También el
// roster de `live_players` (deuda A) y la entrada a la sala (`joinSession`):
// viven aquí porque su colección gira alrededor de la fila de la sala, igual
// que el resto de este fichero.
import { createLiveRoom } from '../../kernel/live/engine.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { pickWord } from '../../core/liveWords.js';
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';
import { studentSnapshot, needsClientKey } from '../../core/liveSnapshot.js';
import { aplicarParcheDeSala, itemDelParche, parcheDePalabra, sellarApertura } from '../../kernel/session/roomPatch.js';
import { blobDeSala, esFila, estadoDeSala, estadoPb, fila, filas, mapaNumeros, mapaTextos, numero, numeroOnulo, texto, textoOnulo } from '../frontera.js';
import { pbListar } from './listar.js';

/**
 * @typedef {import('../frontera.js').PbFetch} PbFetch
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/session.js').LiveEngine} LiveEngine
 * @typedef {import('../../kernel/contracts/session.js').LiveRoom} LiveRoom
 * @typedef {import('../../kernel/contracts/session.js').Player} Player
 * @typedef {import('../../kernel/contracts/session.js').RoomPatch} RoomPatch
 * @typedef {import('../../kernel/contracts/session.js').RoomRecord} RoomRecord
 * @typedef {import('./realtimeAnswers.js').FilaRespuesta} FilaRespuesta
 * @typedef {import('./realtimeAnswers.js').NuevaRespuesta} NuevaRespuesta
 * @typedef {import('../frontera.js').BlobSala} BlobSala
 */

/**
 * CARGAR UNA SALA: la fila cruda más el motor ya hidratado sobre su blob. Lo
 * comparten las otras tres secciones (§21b: el dueño de `live_sessions` es
 * esta), por eso el tipo vive aquí y no en cada consumidor.
 * @typedef {(sessionId: string) => Promise<{rec: Record<string, unknown>, engine: LiveEngine}>} CargaSala
 */

/**
 * GUARDAR el blob del motor en la fila de la sala.
 * @typedef {(sessionId: string, engine: LiveEngine) => Promise<void>} GuardaEstado
 */

/** Lo que las vistas leen de la sala, sin la parte de «pedir la palabra». */
/**
 * @typedef {Object} Palabra
 * @property {number|null} ql_open
 * @property {string|null} ql_question
 * @property {string|null} ql_image
 * @property {string|null} ql_by
 * @property {string|null} ql_by_name
 * @property {Record<string, number>} ql_points
 * @property {Record<string, string>} ql_taken
 */

// §22-1 — ¿este PATCH del host ABRIÓ un ítem a respuestas? Si sí, sella el
// instante SERVIDOR de la apertura (`rec.updated`, autodate de PocketBase) en el
// blob host-only, para que después el tiempo de cada respuesta se mida con el
// reloj del servidor y no con el del móvil. Devuelve true si el sello es nuevo
// (y por tanto hay que persistirlo). El SELLADO en sí lo hace el kernel
// (`sellarApertura`, compartido con el driver local); aquí vive solo de dónde
// sale el instante: el autodate que acaba de devolver el servidor, que por eso
// PISA al anterior.
/** @param {LiveEngine} engine @param {RoomPatch} patch @param {unknown} rec @returns {boolean} */
function noteItemOpened(engine, patch, rec) {
  const s = blobDeSala(engine);
  return sellarApertura(s, patch?.phase, itemDelParche(patch, s), textoOnulo(fila(rec).updated), { pisar: true });
}

// PREGUNTA EN VIVO — el "pedir la palabra" del alumno vive en el campo `ql`,
// FUERA del blob `state` (ley de confianza §22): así la regla de PocketBase
// puede dejar `state` (fase, ítem, deadline, puntajes) como HOST-ONLY y el
// alumno solo escribe este campo. Los PUNTOS otorgados (`qlPoints`) siguen en
// el blob porque los da el docente. Se lee con respaldo al blob para que una
// sala creada ANTES de esta versión siga funcionando.
/** @param {unknown} rec @returns {Palabra} */
function qlOf(rec) {
  const q = fila(fila(rec).ql);
  const s = fila(fila(rec).state);
  return {
    ql_open: numeroOnulo(q.open) ?? numeroOnulo(s.qlOpen),
    ql_question: textoOnulo(q.question) ?? textoOnulo(s.qlQuestion),
    ql_image: textoOnulo(q.image) ?? textoOnulo(s.qlImage),
    ql_by: textoOnulo(q.by) ?? textoOnulo(s.qlBy),
    ql_by_name: textoOnulo(q.byName) ?? textoOnulo(s.qlByName),
    ql_points: mapaNumeros(s.qlPoints),
    ql_taken: mapaTextos(s.qlTaken),
  };
}
/** La actividad que viene en una fila. No se valida campo a campo: la migración
 *  y el contrato son de `core/storage.js`, no del transporte.
 *  @param {unknown} x @returns {Activity|null} */
const actividadDe = (x) => (esFila(x) ? /** @type {Activity} */ (x) : null);

/** LA FILA DE LA SALA con su blob YA estrechado.
 *  @param {Record<string, unknown>} f
 *  @returns {{id: string, code: string, activity: Activity|null, state: Partial<BlobSala>}} */
const conBlob = (f) => ({
  id: texto(f.id), code: texto(f.code),
  activity: actividadDe(f.activity), state: estadoDeSala(f.state),
});

/** LA SALA QUE LEEN LAS VISTAS, construida desde la fila cruda. Es la ÚNICA
 *  traducción fila→`LiveRoom`: las DOS lecturas (`findRoomByCode`, por PIN, y
 *  `fetchSession`, por id) la tenían tecleada entera cada una y ya habían
 *  divergido — a la del PIN le faltaba `started_at`, así que el cronómetro de
 *  quien entraba por PIN a una carrera arrancaba en 0 hasta el primer refresco.
 *  @param {Record<string, unknown>} bruta @returns {LiveRoom} */
function salaDesde(bruta) {
  const rec = conBlob(bruta);
  return {
    id: rec.id,
    code: rec.code,
    status: rec.state?.status,
    phase: rec.state?.phase,
    current_item: rec.state?.currentItem,
    deadline: rec.state?.deadline ?? null,
    answers_open_at: rec.state?.answersOpenAt ?? null,
    read_secs: rec.state?.readSecs ?? null,
    loop: rec.state?.loop ?? null,
    end_policy: rec.state?.endPolicy ?? null,
    end_n: rec.state?.endN ?? null,
    started_at: rec.state?.startedAt ?? null,
    activity_snap: rec.activity,
    ...qlOf(bruta),
  };
}

/** La fila CRUDA de la sala para los informes: se entrega tal cual (el parseo
 *  es de quien la pide), solo con su forma declarada.
 *  @param {Record<string, unknown>} rec @returns {RoomRecord} */
const filaDeSala = (rec) => /** @type {RoomRecord} */ (rec);

/**
 * Fábrica de la sección de salas. `deps`:
 *   - pbFetch: cliente HTTP con reintentos.
 *   - COLL, KEY, PLR, ANS: nombres de las colecciones `live_sessions`/`live_keys`/
 *     `live_players`/`live_answers` (esta última solo para el PATCH puntual del
 *     ql_award reabierto — el resto de `live_answers` lo posee la sección answers).
 *   - userId: identidad de ESTE dispositivo (para el roster y la reconexión).
 *   - answersReady()/playersReady(): ¿existen las colecciones respectivas?
 *   - registerClaim/claimSecret: credencial del dispositivo (sección claims).
 *   - postAnswer/getAnswerRow/settlePendingInto: escritura/lectura de `live_answers`
 *     (sección answers) — las necesita `setSessionState` (ql_award) y `endSession`.
 * @param {{ pbFetch: PbFetch, COLL: string, KEY: string, PLR: string, ANS: string, userId: string,
 *   answersReady: () => Promise<boolean>, playersReady: () => Promise<boolean>,
 *   registerClaim: (sessionId: string, playerId: string) => Promise<string|null>,
 *   claimSecret: (sessionId: string) => string|null,
 *   postAnswer: (body: NuevaRespuesta) => Promise<{created?: boolean, conflict?: boolean}>,
 *   getAnswerRow: (sessionId: string, itemIndex: number, playerId: string) => Promise<FilaRespuesta|null>,
 *   settlePendingInto: (engine: LiveEngine, sessionId: string) => Promise<number> }} deps
 */
export function createRoomsSection({ pbFetch, COLL, KEY, PLR, ANS, userId, answersReady, playersReady, registerClaim, claimSecret, postAnswer, getAnswerRow, settlePendingInto }) {
  // Load a session record and rebuild the engine over its persisted state.
  // §22-2 — la sala guarda un snapshot SIN clave; el contenido completo vive en
  // `live_keys` (host-only). El motor del HOST necesita la clave para puntuar, así
  // que la trae de ahí. Caché por sala: el contenido no cambia durante la partida,
  // así un settle no paga una lectura extra por ítem. Respaldo a `rec.activity`
  // para las salas creadas ANTES de esta versión (y para el alumno, que no puede
  // leer live_keys: ahí el motor no puntúa, solo hidrata).
  /** @type {Map<string, Activity|null>} */
  const keyCache = new Map();
  /** La actividad de una sala: la COMPLETA de `live_keys` o, si no se puede, la
   *  de la propia fila. @param {string} sessionId @param {unknown} rec @returns {Promise<Activity|null>} */
  async function fullActivity(sessionId, rec) {
    const enCache = keyCache.get(sessionId);
    if (enCache !== undefined) return enCache;
    /** @type {Activity|null} */
    let full = null;
    try {
      const res = await pbFetch(`/api/collections/${KEY}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}'`)}&perPage=1`);
      full = actividadDe(filas(res)[0]?.activity);
    } catch { /* sin sesión de profe, o colección no creada aún */ }
    const act = full || actividadDe(fila(rec).activity);
    keyCache.set(sessionId, act);
    return act;
  }

  /** @type {CargaSala} */
  async function load(sessionId) {
    const res = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
    if (!esFila(res)) throw new Error('Sala no encontrada');
    const rec = res;
    // Una fila sin actividad es una sala rota: quien lo dice es el motor
    // («Plantilla desconocida»), aquí solo se le entrega lo que trajo la fila.
    const act = /** @type {Activity} */ (await fullActivity(sessionId, rec));
    const engine = createLiveRoom(act, { state: estadoDeSala(rec.state), code: texto(rec.code) });
    return { rec, engine };
  }

  /** @type {GuardaEstado} */
  async function saveState(sessionId, engine) {
    await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: engine.state }),
    });
  }

  /** @param {string} sessionId @param {string} [extra] */
  const plrFilter = (sessionId, extra) =>
    pbFilterParam([`session='${pbEscape(sessionId)}'`, ...(extra ? [extra] : [])].join(' && '));

  // Jugadores de una sala desde live_players (deuda A). Standalone (no método)
  // para que lo compartan listPlayers y el leaderboard derivado sin depender del
  // binding de `this`.
  /** @param {string} sessionId @returns {Promise<Player[]>} */
  async function fetchPlayers(sessionId) {
    const res = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(sessionId)}&perPage=200`);
    return filas(res).map(r => ({ id: texto(r.id), name: texto(r.name), userId: texto(r.user_id), score: 0 }));
  }

  return {
    /** @param {Activity} activity @returns {Promise<{id: string, code: string}>} */
    async createRoom(activity) {
      // Fetch currently active codes so pickWord avoids duplicates. On any
      // network failure or uniqueness collision we retry once with another word.
      /** @type {Set<string>} */
      const usedCodes = new Set();
      try {
        const res = await pbFetch(`/api/collections/${COLL}/records?fields=code&perPage=200`);
        for (const rec of filas(res)) usedCodes.add(texto(rec.code));
      } catch { /* proceed with empty set — collision handled by retry below */ }

      for (let attempt = 0; attempt < 5; attempt++) {
        // P2-2: SIEMPRE evitar los códigos conocidos (antes los reintentos usaban
        // un Set VACÍO, así que tras una colisión podían re-elegir un PIN en uso).
        const code = pickWord(usedCodes);
        const engine = createLiveRoom(activity, { code });
        try {
          // §22-2 — en la SALA (lectura abierta: el alumno entra por PIN) va el
          // snapshot SANEADO: payloads de ronda ya sin solución + metadatos. La
          // actividad completa se guarda aparte, en `live_keys` (host-only).
          const rec = fila(await pbFetch(`/api/collections/${COLL}/records`, {
            method: 'POST',
            body: JSON.stringify({ code, activity: studentSnapshot(activity), state: engine.state }),
          }));
          const salaId = texto(rec.id);
          // La clave. Si esta escritura falla, la sala se queda SIN clave para el
          // host → mejor decirlo aquí que descubrirlo al revelar la primera
          // respuesta, así que se propaga el error (la sala se reintenta).
          try {
            await pbFetch(`/api/collections/${KEY}/records`, {
              method: 'POST', body: JSON.stringify({ session: salaId, activity }),
            });
          } catch (ke) {
            if (estadoPb(ke) === 404) {
              throw new Error('La colección "live_keys" no existe en el servidor. '
                + 'Créala una sola vez en Admin → "Crear colecciones" (guarda el contenido de la sala sin exponerlo a los alumnos).');
            }
            throw ke;
          }
          keyCache.set(salaId, activity);
          return { id: salaId, code };
        } catch (e) {
          if (estadoPb(e) === 404) {
            throw new Error('La colección "live_sessions" no existe en el servidor. '
              + 'Créala una sola vez en Admin → "Crear colecciones".');
          }
          // El código recién intentado falló (colisión de índice único o blip):
          // recuérdalo para no re-elegirlo en el siguiente intento.
          usedCodes.add(code);
          // Retry on PIN collision (400/409) AND on transient failures (network
          // error → no status, 5xx, timeout) — a momentary blip shouldn't kill
          // room creation outright.
          const estado = estadoPb(e);
          const retryable = !estado || estado === 400 || estado === 409 || estado >= 500;
          if (attempt < 4 && retryable) continue;
          throw e;
        }
      }
      // All attempts exhausted (persistent collisions / validation): fail loudly
      // so the caller shows a clear message instead of crashing on undefined.id.
      throw new Error('No se pudo crear la sala tras varios intentos. Revisa la conexión e inténtalo de nuevo.');
    },

    /** @param {string} code @returns {Promise<LiveRoom|null>} */
    async findRoomByCode(code) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=${pbFilterParam(`code='${pbEscape(code.toUpperCase())}'`)}`
      );
      const bruta = filas(res)[0];
      if (!bruta) return null;
      return salaDesde(bruta);
    },

    /** @param {string} sessionId @returns {Promise<LiveRoom>} */
    async fetchSession(sessionId) {
      const bruta = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      if (!esFila(bruta)) throw new Error('Sala no encontrada');
      return salaDesde(bruta);
    },

    // La actividad COMPLETA (con la clave) para el HOST: vive en `live_keys`, que
    // solo lee una sesión de profe (§22-2). Respaldo a la sala para las creadas
    // antes de esta versión.
    /** @param {string} sessionId @returns {Promise<Activity|null>} */
    async fetchSessionKey(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`).catch(() => null);
      return await fullActivity(sessionId, rec);
    },

    // ── INFORMES (ley de datos §21) ──────────────────────────────────────────
    // `views/reports.js` consultaba la colección por su cuenta (y además rompía
    // el seam local|pb: en dev sin PocketBase no había informes). Ahora se lo
    // PIDE al dueño. Devuelve las filas crudas (id, code, activity, state) y el
    // informe se queda con el parseo, que es cosa suya.
    /** @param {{limit?: number}} [opts] @returns {Promise<RoomRecord[]>} */
    async listSessions({ limit = 500 } = {}) {
      // `sort=-created` puede no existir según cómo se creara la colección: si
      // falla, se lee sin orden en vez de dejar la vista vacía (`pbListar`).
      const rows = await pbListar(pbFetch,
        `/api/collections/${COLL}/records?perPage=${Number(limit) || 500}`, { sort: '-created' });
      return rows.map(filaDeSala);
    },

    /** Fila cruda de UNA sala (informe de sesión). null si no existe.
     *  @param {string} sessionId @returns {Promise<RoomRecord|null>} */
    async fetchSessionRecord(sessionId) {
      try {
        const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
        return esFila(rec) ? filaDeSala(rec) : null;
      }
      catch (e) { if (estadoPb(e) === 404) return null; throw e; }
    },

    // Respaldo del informe post-partida (A1): el blob `state` entero, para
    // rescatar respuestas legadas que no llegaron a live_answers. Solo lo
    // consume el HOST (rowsFromLiveState); existe para que ninguna vista tenga
    // que tocar la colección directamente (ley de datos).
    /** @param {string} sessionId */
    async fetchSessionBlob(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      return estadoDeSala(fila(rec).state);
    },

    /** @param {string} code @param {string} nickname
     *  @returns {Promise<{sessionId: string, playerId: string, name: string}>} */
    async joinSession(code, nickname) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=${pbFilterParam(`code='${pbEscape(code.toUpperCase())}'`)}`
      );
      const rec = filas(res)[0];
      if (!rec) throw new Error('Sala no encontrada');
      const salaId = texto(rec.id);
      const estadoSala = estadoDeSala(rec.state);
      if (estadoSala.status === 'ended') throw new Error('La sala ha terminado');
      const live = actividadDe(rec.activity)?.live || {};
      if (estadoSala.status !== 'lobby' && live.allowLateJoin === false) throw new Error('La partida ya empezó');

      // Ruta live_players (deuda A): el jugador es su PROPIA fila → dos entradas
      // simultáneas ya no se pisan en el blob. La validación del apodo y el gateo
      // de aforo se conservan; la UNICIDAD del nombre la garantiza el índice único
      // (session,name) de forma atómica: una colisión (400) reintenta con sufijo.
      if (await playersReady()) {
        const f = isAcceptableNickname(nickname);
        if (!f.ok) throw new Error('Apodo: ' + f.reason);
        // Reconexión: si este dispositivo ya tiene fila en la sala, la conserva —
        // pero SOLO si además conserva su credencial (§22-4); sin ella no podría
        // escribir respuestas, así que es mejor entrar como jugador nuevo (el
        // índice único de apodos le pondrá sufijo) que quedarse mudo.
        const mine = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(salaId, `user_id='${pbEscape(userId)}'`)}&perPage=1`);
        const mia = filas(mine)[0];
        if (mia && claimSecret(salaId)) {
          return { sessionId: salaId, playerId: texto(mia.id), name: texto(mia.name) };
        }
        const maxPlayers = live.maxPlayers || 60;
        const cnt = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(salaId)}&perPage=1`);
        if (numero(fila(cnt).totalItems) >= maxPlayers) throw new Error('La sala está llena');
        let name = f.value;
        for (let n = 2; ; n++) {
          try {
            const row = fila(await pbFetch(`/api/collections/${PLR}/records`, {
              method: 'POST', body: JSON.stringify({ session: salaId, name, user_id: userId }),
            }));
            // Credencial de ESTE dispositivo para ESTE jugador, antes de devolver:
            // sin ella las respuestas rebotarían (§22-4).
            await registerClaim(salaId, texto(row.id));
            return { sessionId: salaId, playerId: texto(row.id), name: texto(row.name) };
          } catch (e) {
            // 400 del índice único (session,name) = apodo ocupado → sufija y reintenta.
            if (estadoPb(e) === 400 && n <= 40) { name = `${f.value} ${n}`; continue; }
            throw e;
          }
        }
      }

      // Ruta blob heredada (sin la colección): comportamiento anterior.
      const engine = createLiveRoom(/** @type {Activity} */ (actividadDe(rec.activity)),
        { state: estadoSala, code: texto(rec.code) });
      const p = engine.join(userId, nickname);
      await saveState(salaId, engine);
      return { sessionId: salaId, playerId: p.id, name: p.name };
    },

    /** @param {string} sessionId */
    async startSession(sessionId) {
      const { engine } = await load(sessionId);
      engine.state.status = 'running';
      engine.state.phase = 'question';
      engine.state.currentItem = 0;
      await saveState(sessionId, engine);
    },

    // Cerrar la sala LIQUIDA lo pendiente y LUEGO marca 'ended' — todo sobre UN
    // load y UN saveState. Así ninguna respuesta rezagada (rescate del trazo,
    // cola offline, red lenta) se queda sin puntuar: llegue cuando llegue, si
    // está en la colección antes del cierre cuenta. Un fallo al liquidar NO
    // impide cerrar (la sala debe poder cerrarse siempre).
    /** @param {string} sessionId */
    async endSession(sessionId) {
      const { engine } = await load(sessionId);
      try {
        if (await answersReady()) await settlePendingInto(engine, sessionId);
        else engine.settleAll({ keepPhase: true });   // blob heredado: settle salta lo ya puntuado
      } catch (e) { console.warn('[live] no se pudieron liquidar rezagadas al cerrar:', e); }
      engine.state.status = 'ended';
      engine.state.phase = 'ended';
      await saveState(sessionId, engine);
      // Higiene §22-2: si la sala fue una carrera, su snapshot lleva el contenido
      // completo. Terminada la partida ya no hace falta → se vuelve al saneado
      // para que la clave no siga en una fila de lectura abierta.
      try {
        const full = keyCache.get(sessionId);
        if (full) await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
          method: 'PATCH', body: JSON.stringify({ activity: studentSnapshot(full) }),
        });
      } catch { /* best-effort: la sala ya está cerrada */ }
    },

    /** @param {string} sessionId @param {RoomPatch} patch */
    async setSessionState(sessionId, patch) {
      const { engine } = await load(sessionId);
      const s = blobDeSala(engine);
      // EL VOLCADO DEL PARCHE vive en el kernel (`kernel/session/roomPatch.js`),
      // compartido con el driver local: eran veinte `if ('x' in patch)` escritos
      // dos veces, y lo que se olvidaba una copia se le perdía al alumno. Aquí el
      // RITMO de la partida va DENTRO del blob (en local, en la propia sala).
      aplicarParcheDeSala(s, patch);
      // §21 · PEDIR LA PALABRA: los puntos que da el DOCENTE también son una
      // FILA de live_answers. Sin esto se quedaban SOLO en el blob y el podio
      // —que se DERIVA de live_answers desde la deuda A— mostraba 0 a todos:
      // el docente repartía puntos toda la clase y al final no los veía nadie
      // (verificado contra PocketBase real antes de arreglarlo). La fila va
      // `scored` (el veredicto ya está dado) y `unscorable` (no hubo clave que
      // acertar: el mérito es del docente, §22-5) → la tabla la pinta "—" con
      // sus puntos, sin fingir un acierto automático.
      if (patch.ql_award && Number.isInteger(patch.ql_award.item) && await answersReady()) {
        const { playerId, points, item } = patch.ql_award;
        /** @type {NuevaRespuesta} */
        const row = {
          session: sessionId, player: playerId, item: Number(item),
          value: null, ms: 0, scored: true, correct: false, unscorable: true,
          points: Number(points) || 0,
        };
        /** @type {{created?: boolean, conflict?: boolean}} */
        const r = await postAnswer(row).catch(() => ({}));
        if (r?.conflict) {
          // Misma caja reabierta y re-otorgada: se actualiza la fila existente.
          const prev = await getAnswerRow(sessionId, Number(item), playerId).catch(() => null);
          if (prev) await pbFetch(`/api/collections/${ANS}/records/${prev.id}`, {
            method: 'PATCH', body: JSON.stringify({ scored: true, correct: false, unscorable: true, points: row.points }),
          }).catch(() => {});
        }
      }
      // §22-2 — EXCEPCIÓN DECLARADA de la carrera libre: en ese modo el móvil
      // juzga cada intento en local (colorea al instante y re-encola los fallos),
      // así que necesita el contenido completo. Solo entonces, y solo al arrancar,
      // se sube la actividad entera a la sala; al cerrar se vuelve al snapshot
      // saneado. Cerrarlo del todo pide un validador en el servidor (ver
      // core/liveSnapshot.js).
      //
      // ANTES DE ABRIR LA FASE, no después: este PATCH iba DESPUÉS del de
      // `state`, así que el móvil recibía "empieza la carrera" y se ponía a
      // jugar con el snapshot SIN clave — daba por fallada hasta una hoja
      // perfecta. Primero la clave, luego la salida.
      if (needsClientKey(patch.phase)) {
        const full = await fullActivity(sessionId, null);
        if (full) await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
          method: 'PATCH', body: JSON.stringify({ activity: full }),
        }).catch(() => { /* si falla, el móvil ESPERA (no juzga a ciegas) */ });
      }

      // El host puede tocar AMBOS: el blob y el campo `ql` (p.ej. al cerrar la
      // caja abierta tras dar puntos) — un solo PATCH.
      const ql = parcheDePalabra(patch);
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify(ql ? { state: engine.state, ql } : { state: engine.state }),
      });
      // §22-1 — SELLO DE APERTURA: si este PATCH abrió un ítem a respuestas, el
      // `updated` que devuelve PocketBase ES el instante servidor de la apertura.
      // Guardarlo en el blob (host-only, el alumno no lo puede mover) es lo que
      // permite medir después el tiempo de cada respuesta con el reloj del
      // SERVIDOR. Cuesta un PATCH diminuto por pregunta —del host, no de los 30
      // alumnos— y a cambio sobrevive a que el host recargue a mitad de pregunta.
      if (noteItemOpened(engine, patch, rec)) {
        await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
          method: 'PATCH', body: JSON.stringify({ state: engine.state }),
        }).catch((e) => {
          // R6 · NO en silencio: este catch mudo es la razón de que nadie
          // supiera, durante versiones, que en la Pi el sello no entraba (lo
          // destapó el botón de carrera: los dos alumnos con el MISMO tiempo,
          // el que afirmaba su móvil). Se sigue tolerando el fallo —abrir la
          // pregunta no puede depender de esto— pero se DICE, y el settle ya
          // no depende de él (core/serverMs.js · origenServidor).
          console.warn('[live] §22-1: no se pudo guardar el sello de apertura; el tiempo se medirá desde la primera respuesta:', e);
        });
      }
    },

    // El ALUMNO pide la palabra (Pregunta en Vivo): escribe SOLO el campo `ql`,
    // nunca el blob. Es la única afirmación que un alumno hace sobre la sala
    // (ley de confianza §22) y la regla de PB lo permite justo por eso.
    /** @param {string} sessionId
     *  @param {{open?: number|null, question?: string|null, image?: string|null,
     *    by?: string|null, byName?: string|null}} claim */
    async claimQuestion(sessionId, claim) {
      await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ql: {
          open: claim?.open ?? null,
          question: claim?.question ?? null,
          image: claim?.image ?? null,
          by: claim?.by ?? null,
          byName: claim?.byName ?? null,
        } }),
      });
    },

    /** @param {string} sessionId @returns {Promise<Player[]>} */
    async listPlayers(sessionId) {
      if (await playersReady()) return fetchPlayers(sessionId);
      const { engine } = await load(sessionId);
      return engine.state.players.slice();
    },

    // Expuestos para otras secciones (answers/mantenimiento necesitan cargar y
    // guardar la sala, y el leaderboard necesita el roster).
    load,
    saveState,
    fetchPlayers,
  };
}
