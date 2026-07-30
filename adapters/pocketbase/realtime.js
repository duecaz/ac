// PocketBase RealtimePort driver.
// All live-session state lives in a single `live_sessions` PocketBase record
// (same approach as the local driver but persisted remotely). Scoring runs
// client-side in the host browser via the same kernel engine.
//
// Required PocketBase collection `live_sessions` fields:
//   code     text   (required, unique index)
//   activity json
//   state    json
// API rules: allow all (or at minimum Create/Read/Update without auth).
import { rid } from '../../core/ids.js';
import { createLiveRoom } from '../../kernel/live/engine.js';
import { isAcceptableNickname } from '../../core/nicknameFilter.js';
import { pbJson } from '../../core/pbHttp.js';
import { PB_URL } from '../../pocketbase.config.js';
import { pickWord } from '../../core/liveWords.js';
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';
import { setConnectionState } from '../../core/connection.js';
import { deriveAnswerMs, openedKey, openedAtFor } from '../../core/serverMs.js';
import { studentSnapshot, needsClientKey } from '../../core/liveSnapshot.js';
import { lsGet, lsSet } from '../../core/ls.js';

const COLL = 'live_sessions';
const ANS = 'live_answers';   // one record per student answer (lost-update fix)
const PLR = 'live_players';   // one record per player (lost-update fix del join)
const KEY = 'live_keys';      // contenido COMPLETO de la sala (host-only, §22-2)
const CLM = 'live_claims';    // credencial del dispositivo del alumno (§22-4)

function genUserId() { return rid('u_'); }

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

