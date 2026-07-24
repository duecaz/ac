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
import { createLiveRoom } from '../../kernel/live/engine.js';
import { pickWord } from '../../core/liveWords.js';
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';
import { PB_URL } from '../../pocketbase.config.js';
import { setConnectionState } from '../../core/connection.js';

const COLL = 'live_sessions';
const ANS = 'live_answers';   // one record per student answer (lost-update fix)

function genUserId() { return 'u_' + Math.random().toString(36).slice(2, 10); }

async function pbFetchOnce(path, opts = {}) {
  const { body: reqBody, method, headers: extra, timeoutMs = 12000 } = opts;
  const headers = {};
  if (reqBody && typeof reqBody === 'string') headers['Content-Type'] = 'application/json';
  if (extra) Object.assign(headers, extra);
  // Abort a stalled socket instead of hanging forever: on flaky mobile a TCP
  // connection can open but never respond, which would leave submit/load/host
  // actions pending indefinitely (frozen UI, submitQueue never enqueues). The
  // AbortError flows into the offline queue / reconnect backoff like any failure.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(`${PB_URL}${path}`, {
      method: method || 'GET',
      headers,
      ...(reqBody !== undefined ? { body: reqBody } : {}),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw Object.assign(new Error(`PocketBase: tiempo de espera agotado (${timeoutMs}ms)`), { status: 0, timeout: true });
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); }
    catch { throw Object.assign(new Error(`PocketBase error ${r.status}: respuesta no-JSON`), { status: r.status }); }
  }
  if (!r.ok) throw Object.assign(new Error(body?.message || `PocketBase error ${r.status}`), { status: r.status, pb: body });
  return body;
}

// Reintenta las lecturas (GET) ante fallos TRANSITORIOS — timeout, red caída, 5xx —
// que en móvil flojo tumbaban un `join`/`fetchSession` de una sola vez ("un alumno
// no entra y hay que refrescar"). Solo GET: es idempotente, reintentarlo no duplica
// nada. Las ESCRITURAS (POST/PATCH) NO se reintentan aquí (podrían pisar el blob
// `state` — deuda A); su resiliencia vive en la cola offline. Backoff 300/700ms.
async function pbFetch(path, opts = {}) {
  const isRead = !opts.method || opts.method === 'GET';
  const attempts = isRead ? 3 : 1;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await pbFetchOnce(path, opts); }
    catch (e) {
      lastErr = e;
      const transient = e?.timeout || e?.status === 0 || e?.status >= 500;
      if (!isRead || !transient || i === attempts - 1) throw e;
      await new Promise(res => setTimeout(res, i === 0 ? 300 : 700));
    }
  }
  throw lastErr;
}

