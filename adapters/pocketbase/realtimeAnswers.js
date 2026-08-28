// TODO LO DE `live_answers` — una fila por respuesta de alumno (lost-update
// fix), su hidratación en el motor, y los métodos de respuesta/puntuación
// (submitAnswer/submitRaceAttempt/submitProgress/settleItem/listAnswers/
// leaderboard…), incluida la rama LEGACY del blob (colección ausente).
//
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
import { pbEscape, pbFilterParam } from '../../core/pbFilter.js';
import { rankPlayers } from '../../core/liveRank.js';
import { deriveAnswerMs, openedAtFor, origenServidor } from '../../core/serverMs.js';

/**
 * Fábrica de la sección de respuestas. `deps`:
 *   - pbFetch: cliente HTTP con reintentos.
 *   - ANS: nombre de la colección `live_answers`.
 *   - claimHeaders(sessionId): cabecera de credencial del alumno (sección claims).
 *   - load(sessionId): { rec, engine } de la sala (sección rooms).
 *   - saveState(sessionId, engine): persiste `engine.state` en la sala (sección rooms).
 *   - fetchPlayers(sessionId): jugadores de `live_players` (sección rooms).
 *   - playersReady(): ¿existe la colección `live_players`? (sección rooms).
 *   - answersReady(): ¿existe la colección `live_answers`?
 */