async function pbFetchOnce(path, opts = {}) {
  const { body: reqBody, method, headers: extra, timeoutMs = 12000 } = opts;
  // Abort a stalled socket instead of hanging forever: on flaky mobile a TCP
  // connection can open but never respond, which would leave submit/load/host
  // actions pending indefinitely (frozen UI, submitQueue never enqueues). The
  // AbortError flows into the offline queue / reconnect backoff like any failure.
  // El wrapper JSON (firma profe/anónimo + parseo + error { status, pb }) vive
  // UNA vez en core/pbHttp.js; aquí solo se le añade el timeout.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await pbJson(path, { method, body: reqBody, headers: extra, signal: ctrl.signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// Reintenta las lecturas (GET) ante fallos TRANSITORIOS — timeout, red caída, 5xx —
// que en móvil flojo tumbaban un `join`/`fetchSession` de una sola vez ("un alumno
// no entra y hay que refrescar"). Solo GET: es idempotente, reintentarlo no duplica
// nada. Las ESCRITURAS (POST/PATCH) NO se reintentan aquí (podrían pisar el blob
// `state` — deuda A); su resiliencia vive en la cola offline. Backoff 300/700ms.
async function pbFetch(path, opts = {}) {
  const attempts = (!opts.method || opts.method === 'GET') ? 3 : 1;
  for (let i = 0; ; i++) {
    try { return await pbFetchOnce(path, opts); }
    catch (e) {
      const transient = e?.timeout || e?.status === 0 || e?.status >= 500;
      if (!transient || i >= attempts - 1) throw e;
      await new Promise(res => setTimeout(res, i === 0 ? 300 : 700));
    }
  }
}

export function createPocketbaseRealtime({ userId = genUserId() } = {}) {
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

  // ── Answers in their own collection (lost-update fix) ───────────────────────
  // The lost-update bug: every student answer used to load→mutate→PATCH the
  // SINGLE live_sessions.state blob, so two students answering in the same ~1-2s
  // window clobbered each other (PATCH B overwrote A's answer; PB returned 200,
  // so the offline queue never retried → answer silently lost).
  //
  // Fix: each student CREATEs a row in `live_answers` (their own record) — a
  // CREATE never collides with another student's CREATE. The host stays the only
  // writer of the blob (scores live in state.players[]), so scoring is collision
  // free too. Activated only when the collection exists; otherwise everything
  // falls back to the legacy blob path (zero change for existing deployments).
  // "¿Existe esta colección?" — probe cacheado por adaptador. Si falta, las rutas
  // que la usan caen al blob heredado (cero cambio pre-migración). Una sola
  // implementación para live_answers (lost-update de respuestas) y live_players
  // (deuda A, lost-update del join).
  function collectionProbe(coll) {
    let cached;   // undefined = desconocido, luego true/false
    return async () => {
      if (cached !== undefined) return cached;
      try {
        const r = await fetch(`${PB_URL}/api/collections/${coll}/records?perPage=1`);
        if (r.status === 200) return (cached = true);
        const body = await r.json().catch(() => ({}));
        if (body?.message?.includes('Missing collection')) return (cached = false);
        cached = r.ok;
      } catch { cached = false; }
      return cached;
    };
  }
  // §22-4 — CREDENCIAL DEL DISPOSITIVO. Al entrar, el alumno se queda con un
  // secreto que registra en `live_claims` (colección cerrada) y que manda en una
  // CABECERA con cada escritura suya. Sin esto bastaba con VER el `playerId` de un
  // compañero —la lista de jugadores es pública, y el host la necesita— para
  // responder en su nombre.
  //   · En memoria + localStorage: el Map cubre los tests y la sesión en curso; el
  //     almacenamiento, el F5 a mitad de partida.
  //   · La cabecera NO se guarda en la fila → el secreto no queda legible en
  //     `live_answers`, que sí es pública.
  const claimKey = (sessionId) => `ww.claim.${sessionId}`;
  const claims = new Map();
  function claimSecret(sessionId) {
    if (claims.has(sessionId)) return claims.get(sessionId);
    const stored = lsGet(claimKey(sessionId));
    if (stored) claims.set(sessionId, stored);
    return stored || null;
  }
  /** Cabecera de credencial para las escrituras del ALUMNO. Vacía en el host (va
   *  firmado con su token y la regla lo deja pasar por la otra rama). */
  function claimHeaders(sessionId) {
    const secret = claimSecret(sessionId);
    return secret ? { 'X-WW-Claim': secret } : undefined;
  }
  /** Registra la credencial de ESTE dispositivo para el jugador recién creado. */
  async function registerClaim(sessionId, playerId) {
    const secret = rid('cl_');
    try {
      await pbFetch(`/api/collections/${CLM}/records`, {
        method: 'POST', body: JSON.stringify({ session: sessionId, player: playerId, secret }),
      });
    } catch (e) {
      // 404 = servidor sin la colección (aún no se han creado): se sigue sin
      // credencial, que es exactamente el comportamiento anterior. 400 = ese
      // jugador ya está reclamado (índice único) → no se puede pisar.
      if (e?.status !== 404 && e?.status !== 400) throw e;
      if (e?.status === 400) return null;
    }
    claims.set(sessionId, secret);
    lsSet(claimKey(sessionId), secret);
    return secret;
  }

  const answersReady = collectionProbe(ANS);
  const playersReady = collectionProbe(PLR);
  const plrFilter = (sessionId, extra) =>
    pbFilterParam([`session='${pbEscape(sessionId)}'`, ...(extra ? [extra] : [])].join(' && '));

  // Jugadores de una sala desde live_players (deuda A). Standalone (no método)
  // para que lo compartan listPlayers y el leaderboard derivado sin depender del
  // binding de `this`.
  async function fetchPlayers(sessionId) {
    const res = await pbFetch(`/api/collections/${PLR}/records?filter=${plrFilter(sessionId)}&perPage=200`);
    return (res?.items || []).map(r => ({ id: r.id, name: r.name, userId: r.user_id, score: 0 }));
  }

  // PB ids (session/player) are alphanumeric, but escape single quotes anyway so
  // a stray quote can't break (or inject into) the filter. (pbEscape: shared.)
  const ansFilter = (sessionId, itemIndex, playerId) => {
    const parts = [`session='${pbEscape(sessionId)}'`, `item=${Number(itemIndex)}`];
    if (playerId != null) parts.push(`player='${pbEscape(playerId)}'`);
    return pbFilterParam(parts.join(' && '));
  };

  // Deduplica filas de respuesta a UNA por jugador: nos quedamos con la más
  // TEMPRANA (menor `ms`) para conservar la semántica Kahoot de primera
  // respuesta/velocidad. ÚNICO sitio donde vive este criterio (lo usan
  // fetchAnswerRows y settlePending); si la deuda F cambia el desempate a
  // "más reciente", se cambia solo aquí.
  function dedupeByPlayer(rows) {
    const byPlayer = new Map();
    for (const r of rows || []) {
      const prev = byPlayer.get(r.player);
      if (!prev || (r.ms ?? 0) < (prev.ms ?? Infinity)) byPlayer.set(r.player, r);
    }
    return [...byPlayer.values()];
  }

  // Hidrata el motor con una fila de la colección. Preservar el veredicto de una
  // fila YA puntuada es lo que impide el doble conteo: settle() solo suma puntos
  // a players[] cuando la respuesta estaba sin puntuar (wasUnscored). Compartido
  // por settleItem y settlePending — el invariante anti-doble-conteo vive aquí.
  function hydrateAnswerRow(engine, itemIndex, r) {
    // §22-1 — el tiempo que PUNTÚA lo mide el SERVIDOR, no el móvil: se deriva de
    // los autodate de la fila contra el sello de apertura del ítem (host-only).
    // El `ms` afirmado por el alumno queda solo como respaldo (ver core/serverMs.js)
    // y se conserva en la fila para el diagnóstico.
    const { ms, source } = deriveAnswerMs({
      createdAt: r.created, updatedAt: r.updated,
      openedAt: openedAtFor(engine.state.itemOpenedAt, itemIndex, engine.state.phase),
      claimedMs: r.ms, phase: engine.state.phase,
    });
    engine.state.answers[`${itemIndex}:${r.player}`] = {
      playerId: r.player, value: r.value, msTaken: ms, msClaimed: r.ms ?? 0, msSource: source,
      // `unscorable` = liquidada pero SIN clave de respuesta (deuda C): se hidrata
      // como null (no puntuable), no como false (incorrecta).
      correct: r.scored ? (r.unscorable ? null : r.correct) : null,
      points: r.scored ? (r.points ?? 0) : 0,
    };
  }

  // Fetch a session's answer rows for one item, deduped to ONE per player.
  async function fetchAnswerRows(sessionId, itemIndex) {
    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex)}&perPage=500`);
    return dedupeByPlayer(res?.items);
  }

  // La fila de UN (jugador, ítem), o null.
  async function getAnswerRow(sessionId, itemIndex, playerId) {
    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex, playerId)}&perPage=1`);
    return res?.items?.[0] || null;
  }

  // Crea la fila de una respuesta. Con el índice ÚNICO (session,player,item)
  // (deuda F), dos creaciones concurrentes de la MISMA celda chocan: la 2ª recibe
  // 400 → devolvemos `conflict` para que el llamador re-lea y haga PATCH. Así el
  // upsert es ATÓMICO por la BD, sin el read-then-write que duplicaba filas (el
  // tablero de Ordena las Pelotas mostraba/puntuaba un estado viejo). Sin el
  // índice (pre-migración), el 400 no ocurre y todo sigue como antes.
  async function postAnswer(body) {
    const headers = claimHeaders(body.session);
    try { await pbFetch(`/api/collections/${ANS}/records`, { method: 'POST', body: JSON.stringify(body), headers }); return { created: true }; }
    catch (e) { if (e?.status === 400) return { conflict: true }; throw e; }
  }

  // Liquida las respuestas que quedaron SIN puntuar en CUALQUIER ítem, sin tocar
  // la fase (`keepPhase`) y SOBRE el motor que le pasa endSession (así el cierre
  // hace UNA carga y UN guardado en total). Recoge las REZAGADAS: las que llegaron
  // después del settle de su pregunta (rescate del trazo, cola offline, red lenta).
  // Camino común (nada pendiente): un probe de 1 fila y fuera.
  async function settlePendingInto(engine, sessionId) {
    // ¿Hay algo sin puntuar? Probe mínimo server-side antes de bajar nada.
    const probe = await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}' && scored=false`)}&perPage=1&fields=id`);
    if (!probe?.items?.length) return 0;
    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}'`)}&perPage=500`);
    const byItem = new Map();
    for (const r of res?.items || []) {
      const it = Number(r.item);
      if (!byItem.has(it)) byItem.set(it, []);
      byItem.get(it).push(r);
    }
    const toPatch = [];
    for (const [itemIndex, itemRows] of byItem) {
      const rows = dedupeByPlayer(itemRows);
      if (!rows.some(r => !r.scored)) continue;       // ese ítem ya está liquidado
      for (const r of rows) hydrateAnswerRow(engine, itemIndex, r);
      engine.settle(itemIndex, { keepPhase: true });
      for (const r of rows) {
        if (r.scored) continue;                       // ya estaba puntuada: no la tocamos
        const s = engine.state.answers[`${itemIndex}:${r.player}`];
        if (s) toPatch.push({ id: r.id, correct: s.correct === true, unscorable: s.correct == null, points: s.points });
      }
    }
    engine.state.answers = {};   // el blob queda limpio; las respuestas viven en live_answers
    await Promise.all(toPatch.map(p => pbFetch(`/api/collections/${ANS}/records/${p.id}`, {
      method: 'PATCH', body: JSON.stringify({ scored: true, correct: p.correct, unscorable: p.unscorable, points: p.points }),
    }).catch(() => {})));
    return toPatch.length;
  }

  return {
    kind: 'pocketbase',

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
      if ('started_at' in patch) engine.state.startedAt = patch.started_at ?? null;
      if ('ql_points' in patch) engine.state.qlPoints = patch.ql_points ?? {};
      if (patch.ql_award) {
        const { playerId, points } = patch.ql_award;
        const p = engine.state.players.find(pl => pl.id === playerId);
        if (p) p.score += points;
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
      // §22-2 — EXCEPCIÓN DECLARADA de la carrera libre: en ese modo el móvil
      // juzga cada intento en local (colorea al instante y re-encola los fallos),
      // así que necesita el contenido completo. Solo entonces, y solo al arrancar,
      // se sube la actividad entera a la sala; al cerrar se vuelve al snapshot
      // saneado. Cerrarlo del todo pide un validador en el servidor (ver
      // core/liveSnapshot.js).
      if (needsClientKey(patch.phase)) {
        const full = await fullActivity(sessionId, rec);
        if (full) await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
          method: 'PATCH', body: JSON.stringify({ activity: full }),
        }).catch(() => { /* si falla, la carrera arranca sin veredicto local */ });
      }
      if (noteItemOpened(engine, patch, rec)) {
        await pbFetch(`/api/collections/${COLL}/records/${sessionId}`, {
          method: 'PATCH', body: JSON.stringify({ state: engine.state }),
        }).catch(() => { /* el sello es best-effort: sin él se cae al ms afirmado */ });
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

    async settleItem(sessionId, itemIndex) {
      if (await answersReady()) {
        const { engine } = await load(sessionId);
        const rows = await fetchAnswerRows(sessionId, itemIndex);
        // Hydrate the engine with the collection's answers, then let the SAME
        // engine.settle() score them (single source of truth) — it adds points
        // to state.players[]. The host is the only writer here, so this PATCH
        // can't be clobbered by students. hydrateAnswerRow preserva el veredicto
        // de las filas ya puntuadas → un segundo settle no re-suma (ver helper).
        for (const r of rows) hydrateAnswerRow(engine, itemIndex, r);
        const settled = engine.settle(itemIndex);
        // Write each answer's verdict back to its row (so students/host see ✓/✗
        // and points). Host-only writes, one per answer — no contention.
        await Promise.all(rows.map(r => {
          const scored = engine.state.answers[`${itemIndex}:${r.player}`];
          if (!scored) return null;
          return pbFetch(`/api/collections/${ANS}/records/${r.id}`, {
            method: 'PATCH', body: JSON.stringify({ scored: true, correct: scored.correct === true,
              unscorable: scored.correct == null, points: scored.points }),
          }).catch(() => {});
        }));
        // Keep scores (players[]) but drop the hydrated answers so the blob stays
        // lean — the answers live in live_answers, not in state.
        engine.state.answers = {};
        await saveState(sessionId, engine);
        return { ok: true, settled };
      }
      const { engine } = await load(sessionId);
      const settled = engine.settle(itemIndex);
      await saveState(sessionId, engine);
      return { ok: true, settled };
    },

    async submitAnswer(sessionId, playerId, itemIndex, value, msTaken) {
      if (await answersReady()) {
        // Candado de primera respuesta (Kahoot): si ya hay fila para este ítem, se
        // conserva. Un doble-tap simultáneo choca contra el índice único → `conflict`,
        // que aquí significa "ya respondió" → se ignora (antes creaba una 2ª fila).
        // scored=false = "respondió, sin puntuar" (PB bool no admite null).
        if (await getAnswerRow(sessionId, itemIndex, playerId)) return;
        await postAnswer({ session: sessionId, player: playerId, item: Number(itemIndex), value, ms: msTaken ?? 0, scored: false, correct: false, points: 0 });
        return;
      }
      // Legacy blob path (no live_answers collection): load→mutate→PATCH.
      const { engine } = await load(sessionId);
      engine.submit(playerId, itemIndex, value, msTaken);
      await saveState(sessionId, engine);
    },

    // Carrera (opción A analítica): a diferencia de submitAnswer, aquí llega TODO
    // intento. El PRIMERO (bien o mal) crea la fila y captura v0/c0 (primer intento)
    // para el análisis de clase, SIN cambiar el juego; los reintentos correctos solo
    // AVANZAN el progreso (value) — v0/c0 son inmutables. Ver docs/handoff-analitica-items.md.
    //
    // ANTI-TRAMPA (C6): el veredicto/los puntos del CLIENTE son solo un hint de
    // flujo — la fila se guarda SIEMPRE `scored:false, points:0`, como las
    // preguntas normales. Antes se persistía `scored:!!correct, points` tal cual
    // los mandaba el móvil: un alumno podía inyectar correct:true/points:9999 y
    // el settle lo respetaba ("ya puntuada"). Ahora la verdad la pone el HOST:
    // paintRace re-puntúa los values para el ranking en vivo (correct llega null
    // vía listAnswers) y endSession → settlePendingInto liquida con la fórmula
    // real. Mentir en `correct` solo mueve `value` a una respuesta mala → el
    // settle la puntúa MAL: mentir resta. (c0 queda como veredicto del primer
    // intento para la analítica de clase — no otorga puntos.)
    async submitRaceAttempt(sessionId, playerId, itemIndex, value, correct, points, msTaken) {
      if (await answersReady()) {
        let row = await getAnswerRow(sessionId, itemIndex, playerId);
        if (!row) {
          const r = await postAnswer({
            session: sessionId, player: playerId, item: Number(itemIndex),
            value, ms: msTaken ?? 0, scored: false, correct: !!correct, points: 0,
            v0: value, c0: !!correct,
          });
          if (r.created) return;                 // primer intento creado
          row = await getAnswerRow(sessionId, itemIndex, playerId);   // chocó → re-leer para avanzar
        }
        if (row && correct && row.correct !== true && !row.scored) {
          await pbFetch(`/api/collections/${ANS}/records/${row.id}`, {
            method: 'PATCH', body: JSON.stringify({ value, ms: msTaken ?? 0, correct: true }),
            headers: claimHeaders(sessionId),
          });
        }
        return;
      }
      // Legacy blob (colección live_answers ausente): mismo principio anti-trampa —
      // el veredicto del cliente es un HINT (`hint`) para no re-escribir un ítem ya
      // avanzado; la respuesta queda SIN puntuar (correct:null) y la liquida el
      // settle del host con la fórmula real.
      const { engine } = await load(sessionId);
      const key = `${itemIndex}:${playerId}`;
      const prev = engine.state.answers[key];
      const v0 = prev && 'v0' in prev ? prev.v0 : value;
      const c0 = prev && 'c0' in prev ? prev.c0 : !!correct;
      if (!prev || (correct && prev.hint !== true)) {
        engine.state.answers[key] = { playerId, value, msTaken: msTaken ?? 0, correct: null, points: 0, hint: !!correct, v0, c0 };
        await saveState(sessionId, engine);
      }
    },

    // Continuous progress for live "board" templates. UPSERTS the player's own
    // row (no first-answer lock): PATCH if it exists, else POST. The host reads
    // these via listAnswers and renders each board live; settleItem() later
    // scores the latest value. itemIndex defaults to 0 (single shared board).
    async submitProgress(sessionId, playerId, value, msTaken, itemIndex = 0) {
      if (await answersReady()) {
        // Upsert ATÓMICO (deuda F): si no hay fila, POST; si dos progresos
        // concurrentes chocan (índice único), el 2º re-lee y PATCHea la MISMA
        // fila → nunca hay dos filas del mismo jugador con estados de tablero
        // distintos (antes el desempate por `ms` mostraba/puntuaba uno viejo).
        let row = await getAnswerRow(sessionId, itemIndex, playerId);
        if (!row) {
          const r = await postAnswer({ session: sessionId, player: playerId, item: Number(itemIndex), value, ms: msTaken ?? 0, scored: false, correct: false, points: 0 });
          if (r.created) return;
          row = await getAnswerRow(sessionId, itemIndex, playerId);
        }
        if (row) {
          // SIN `scored` en el patch: (a) la regla de PB prohíbe al alumno tocar
          // los campos de veredicto (§22) y (b) re-afirmar scored:false podía
          // DES-liquidar una fila que el host ya había puntuado.
          await pbFetch(`/api/collections/${ANS}/records/${row.id}`, {
            method: 'PATCH', body: JSON.stringify({ value, ms: msTaken ?? row.ms ?? 0 }),
            headers: claimHeaders(sessionId),
          });
        }
        return;
      }
      // Legacy blob path: overwrite the player's answer in state (allowed here).
      const { engine } = await load(sessionId);
      engine.state.answers[`${Number(itemIndex)}:${playerId}`] = { playerId, value, msTaken: msTaken ?? 0, correct: null, points: 0 };
      await saveState(sessionId, engine);
    },

    async getOwnAnswer(sessionId, playerId, itemIndex) {
      if (await answersReady()) {
        const res = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex, playerId)}&perPage=1`);
        const r = res?.items?.[0];
        return r ? { playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? r.correct : null, points: r.points } : null;
      }
      const { engine } = await load(sessionId);
      return engine.state.answers[`${itemIndex}:${playerId}`] || null;
    },

    async listPlayers(sessionId) {
      if (await playersReady()) return fetchPlayers(sessionId);
      const { engine } = await load(sessionId);
      return engine.state.players.slice();
    },

    async listAnswers(sessionId, itemIndex) {
      if (await answersReady()) {
        const rows = await fetchAnswerRows(sessionId, itemIndex);
        // v0/c0 (primer intento, carrera) pasan a la analítica; el resto usa value/correct.
        return rows.map(r => ({ playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? r.correct : null, points: r.points, v0: r.v0, c0: r.c0 }));
      }
      const { engine } = await load(sessionId);
      const a = engine.state.answers;
      return Object.entries(a)
        .filter(([k]) => k.startsWith(itemIndex + ':'))
        .map(([, v]) => v);
    },

    // Marcador DERIVADO (deuda A A3): con los jugadores fuera del blob, el motor
    // ya no acumula `state.players[].score`; la puntuación autoritativa vive en
    // las filas de live_answers (una por respuesta, puntuada por el profe al
    // settle). Sumamos points por jugador y le pegamos el nombre de live_players
    // → misma fuente que el podio (buildSessionTable) ⇒ marcador entre preguntas
    // y podio final SIEMPRE coinciden. Incluye a quien aún no puntúa (0).
    async leaderboard(sessionId, limit = 50) {
      if (await playersReady() && await answersReady()) {
        const players = await fetchPlayers(sessionId);
        const score = new Map();
        try {
          const res = await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}' && scored=true`)}&perPage=500&fields=player,points`);
          for (const r of res?.items || []) score.set(r.player, (score.get(r.player) || 0) + (r.points || 0));
        } catch { /* sin respuestas todavía → todos a 0 */ }
        return players
          .map(p => ({ id: p.id, name: p.name, score: score.get(p.id) || 0 }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((p, i) => ({ rank: i + 1, ...p }));
      }
      const { engine } = await load(sessionId);
      return engine.leaderboard(limit);
    },

    async kickPlayer(sessionId, playerId) {
      if (await playersReady()) {
        await pbFetch(`/api/collections/${PLR}/records/${playerId}`, { method: 'DELETE' }).catch(() => {});
        return;
      }
      const { engine } = await load(sessionId);
      engine.state.players = engine.state.players.filter(p => p.id !== playerId);
      await saveState(sessionId, engine);
    },

    async pingPresence() { /* state is in PB record, no presence table needed */ },
    async pingHost() { /* no-op */ },

    // PocketBase SSE realtime. Subscribes to the specific live_sessions record.
    // On any update, notifies the view with all three table types so it re-fetches
    // players, answers, and session state (all live in the same PB record).
    subscribeRoom(sessionId, onChange) {
      const topic = `${COLL}/${sessionId}`;
      let active = true;
      let es = null;
      let retries = 0;          // consecutive failed connection attempts
      let retryTimer = null;

      // Exponential backoff with jitter, capped at 30s. The native EventSource
      // reconnect hammers a downed server every ~3s; this backs off instead so
      // a PocketBase outage doesn't flood it with reconnects from every client.
      function backoffDelay() {
        const base = Math.min(30000, 1000 * 2 ** Math.min(retries, 5)); // 1,2,4,8,16,30…
        return base / 2 + Math.random() * (base / 2);                   // 50–100% jitter
      }

      function scheduleReconnect() {
        if (!active || retryTimer) return;
        const delay = backoffDelay();
        retries++;
        console.warn(`[realtime] reconnecting in ${Math.round(delay)}ms (attempt ${retries})`);
        // Surface the sticky "Reconectando…" banner (debounced inside connection.js
        // so brief blips during normal heartbeats don't flash it). After several
        // failed attempts, escalate to "Conexión perdida" so the user knows it's
        // not just a momentary blip.
        try { setConnectionState(retries >= 5 ? 'error' : 'reconnecting'); } catch {}
        retryTimer = setTimeout(() => { retryTimer = null; connect(); }, delay);
      }

      // Re-fetch all virtual tables. SSE only delivers CHANGES, so anything the
      // host changed while we were disconnected was never delivered; firing this
      // on every (re)connect makes a reconnecting student catch up instead of
      // staying stuck on a stale question.
      function resync(reason) {
        onChange({ table: 'sessions', eventType: reason });
        onChange({ table: 'players', eventType: reason });
        onChange({ table: 'answers', eventType: reason });
      }

      // Tear down an EventSource so a superseded source can't keep firing its
      // onerror and spawn a second reconnect stream (orphaned ES hammering a
      // downed server). Detaching onerror BEFORE close is the key step.
      function teardown(src) {
        if (!src) return;
        src.onerror = null;
        try { src.close(); } catch {}
      }

      function connect() {
        if (!active) return;
        teardown(es);
        const self = new EventSource(`${PB_URL}/api/realtime`);
        es = self;

        self.addEventListener('PB_CONNECT', async (e) => {
          if (!active || es !== self) return;
          retries = 0; // a successful handshake resets the backoff
          try { setConnectionState('connected'); } catch {}
          try {
            const { clientId } = JSON.parse(e.data);
            // Suscribe también a live_players (deuda A) para que el lobby del
            // profe vea entrar gente al instante: los joins ya NO PATCHean el blob
            // (dejarían de disparar el topic de la sesión). Solo si la colección
            // existe — sin ella, suscribir un topic inexistente podría dejar el
            // POST connected-but-deaf en despliegues pre-migración.
            const subs = [topic];
            if (await playersReady()) subs.push(PLR);
            const r = await fetch(`${PB_URL}/api/realtime`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, subscriptions: subs }),
            });
            if (!r.ok) throw new Error(`subscribe HTTP ${r.status}`);
            resync('reconnect');
          } catch (err) {
            // PB_CONNECT fires once per connection; a failed subscribe would
            // leave us connected-but-deaf forever (no events, no error). Force a
            // fresh reconnect cycle instead of waiting for a PB_CONNECT that
            // will never come again.
            console.warn('[realtime] subscription POST failed — forcing reconnect:', err);
            if (es === self) { teardown(self); es = null; scheduleReconnect(); }
          }
        });

        self.addEventListener(topic, (e) => {
          if (!active || es !== self) return;
          try {
            const { action } = JSON.parse(e.data);
            // All state is in one record: fire all three virtual tables so views
            // that listen for 'sessions', 'players', or 'answers' all re-fetch.
            onChange({ table: 'sessions', eventType: action });
            onChange({ table: 'players', eventType: action });
            onChange({ table: 'answers', eventType: action });
          } catch (err) { console.warn('[realtime] malformed SSE payload — skipping event:', err, e?.data?.slice?.(0, 120)); }
        });

        // live_players (deuda A): un alumno entró/salió → el profe re-lee la
        // lista. El topic es la colección ENTERA (filtramos por sesión al
        // re-fetch en listPlayers); a escala colegio el ruido entre salas es
        // despreciable. Payload ignorado a propósito: forzamos un re-fetch.
        self.addEventListener(PLR, (e) => {
          if (!active || es !== self) return;
          try { onChange({ table: 'players', eventType: JSON.parse(e.data).action }); }
          catch { onChange({ table: 'players' }); }
        });

        self.onerror = (err) => {
          if (es !== self) return; // a superseded source firing late — ignore
          // Take over reconnection from the native EventSource: close it and
          // reconnect on an exponential backoff so a downed server isn't flooded.
          console.warn('[realtime] SSE connection error — backing off before reconnect:', err);
          teardown(self);
          es = null;
          scheduleReconnect();
        };
      }

      connect();
      return () => {
        active = false;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        teardown(es);
        es = null;
      };
    },
  };
}

export default createPocketbaseRealtime;