export function createPocketbaseRealtime({ userId = genUserId() } = {}) {
  // Load a session record and rebuild the engine over its persisted state.
  async function load(sessionId) {
    const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
    if (!rec) throw new Error('Sala no encontrada');
    const engine = createLiveRoom(rec.activity, { state: rec.state, code: rec.code });
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
  let _ansReady;   // undefined = unknown, then true/false (cached per adapter)
  async function answersReady() {
    if (_ansReady !== undefined) return _ansReady;
    try {
      const r = await fetch(`${PB_URL}/api/collections/${ANS}/records?perPage=1`);
      if (r.status === 200) return (_ansReady = true);
      const body = await r.json().catch(() => ({}));
      if (body?.message?.includes('Missing collection')) return (_ansReady = false);
      _ansReady = r.ok;
    } catch { _ansReady = false; }
    return _ansReady;
  }

  // PB ids (session/player) are alphanumeric, but escape single quotes anyway so
  // a stray quote can't break (or inject into) the filter. (pbEscape: shared.)
  const ansFilter = (sessionId, itemIndex, playerId) => {
    const parts = [`session='${pbEscape(sessionId)}'`, `item=${Number(itemIndex)}`];
    if (playerId != null) parts.push(`player='${pbEscape(playerId)}'`);
    return pbFilterParam(parts.join(' && '));
  };

  // Fetch a session's answer rows for one item, deduped to ONE per player. A
  // double-tap can create two rows (no DB unique index needed); we keep the
  // earliest (lowest ms) so the Kahoot first-answer/speed semantics hold.
  async function fetchAnswerRows(sessionId, itemIndex) {
    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex)}&perPage=500`);
    const byPlayer = new Map();
    for (const r of res?.items || []) {
      const prev = byPlayer.get(r.player);
      if (!prev || (r.ms ?? 0) < (prev.ms ?? Infinity)) byPlayer.set(r.player, r);
    }
    return [...byPlayer.values()];
  }

  // Liquida las respuestas que quedaron SIN puntuar en CUALQUIER ítem, sin tocar la
  // fase (`keepPhase`). Se llama al cerrar la sala para recoger las REZAGADAS: las
  // que llegaron después del settle de su pregunta (rescate del trazo al avanzar,
  // reintento de la cola offline, red lenta). Una sola pasada: 1 lectura de todas
  // las filas + 1 PATCH por fila recién puntuada + 1 guardado de estado.
  async function settlePending(sessionId) {
    if (!(await answersReady())) {
      // Blob heredado: las respuestas viven en state.answers y settle() ya salta
      // las que tienen veredicto, así que esto solo puntúa lo pendiente.
      const { engine } = await load(sessionId);
      for (let i = 0; i < engine.totalItems; i++) engine.settle(i, { keepPhase: true });
      await saveState(sessionId, engine);
      return 0;
    }
    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}'`)}&perPage=500`);
    const all = res?.items || [];
    if (!all.some(r => !r.scored)) return 0;          // nada rezagado → ni cargamos el motor
    const { engine } = await load(sessionId);
    // Dedupe por (ítem, jugador) con el MISMO criterio que fetchAnswerRows.
    const byItem = new Map();
    for (const r of all) {
      const it = Number(r.item);
      if (!byItem.has(it)) byItem.set(it, new Map());
      const m = byItem.get(it);
      const prev = m.get(r.player);
      if (!prev || (r.ms ?? 0) < (prev.ms ?? Infinity)) m.set(r.player, r);
    }
    const toPatch = [];
    for (const [itemIndex, m] of byItem) {
      const rows = [...m.values()];
      if (!rows.some(r => !r.scored)) continue;       // ese ítem ya está liquidado
      // Un ítem a la vez: settle() solo mira las claves `${itemIndex}:` y suma a
      // players[], así que limpiamos entre ítems para no recontar.
      engine.state.answers = {};
      for (const r of rows) {
        engine.state.answers[`${itemIndex}:${r.player}`] = {
          playerId: r.player, value: r.value, msTaken: r.ms ?? 0,
          // Preservar el veredicto existente hace que settle() NO vuelva a sumar
          // los puntos ya contados en players[] (wasUnscored === false).
          correct: r.scored ? r.correct : null, points: r.scored ? (r.points ?? 0) : 0,
        };
      }
      engine.settle(itemIndex, { keepPhase: true });
      for (const r of rows) {
        if (r.scored) continue;                       // ya estaba puntuada: no la tocamos
        const s = engine.state.answers[`${itemIndex}:${r.player}`];
        if (s) toPatch.push({ id: r.id, correct: s.correct === true, points: s.points });
      }
    }
    engine.state.answers = {};   // el blob queda limpio; las respuestas viven en live_answers
    await Promise.all(toPatch.map(p => pbFetch(`/api/collections/${ANS}/records/${p.id}`, {
      method: 'PATCH', body: JSON.stringify({ scored: true, correct: p.correct, points: p.points }),
    }).catch(() => {})));
    await saveState(sessionId, engine);
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
          const rec = await pbFetch(`/api/collections/${COLL}/records`, {
            method: 'POST',
            body: JSON.stringify({ code, activity, state: engine.state }),
          });
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
        ql_open: rec.state?.qlOpen ?? null,
        ql_question: rec.state?.qlQuestion ?? null,
        ql_image: rec.state?.qlImage ?? null,
        ql_points: rec.state?.qlPoints ?? {},
        ql_by: rec.state?.qlBy ?? null,
        ql_by_name: rec.state?.qlByName ?? null,
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
        ql_open: rec.state?.qlOpen ?? null,
        ql_question: rec.state?.qlQuestion ?? null,
        ql_image: rec.state?.qlImage ?? null,
        ql_points: rec.state?.qlPoints ?? {},
        ql_by: rec.state?.qlBy ?? null,
        ql_by_name: rec.state?.qlByName ?? null,
      };
    },

    // The host holds the full activity (with answer keys) — return it directly.
    async fetchSessionKey(sessionId) {
      const rec = await pbFetch(`/api/collections/${COLL}/records/${sessionId}`);
      return rec?.activity || null;
    },

    async joinSession(code, nickname) {
      const res = await pbFetch(
        `/api/collections/${COLL}/records?filter=${pbFilterParam(`code='${pbEscape(code.toUpperCase())}'`)}`
      );
      const rec = res?.items?.[0];
      if (!rec) throw new Error('Sala no encontrada');
      if (rec.state?.status === 'ended') throw new Error('La sala ha terminado');
      const live = rec.activity?.live || {};
      if (rec.state?.status !== 'lobby' && !live.allowLateJoin) throw new Error('La partida ya empezó');

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

    // Cerrar la sala LIQUIDA lo pendiente y LUEGO marca 'ended'. Así ninguna
    // respuesta rezagada (rescate del trazo, cola offline, red lenta) se queda sin
    // puntuar: llegue cuando llegue, si está en la colección antes del cierre
    // cuenta. Un fallo al liquidar NO impide cerrar (la sala debe poder cerrarse
    // siempre); se avisa por consola y el podio se pinta con lo que haya.
    async endSession(sessionId) {
      try { await settlePending(sessionId); }
      catch (e) { console.warn('[live] no se pudieron liquidar rezagadas al cerrar:', e); }
      const { engine } = await load(sessionId);
      engine.state.status = 'ended';
      engine.state.phase = 'ended';
      await saveState(sessionId, engine);
    },

    async setSessionState(sessionId, patch) {
      const { engine } = await load(sessionId);
      if (patch.status !== undefined) engine.state.status = patch.status;
      if (patch.phase !== undefined) engine.state.phase = patch.phase;
      if ('current_item' in patch) engine.state.currentItem = patch.current_item;
      if ('deadline' in patch) engine.state.deadline = patch.deadline ?? null;
      if ('started_at' in patch) engine.state.startedAt = patch.started_at ?? null;
      if ('ql_open' in patch) engine.state.qlOpen = patch.ql_open ?? null;
      if ('ql_question' in patch) engine.state.qlQuestion = patch.ql_question ?? null;
      if ('ql_image' in patch) engine.state.qlImage = patch.ql_image ?? null;
      if ('ql_points' in patch) engine.state.qlPoints = patch.ql_points ?? {};
      if ('ql_by' in patch) engine.state.qlBy = patch.ql_by ?? null;
      if ('ql_by_name' in patch) engine.state.qlByName = patch.ql_by_name ?? null;
      if (patch.ql_award) {
        const { playerId, points } = patch.ql_award;
        const p = engine.state.players.find(pl => pl.id === playerId);
        if (p) p.score += points;
      }
      await saveState(sessionId, engine);
    },

    async settleItem(sessionId, itemIndex) {
      if (await answersReady()) {
        const { engine } = await load(sessionId);
        const rows = await fetchAnswerRows(sessionId, itemIndex);
        // Hydrate the engine with the collection's answers, then let the SAME
        // engine.settle() score them (single source of truth) — it adds points
        // to state.players[]. The host is the only writer here, so this PATCH
        // can't be clobbered by students.
        for (const r of rows) {
          engine.state.answers[`${itemIndex}:${r.player}`] = {
            playerId: r.player, value: r.value, msTaken: r.ms ?? 0,
            // Preserve a row's existing verdict: settle() only awards points when
            // an answer was unscored (correct === null). A second settle of the
            // same item (host double-click / end-of-race loop) must NOT re-add
            // points already in players[] — keeping the scored row's verdict makes
            // wasUnscored false so the re-settle is a no-op for scoring.
            correct: r.scored ? r.correct : null, points: r.scored ? (r.points ?? 0) : 0,
          };
        }
        const settled = engine.settle(itemIndex);
        // Write each answer's verdict back to its row (so students/host see ✓/✗
        // and points). Host-only writes, one per answer — no contention.
        await Promise.all(rows.map(r => {
          const scored = engine.state.answers[`${itemIndex}:${r.player}`];
          if (!scored) return null;
          return pbFetch(`/api/collections/${ANS}/records/${r.id}`, {
            method: 'PATCH', body: JSON.stringify({ scored: true, correct: scored.correct === true, points: scored.points }),
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
        // First-answer lock (Kahoot): if this player already has a row for this
        // item, keep it. A true simultaneous double-tap may still create two
        // rows, but fetchAnswerRows() dedupes them on read, so no double-score.
        const existing = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex, playerId)}&perPage=1`);
        if (existing?.items?.length) return;
        // scored=false marks "answered, not yet graded". PB bool can't be null,
        // so this flag (not `correct`) carries the unscored state.
        await pbFetch(`/api/collections/${ANS}/records`, {
          method: 'POST',
          body: JSON.stringify({ session: sessionId, player: playerId, item: Number(itemIndex), value, ms: msTaken ?? 0, scored: false, correct: false, points: 0 }),
        });
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
    // AVANZAN el progreso (value/correct/points) — v0/c0 son inmutables. Ver
    // docs/handoff-analitica-items.md.
    async submitRaceAttempt(sessionId, playerId, itemIndex, value, correct, points, msTaken) {
      if (await answersReady()) {
        const existing = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex, playerId)}&perPage=1`);
        const row = existing?.items?.[0];
        if (!row) {
          await pbFetch(`/api/collections/${ANS}/records`, {
            method: 'POST',
            body: JSON.stringify({
              session: sessionId, player: playerId, item: Number(itemIndex),
              value, ms: msTaken ?? 0, scored: !!correct, correct: !!correct, points: correct ? (points ?? 0) : 0,
              v0: value, c0: !!correct,
            }),
          });
          return;
        }
        if (correct && row.correct !== true) {
          await pbFetch(`/api/collections/${ANS}/records/${row.id}`, {
            method: 'PATCH', body: JSON.stringify({ value, correct: true, scored: true, points: points ?? 0 }),
          });
        }
        return;
      }
      // Legacy blob: guarda v0/c0 en el propio answer; progreso solo con correcto.
      const { engine } = await load(sessionId);
      const key = `${itemIndex}:${playerId}`;
      const prev = engine.state.answers[key];
      const v0 = prev && 'v0' in prev ? prev.v0 : value;
      const c0 = prev && 'c0' in prev ? prev.c0 : !!correct;
      if (!prev || (correct && prev.correct !== true)) {
        engine.state.answers[key] = { playerId, value, msTaken: msTaken ?? 0, correct: !!correct, points: correct ? (points ?? 0) : (prev?.points ?? 0), v0, c0 };
        await saveState(sessionId, engine);
      }
    },

    // Continuous progress for live "board" templates. UPSERTS the player's own
    // row (no first-answer lock): PATCH if it exists, else POST. The host reads
    // these via listAnswers and renders each board live; settleItem() later
    // scores the latest value. itemIndex defaults to 0 (single shared board).
    async submitProgress(sessionId, playerId, value, msTaken, itemIndex = 0) {
      if (await answersReady()) {
        const existing = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex, playerId)}&perPage=1`);
        const row = existing?.items?.[0];
        if (row) {
          await pbFetch(`/api/collections/${ANS}/records/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ value, ms: msTaken ?? row.ms ?? 0, scored: false }),
          });
        } else {
          await pbFetch(`/api/collections/${ANS}/records`, {
            method: 'POST',
            body: JSON.stringify({ session: sessionId, player: playerId, item: Number(itemIndex), value, ms: msTaken ?? 0, scored: false, correct: false, points: 0 }),
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

    async leaderboard(sessionId, limit = 50) {
      const { engine } = await load(sessionId);
      return engine.leaderboard(limit);
    },

    async kickPlayer(sessionId, playerId) {
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
            const r = await fetch(`${PB_URL}/api/realtime`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, subscriptions: [topic] }),
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