export function createAnswersSection({ pbFetch, ANS, claimHeaders, load, saveState, fetchPlayers, playersReady, answersReady }) {
  // PB ids (session/player) are alphanumeric, but escape single quotes anyway so
  // a stray quote can't break (or inject into) the filter. (pbEscape: shared.)
  const ansFilter = (sessionId, itemIndex, playerId) => {
    const parts = [`session='${pbEscape(sessionId)}'`, `item=${Number(itemIndex)}`];
    if (playerId != null) parts.push(`player='${pbEscape(playerId)}'`);
    return pbFilterParam(parts.join(' && '));
  };

  // Deduplica filas de respuesta a UNA por jugador: nos quedamos con la más
  // TEMPRANA (menor `ms`) para conservar la semántica de primera
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
  function hydrateAnswerRow(engine, itemIndex, r, origenRespaldo = null) {
    // §22-1 — el tiempo que PUNTÚA lo mide el SERVIDOR, no el móvil: se deriva de
    // los autodate de la fila contra el sello de apertura del ítem (host-only).
    // El `ms` afirmado por el alumno queda solo como respaldo (ver core/serverMs.js)
    // y se conserva en la fila para el diagnóstico.
    // Sin sello (ese PATCH aparte puede no haber entrado) se usa el instante
    // más temprano del SERVIDOR entre las filas: el orden sigue siendo suyo,
    // no del móvil (core/serverMs.js · origenServidor).
    const { ms, source } = deriveAnswerMs({
      createdAt: r.created, updatedAt: r.updated,
      openedAt: openedAtFor(engine.state.itemOpenedAt, itemIndex, engine.state.phase) || origenRespaldo,
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
  // `fields=` explícito: esta consulta la POLLEA la carrera (cada 5 s) y el
  // tablero (cada 2 s), con hasta 500 filas — traer columnas que nadie lee es
  // ancho de banda contra la Pi en el peor momento. Si alguien necesita un campo
  // nuevo de live_answers, se añade AQUÍ (y en listAnswers, que es quien mapea).
  const ANS_FIELDS = 'id,item,player,value,ms,correct,unscorable,points,scored,v0,c0,created,updated';
  async function fetchAnswerRows(sessionId, itemIndex) {
    const res = await pbFetch(`/api/collections/${ANS}/records?filter=${ansFilter(sessionId, itemIndex)}&perPage=500&fields=${ANS_FIELDS}`);
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
    // Origen de respaldo por si falta el sello. En CARRERA todos los ítems se
    // abren a la vez → el bueno es el de TODA la sala. En RONDAS cada pregunta
    // abre a su hora: el de toda la sala le daría al ítem 5 un ms de minutos y
    // le mataría el bonus de velocidad SOLO a los liquidados en el barrido de
    // cierre (revisión de v1.51.444) → allí se usa el del PROPIO ítem.
    const esCarrera = engine.state.loop === 'race' || engine.state.phase === 'race';
    const origenSala = esCarrera ? origenServidor(res?.items || []) : null;
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
      const origen = origenSala ?? origenServidor(rows);   // rondas: el del propio ítem
      for (const r of rows) hydrateAnswerRow(engine, itemIndex, r, origen);
      engine.settle(itemIndex, { keepPhase: true });
      for (const r of rows) {
        if (r.scored) continue;                       // ya estaba puntuada: no la tocamos
        const s = engine.state.answers[`${itemIndex}:${r.player}`];
        // `ms` del SERVIDOR (mismo motivo que en settleItem): este PATCH pisa
        // `updated`, así que el instante derivado se guarda AHORA o se pierde.
        if (s) toPatch.push({ id: r.id, correct: s.correct === true, unscorable: s.correct == null, points: s.points, ms: s.msTaken ?? 0 });
      }
    }
    engine.state.answers = {};   // el blob queda limpio; las respuestas viven en live_answers
    await Promise.all(toPatch.map(p => pbFetch(`/api/collections/${ANS}/records/${p.id}`, {
      method: 'PATCH', body: JSON.stringify({ scored: true, correct: p.correct, unscorable: p.unscorable, points: p.points, ms: p.ms }),
    }).catch(() => {})));
    return toPatch.length;
  }

  return {
    async settleItem(sessionId, itemIndex) {
      if (await answersReady()) {
        const { engine } = await load(sessionId);
        const rows = await fetchAnswerRows(sessionId, itemIndex);
        const origen = origenServidor(rows);   // respaldo si falta el sello (§22-1)
        // Hydrate the engine with the collection's answers, then let the SAME
        // engine.settle() score them (single source of truth) — it adds points
        // to state.players[]. The host is the only writer here, so this PATCH
        // can't be clobbered by students. hydrateAnswerRow preserva el veredicto
        // de las filas ya puntuadas → un segundo settle no re-suma (ver helper).
        for (const r of rows) hydrateAnswerRow(engine, itemIndex, r, origen);
        const settled = engine.settle(itemIndex);
        // Write each answer's verdict back to its row (so students/host see ✓/✗
        // and points). Host-only writes, one per answer — no contention.
        await Promise.all(rows.map(r => {
          const scored = engine.state.answers[`${itemIndex}:${r.player}`];
          if (!scored) return null;
          return pbFetch(`/api/collections/${ANS}/records/${r.id}`, {
            // `ms` se REESCRIBE con el del servidor: el `ms` del cliente era una
            // afirmación (§22) y el settle es justo el momento en que el servidor
            // pone su número. Importa porque `updated` deja de servir como
            // instante del acierto en cuanto este PATCH lo pisa.
            method: 'PATCH', body: JSON.stringify({ scored: true, correct: scored.correct === true,
              unscorable: scored.correct == null, points: scored.points, ms: scored.msTaken ?? 0 }),
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
        // Candado de primera respuesta (como en un concurso): si ya hay fila para este ítem, se
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
    // AVANZAN el progreso (value) — v0/c0 son inmutables. Ver docs/historico/handoff-analitica-items.md.
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
            // SIN `ms`: el tiempo es VEREDICTO del servidor (§22-1) y la regla ya
            // no deja al alumno tocarlo. El `ms` del primer intento queda en la
            // fila como respaldo honesto; el que puntúa lo escribe el settle.
            method: 'PATCH', body: JSON.stringify({ value, correct: true }),
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
            method: 'PATCH', body: JSON.stringify({ value }),   // `ms` es veredicto (§22-1)
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

    // Todas las filas PROPIAS del alumno en la sala (reanudar la carrera tras
    // una recarga: core/raceResume.js). `correct` aquí significa "este
    // dispositivo ya lo acertó": veredicto del settle O el hint de avance de la
    // carrera (submitRaceAttempt escribe correct=true al acertar, §22-C6) — un
    // fallo sin puntuar queda en null, no en false.
    async listOwnAnswers(sessionId, playerId) {
      if (await answersReady()) {
        const filter = pbFilterParam(`session='${pbEscape(sessionId)}' && player='${pbEscape(playerId)}'`);
        const res = await pbFetch(`/api/collections/${ANS}/records?filter=${filter}&perPage=500`);
        return (res?.items || []).map(r => ({
          itemIndex: r.item, value: r.value,
          correct: (r.scored ? !!r.correct : (r.correct === true ? true : null)),
          points: r.points,
          ms: r.ms,   // ms de SERVIDOR desde la salida: reanudar recupera la hora de meta
        }));
      }
      const { engine } = await load(sessionId);
      return Object.entries(engine.state.answers)
        .filter(([k]) => k.endsWith(':' + playerId))
        .map(([k, v]) => ({
          itemIndex: Number(k.split(':')[0]), value: v.value,
          correct: (v.correct === true || v.hint === true) ? true : (v.correct === false ? false : null),
          points: v.points,
        }));
    },

    async listAnswers(sessionId, itemIndex) {
      if (await answersReady()) {
        const rows = await fetchAnswerRows(sessionId, itemIndex);
        // v0/c0 (primer intento, carrera) pasan a la analítica; el resto usa value/correct.
        // `created`/`updated` VIAJAN: son los autodate del servidor y sin ellos
        // core/answerRows.js no puede derivar el tiempo (§22-1) y cae al `ms` que
        // afirma el móvil — que en carrera es el tiempo EN ESA PREGUNTA, no desde
        // la salida. Como la carrera la decide la HORA DE META, ese respaldo
        // ordenaba el podio con un dato del cliente y con la semántica equivocada.
        return rows.map(r => ({ playerId: r.player, value: r.value, msTaken: r.ms, correct: r.scored ? r.correct : null, points: r.points, v0: r.v0, c0: r.c0, created: r.created, updated: r.updated, scored: r.scored }));
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
        let rows = [];
        try {
          // DESEMPATE por hora de meta (core/liveRank.js): a igualdad de puntos
          // gana quien llegó ANTES — en carrera, quien cruzó la meta primero.
          // El instante lo pone el SERVIDOR (`created`, autodate inmutable), no
          // el `ms` que afirma el móvil (§22): si el desempate dependiera del
          // cliente, bastaría con jurar ms=0 para ganar todos los empates.
          // `ms` = la MISMA fuente que el podio: el tiempo que el SERVIDOR
          // escribió en la fila al liquidarla (el `ms` del cliente queda pisado
          // ahí, §22). Se filtra por scored=true, así que toda fila que llega
          // aquí ya lo tiene. Ojo: NO sirve derivarlo de `created`/`updated` —
          // el PATCH del settle pisa `updated` con la misma hora para toda la
          // clase, y entonces el desempate de la carrera se vuelve aleatorio
          // (medido: el rápido salía 2.º).
          const res = await pbFetch(`/api/collections/${ANS}/records?filter=${pbFilterParam(`session='${pbEscape(sessionId)}' && scored=true`)}&perPage=500&fields=player,points,ms,correct`);
          rows = res?.items || [];   // core/liveRank.js acepta la fila tal cual
        } catch { /* sin respuestas todavía → todos a 0 */ }
        return rankPlayers(players, rows, limit);
      }
      const { engine } = await load(sessionId);
      return engine.leaderboard(limit);
    },

    // Expuestos para otras secciones (§21b: un dueño único de `live_answers`,
    // pero rooms necesita escribir/leer filas suyas — ql_award, settle al cerrar).
    postAnswer,
    getAnswerRow,
    settlePendingInto,
  };
}
