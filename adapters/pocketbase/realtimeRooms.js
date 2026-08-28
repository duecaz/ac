// LA FILA DE `live_sessions` — load/save del estado, los mapeos de Pregunta en
// Vivo (`qlOf`/`qlPatch`), el sello de apertura de ítem (`noteItemOpened`), los
// patches de sala (`setSessionState`) y el par `fullActivity`/`keyCache` que
// trae la actividad COMPLETA desde `live_keys` (host-only, §22-2). También el
// roster de `live_players` (deuda A) y la entrada a la sala (`joinSession`):
// viven aquí porque su colección gira alrededor de la fila de la sala, igual
// que el resto de este fichero.
import { createLiveRoom } from '../../kernel/live/engine.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { pickWord } from '../../core/liveWords.js';
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';
import { openedKey } from '../../core/serverMs.js';
import { studentSnapshot, needsClientKey } from '../../core/liveSnapshot.js';

// §22-1 — ¿este PATCH del host ABRIÓ un ítem a respuestas? Si sí, sella el
// instante SERVIDOR de la apertura (`rec.updated`, autodate de PocketBase) en el
// blob host-only, para que después el tiempo de cada respuesta se mida con el
// reloj del servidor y no con el del móvil. Devuelve true si el sello es nuevo
// (y por tanto hay que persistirlo). En CARRERA todos los ítems se abren a la
// vez → un solo sello 'race'.
function noteItemOpened(engine, patch, rec) {
  const iso = rec?.updated;
  const phase = patch?.phase;
  if (!iso || (phase !== 'question' && phase !== 'race')) return false;
  const idx = ('current_item' in patch) ? Number(patch.current_item) : engine.state.currentItem;
  const key = openedKey(phase, idx);
  const map = engine.state.itemOpenedAt || (engine.state.itemOpenedAt = {});
  if (map[key] === iso) return false;
  map[key] = iso;
  return true;
}

// PREGUNTA EN VIVO — el "pedir la palabra" del alumno vive en el campo `ql`,
// FUERA del blob `state` (ley de confianza §22): así la regla de PocketBase
// puede dejar `state` (fase, ítem, deadline, puntajes) como HOST-ONLY y el
// alumno solo escribe este campo. Los PUNTOS otorgados (`qlPoints`) siguen en
// el blob porque los da el docente. Se lee con respaldo al blob para que una
// sala creada ANTES de esta versión siga funcionando.
function qlOf(rec) {
  const q = rec?.ql || {};
  const s = rec?.state || {};
  return {
    ql_open: q.open ?? s.qlOpen ?? null,
    ql_question: q.question ?? s.qlQuestion ?? null,
    ql_image: q.image ?? s.qlImage ?? null,
    ql_by: q.by ?? s.qlBy ?? null,
    ql_by_name: q.byName ?? s.qlByName ?? null,
    ql_points: s.qlPoints ?? {},
    ql_taken: s.qlTaken ?? {},
  };
}
// Claves `ql_*` de un patch → forma del campo `ql`. Devuelve null si el patch
// no toca nada de Pregunta en Vivo (para no escribir el campo en vano).
function qlPatch(patch) {
  const MAP = { ql_open: 'open', ql_question: 'question', ql_image: 'image', ql_by: 'by', ql_by_name: 'byName' };
  const out = {};
  let touched = false;
  for (const [k, v] of Object.entries(MAP)) if (k in patch) { out[v] = patch[k] ?? null; touched = true; }
  return touched ? out : null;
}

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
 */
export function createRoomsSection({ pbFetch, COLL, KEY, PLR, ANS, userId, answersReady, playersReady, registerClaim, claimSecret, postAnswer, getAnswerRow, settlePendingInto }) {
  // Load a session record and rebuild the engine over its persisted state.
  // §22-2 — la sala guarda un snapshot SIN clave; el contenido completo vive en
  // `live_keys` (host-only). El motor del HOST necesita la clave para puntuar, así
  // que la trae de ahí. Caché por sala: el contenido no cambia durante la partida,
  // así un settle no paga una lectura extra por ítem. Respaldo a `rec.activity`
  // para las salas creadas ANTES de esta versión (y para el alumno, que no puede
  // leer live_keys: ahí el motor no puntúa, solo hidrata).
  const keyCache = new Map();
  async function fullActivity(sessionId, rec) {
    if (keyCache.has(sessionId)) return keyCache.get(sessionId);
    let full = null;
    try {
      const res = await pbFetch(`/api/collections/${KEY}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}'`)}&perPage=1`);
      full = res?.items?.[0]?.activity || null;
    } catch { /* sin sesión de profe, o colección no creada aún */ }
    const act = full || rec?.activity || null;
    keyCache.set(sessionId, act);
    return act;
  }

  async function load(sessionId) {
    const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
    if (!rec) throw new Error('Sala no encontrada');
    const engine = createLiveRoom(await fullActivity(sessionId, rec), { state: rec.state, code: rec.code });
    return { rec, engine };
  }

  async function saveState(sessionId, engine) {
    await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: engine.state }),
    });
  }

  const plrFilter = (sessionId, extra) =>
    pbFilterParam([`session='${pbEscape(sessionId)}'`, ...(extra ? [extra] : [])].join(' && '));

  // Jugadores de una sala desde live_players (deuda A). Standalone (no método)
  // para que lo compartan listPlayers y el leaderboard derivado sin depender del
  // binding de `this`.
  async function fetchPlayers(sessionId) {
    const res = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(sessionId)}&perPage=200`);
    return (res?.items || []).map(r => ({ id: r.id, name: r.name, userId: r.user_id, score: 0 }));
  }

  return {
    async createRoom(activity) {
      // Fetch currently active codes so pickWord avoids duplicates. On any
      // network failure or uniqueness collision we retry once with another word.
      let usedCodes = new Set();
      try {
        const res = await pbFetch(`/api/collections/${COLL}/records?fields=code&perPage=200`);
        for (const rec of res?.items || []) usedCodes.add(rec.code);
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
          const rec = await pbFetch(`/api/collections/${COLL}/records`, {
            method: 'POST',
            body: JSON.stringify({ code, activity: studentSnapshot(activity), state: engine.state }),
          });
          // La clave. Si esta escritura falla, la sala se queda SIN clave para el
          // host → mejor decirlo aquí que descubrirlo al revelar la primera
          // respuesta, así que se propaga el error (la sala se reintenta).
          try {
            await pbFetch(`/api/collections/${KEY}/records`, {
              method: 'POST', body: JSON.stringify({ session: rec.id, activity }),
            });
          } catch (ke) {
            if (ke?.status === 404) {
              throw new Error('La colección "live_keys" no existe en el servidor. '
                + 'Créala una sola vez en Admin → "Crear colecciones" (guarda el contenido de la sala sin exponerlo a los alumnos).');
            }
            throw ke;
          }
          keyCache.set(rec.id, activity);
          return { id: rec.id, code };
        } catch (e) {
          if (e.status === 404) {
            throw new Error('La colección "live_sessions" no existe en el servidor. '
              + 'Créala una sola vez en Admin → "Crear colecciones".');
          }
          // El código recién intentado falló (colisión de índice único o blip):
          // recuérdalo para no re-elegirlo en el siguiente intento.
          usedCodes.add(code);
          // Retry on PIN collision (400/409) AND on transient failures (network
          // error → no status, 5xx, timeout) — a momentary blip shouldn't kill
          // room creation outright.
          const retryable = !e.status || e.status === 400 || e.status === 409 || e.status >= 500;
          if (attempt < 4 && retryable) continue;
          throw e;
        }
      }
      // All attempts exhausted (persistent collisions / validation): fail loudly
      // so the caller shows a clear message instead of crashing on undefined.id.
      throw new Error('No se pudo crear la sala tras varios intentos. Revisa la conexión e inténtalo de nuevo.');
    },

    async findRoomByCode(code) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=${pbFilterParam(`code='${pbEscape(code.toUpperCase())}'`)}`
      );
      const rec = res?.items?.[0];
      if (!rec) return null;
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
        activity_snap: rec.activity,
        ...qlOf(rec),
      };
    },

    async fetchSession(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      if (!rec) throw new Error('Sala no encontrada');
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
        ...qlOf(rec),
      };
    },

    // La actividad COMPLETA (con la clave) para el HOST: vive en `live_keys`, que
    // solo lee una sesión de profe (§22-2). Respaldo a la sala para las creadas
    // antes de esta versión.
    async fetchSessionKey(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`).catch(() => null);
      return await fullActivity(sessionId, rec);
    },

    // ── INFORMES (ley de datos §21) ──────────────────────────────────────────
    // `views/reports.js` consultaba la colección por su cuenta (y además rompía
    // el seam local|pb: en dev sin PocketBase no había informes). Ahora se lo
    // PIDE al dueño. Devuelve las filas crudas (id, code, activity, state) y el
    // informe se queda con el parseo, que es cosa suya.
    async listSessions({ limit = 500 } = {}) {
      // `sort=-created` puede no existir según cómo se creara la colección: si
      // falla, se reintenta sin orden en vez de dejar la vista vacía.
      try {
        const res = await pbFetch(`/api/collections/${COLL}/records?perPage=${Number(limit) || 500}&sort=-created`);
        return res?.items || [];
      } catch {
        const res = await pbFetch(`/api/collections/${COLL}/records?perPage=${Number(limit) || 500}`);
        return res?.items || [];
      }
    },

    /** Fila cruda de UNA sala (informe de sesión). null si no existe. */
    async fetchSessionRecord(sessionId) {
      try { return await pbFetch(`/api/collections/${COLL}/records/${sessionId}`); }
      catch (e) { if (e?.status === 404) return null; throw e; }
    },

    // Respaldo del informe post-partida (A1): el blob `state` entero, para
    // rescatar respuestas legadas que no llegaron a live_answers. Solo lo
    // consume el HOST (rowsFromLiveState); existe para que ninguna vista tenga
    // que tocar la colección directamente (ley de datos).
    async fetchSessionBlob(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      return rec?.state || {};
    },

    async joinSession(code, nickname) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=${pbFilterParam(`code='${pbEscape(code.toUpperCase())}'`)}`
      );
      const rec = res?.items?.[0];
      if (!rec) throw new Error('Sala no encontrada');
      if (rec.state?.status === 'ended') throw new Error('La sala ha terminado');
      const live = rec.activity?.live || {};
      if (rec.state?.status !== 'lobby' && live.allowLateJoin === false) throw new Error('La partida ya empezó');

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
        const mine = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(rec.id, `user_id='${pbEscape(userId)}'`)}&perPage=1`);
        if (mine?.items?.length && claimSecret(rec.id)) {
          const row = mine.items[0];
          return { sessionId: rec.id, playerId: row.id, name: row.name };
        }
        const maxPlayers = live.maxPlayers || 60;
        const cnt = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(rec.id)}&perPage=1`);
        if ((cnt?.totalItems || 0) >= maxPlayers) throw new Error('La sala está llena');
        let name = f.value;
        for (let n = 2; ; n++) {
          try {
            const row = await pbFetch(`/api/collections/${PLR}/records`, {
              method: 'POST', body: JSON.stringify({ session: rec.id, name, user_id: userId }),
            });
            // Credencial de ESTE dispositivo para ESTE jugador, antes de devolver:
            // sin ella las respuestas rebotarían (§22-4).
            await registerClaim(rec.id, row.id);
            return { sessionId: rec.id, playerId: row.id, name: row.name };
          } catch (e) {
            // 400 del índice único (session,name) = apodo ocupado → sufija y reintenta.
            if (e?.status === 400 && n <= 40) { name = `${f.value} ${n}`; continue; }
            throw e;
          }
        }
      }

      // Ruta blob heredada (sin la colección): comportamiento anterior.
      const engine = createLiveRoom(rec.activity, { state: rec.state, code: rec.code });
      const p = engine.join(userId, nickname);
      await saveState(rec.id, engine);
      return { sessionId: rec.id, playerId: p.id, name: p.name };
    },

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

    async setSessionState(sessionId, patch) {
      const { engine } = await load(sessionId);
      if (patch.status !== undefined) engine.state.status = patch.status;
      if (patch.phase !== undefined) engine.state.phase = patch.phase;
      if ('current_item' in patch) engine.state.currentItem = patch.current_item;
      if ('deadline' in patch) engine.state.deadline = patch.deadline ?? null;
      // R-1 · instante en que se pueden TOCAR las respuestas (§26 ficha 1b): el
      // ritmo del juego se escribe como INSTANTE en la sala, nunca como un
      // temporizador local — así todos los móviles leen lo mismo y quien entra
      // tarde o recarga ve el tiempo que queda de verdad.
      if ('answers_open_at' in patch) engine.state.answersOpenAt = patch.answers_open_at ?? null;
      if ('read_secs' in patch) engine.state.readSecs = patch.read_secs ?? null;
      // POLÍTICA DE FIN de carrera/tablero (core/liveEnd.js): vive en la sala
      // porque el ALUMNO también la necesita — es lo que le dice si espera un
      // reloj o a sus compañeros, en vez de un "esperando…" mudo.
      // EL BUCLE que corrió la sala (§26). Vive en el blob porque es un HECHO de
      // la partida, no un detalle de una vista: lo leen el settle (modelo de
      // puntos), el podio y la tabla. Antes cada uno lo re-adivinaba de la fase
      // o del sello de apertura, y el lobby lo perdía al recargar.
      if ('loop' in patch) engine.state.loop = patch.loop ?? null;
      if ('end_policy' in patch) engine.state.endPolicy = patch.end_policy ?? null;
      if ('end_n' in patch) engine.state.endN = patch.end_n ?? null;
      if ('started_at' in patch) engine.state.startedAt = patch.started_at ?? null;
      if ('ql_points' in patch) engine.state.qlPoints = patch.ql_points ?? {};
      // CL-1 · quién se llevó cada caja. Se guardaba CUÁNTO valió, no QUIÉN
      // respondió, así que el docente no tenía forma de ver a quién le faltaba
      // participar (y los rápidos acaparaban sin que se notara).
      if ('ql_taken' in patch) engine.state.qlTaken = patch.ql_taken ?? {};
      if (patch.ql_award) {
        const { playerId, points } = patch.ql_award;
        const p = engine.state.players.find(pl => pl.id === playerId);
        if (p) p.score += points;
      }
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
        const row = {
          session: sessionId, player: playerId, item: Number(item),
          value: null, ms: 0, scored: true, correct: false, unscorable: true,
          points: Number(points) || 0,
        };
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
      const ql = qlPatch(patch);
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
