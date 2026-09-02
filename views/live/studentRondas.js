// ALUMNO · bucle RONDAS (§26): pregunta cronometrada → resultado propio.
// Extraído de views/studentLive.js en el corte POR BUCLE (v1.51.628, deuda
// condicionada #2 de CLAUDE.md). `lecturaHechaEn`/`questionTicker`/
// `rescuedIdx`/`rescuedSubmit` son estado PROPIO de este bucle (nadie más los
// lee) y se quedan aquí; `rt.lastQuestionShownAt`/`rt.autoFlushQuestion`/
// `rt.myScore` viajan en `rt` porque el ensamblador o la carrera también los
// tocan.
import { clock } from '../../core/clock.js';
import { serverNow } from '../../core/serverNow.js';
import { questionGate } from '../../core/liveGate.js';
import { startDeadlineTicker } from '../../core/deadlineTicker.js';
import { html, escapeHtml, mount } from '../../core/html.js';
import { getOwnAnswer, leaderboard } from '../../core/liveTransport.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { getTemplate } from '../../core/registry.js';
import { roundPayloadOf } from '../../kernel/session/engine.js';
import { sessionItems } from '../../kernel/content/sessionItems.js';
import { submit as queuedSubmit } from '../../core/submitQueue.js';
import { questionWindowMs, readWindowMs } from '../../core/timings.js';
import { standingOf } from '../../core/liveRank.js';

export function createStudentRondas(rt) {
  let questionTicker = null;   // cronómetro de pregunta (core/deadlineTicker.js)
  let lecturaHechaEn = -1;     // §22-5 · índice del ítem cuya ventana de lectura ya cumplió ESTE móvil
  let rescuedIdx = -1;         // ítem cuyo trazo se rescató (su POST puede ir en vuelo)
  let rescuedSubmit = null;    // promesa de ese POST — paintRevealOwn lo espera
  // Tracks items we've already bumped streak for. Without this, host_seen_at
  // pings re-trigger paintRevealOwn and would replay every ~10 s.
  const revealedItems = new Set();
  // §23 · idx de la pregunta cuya ronda está MONTADA e interactiva (ya pasó la
  // ventana de lectura, el alumno aún no envió). Solo se marca al llegar a la
  // rama jugable de abajo — nunca en la de lectura ni en la de espera.
  let mountedIdx = -1;

  // Único lugar que arranca/reinicia el cronómetro de pregunta: lo llaman tanto
  // el montaje inicial como el atajo de "solo cambió el reloj" (Pausa/Reanudar
  // del host, ~hostRondas.js). Mismo reloj, misma limpieza.
  function startQuestionTicker(deadlineMs, total) {
    questionTicker?.stop();
    questionTicker = startDeadlineTicker({
      deadline: deadlineMs, totalMs: total,
      while: () => rt.session.phase === 'question',
      setIntervalFn: rt.ctx.setInterval,
      onTick: ({ remainSec, pct }) => {
        const t = document.getElementById('s-time');
        const b = document.getElementById('s-bar');
        if (t) t.textContent = `${remainSec}s`;
        if (b) b.style.width = pct + '%';
      },
    });
  }

  async function paintQuestion() {
    const idx = rt.session.current_item;
    // La pausa del host (botón "Pausa"/"Reanudar" de hostRondas.js) SOLO cambia
    // `deadline` en la sala — no de fase ni de pregunta. paint() nos vuelve a
    // llamar porque `deadline` entra en su clave de repintado (studentLive.js).
    // Si la ronda YA está montada e interactiva para esta MISMA pregunta, no hay
    // nada que redibujar: remontar #s-round (tpl.renderRound de nuevo) borraría
    // el trazo en curso del alumno — mismo fallo que el editor (v1.51.642).
    // Lo único que de verdad cambió es el reloj: se reinicia en sitio.
    if (mountedIdx === idx && rt.session.phase === 'question' && document.getElementById('s-round')) {
      const openAtMs = rt.session.answers_open_at ? new Date(rt.session.answers_open_at).getTime() : 0;
      const deadlineMs = rt.session.deadline ? new Date(rt.session.deadline).getTime() : 0;
      const total = (deadlineMs && openAtMs && deadlineMs > openAtMs)
        ? deadlineMs - openAtMs
        : questionWindowMs(rt.activity);
      startQuestionTicker(deadlineMs, total);
      return;
    }
    const items = sessionItems(rt.activity);
    const item = items[idx];
    const own = await getOwnAnswer(rt.session.id, rt.player.playerId, idx);
    if (own) return rt.paintWaiting('Respuesta enviada. Espera al resto.');
    emitGame(GameEvents.QUESTION_SHOWN, { idx, total: items.length, item });
    const streak = Streaks.get(rt.session.id, rt.player.playerId);
    // R-1 · LECTURA (§26 ficha 1b): hasta el instante que manda la SALA, la
    // pregunta se ve pero no se puede tocar. El instante es del servidor, no un
    // temporizador de este móvil: quien entra tarde o recarga no gana tiempo, y
    // el reloj de respuesta (y con él el bonus de velocidad) empieza igual para
    // todos — antes ganaba quien clicaba antes de leer.
    const openAtMs = rt.session.answers_open_at ? new Date(rt.session.answers_open_at).getTime() : 0;
    const deadlineMs = rt.session.deadline ? new Date(rt.session.deadline).getTime() : 0;
    // §22-5 · LA PUERTA, con hora común Y con tope (core/liveGate.js): un móvil
    // desfasado ya no puede quedarse encerrado en «Preparados…» mientras la
    // pregunta se liquida sin su respuesta. La espera nunca supera la ventana
    // de lectura declarada por la actividad, y si la pregunta ya cerró no se
    // hace leer a nadie.
    // Ya esperé MI ventana de lectura de esta pregunta: no se vuelve a esperar.
    // Sin esto, un reloj muy desfasado repetiría la espera acotada una y otra
    // vez (el instante de la sala sigue "en el futuro" para este aparato) y el
    // alumno no llegaría a responder nunca — que es el fallo que veníamos a
    // arreglar, disfrazado de cuentas atrás cortas.
    // El tope sale de LA SALA (`read_secs`, lo escribe openQuestion con el dial
    // del lobby): la actividad solo es respaldo para salas de antes del campo.
    const readMs = lecturaHechaEn === idx ? 0
      : (Number.isFinite(rt.session.read_secs) ? rt.session.read_secs * 1000 : readWindowMs(rt.activity));
    const { reading, waitMs } = questionGate({
      openAtMs, deadlineMs, now: serverNow(), readMs,
    });
    // El ms se mide desde la apertura REAL de respuestas (no desde que este
    // móvil pintó): misma referencia que el sello del servidor (§22-1).
    rt.lastQuestionShownAt = openAtMs || serverNow();
    // MISMA ventana que el host y que el bonus de velocidad (core/timings.js):
    // antes cada uno tenía su copia y award.js omitía el piso de 5 → el reloj del
    // alumno podía no coincidir con el deadline real del servidor.
    // La barra mide la ventana REAL de esta pregunta: la distancia entre los dos
    // instantes de la sala. Con tiempo por pregunta (R-3) leer la ventana de la
    // actividad daría una barra que no cuadra con el reloj — y además así el
    // alumno no necesita que los segundos viajen en el snapshot (§22-2).
    const total = (deadlineMs && openAtMs && deadlineMs > openAtMs)
      ? deadlineMs - openAtMs
      : questionWindowMs(rt.activity);
    // The DEVICE renders the round via the template contract (same as VS),
    // so every template — quiz, tildes, comas, math… — works without a
    // per-template branch here. The host's projector shows the prompt.
    const tpl = getTemplate(rt.activity.template);
    const payload = roundPayloadOf(tpl, rt.activity, idx, item);
    mount(rt.rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-info text-dark">Pregunta ${idx+1} / ${items.length}</span>
        ${streak >= 2 ? `<span class="badge bg-warning text-dark fs-5">🔥 ${streak}</span>` : ''}
        <span id="s-time" class="badge bg-warning text-dark fs-5"></span>
      </div>
      <div class="progress mb-3" style="height:6px"><div id="s-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <div id="s-round"></div>
    `);
    if (reading) {
      // Se pinta la ronda para poder LEERLA, con la interacción bloqueada y la
      // cuenta atrás; al llegar el instante se repinta ya jugable (guard de
      // fase: si el profe avanzó mientras tanto, no se pisa la pantalla nueva).
      const el = document.getElementById('s-round');
      el.classList.add('s-reading');
      try { tpl.renderRound(el, payload, { mode: 'live', onSubmit: () => {} }); } catch { /* payload raro: la cuenta atrás sigue */ }
      const badge = document.getElementById('s-time');
      // El objetivo se fija UNA vez con el reloj de este móvil a partir de la
      // espera ya acotada: así la cuenta atrás siempre llega a 0, aunque el
      // instante de la sala fuera absurdo.
      const abreEn = clock.now() + waitMs;
      const tick = rt.ctx.setInterval(() => {
        const left = Math.ceil((abreEn - clock.now()) / 1000);
        if (badge) badge.textContent = `Preparados… ${Math.max(0, left)}`;
        if (left <= 0) {
          clearInterval(tick);
          lecturaHechaEn = idx;
          if (rt.session.phase === 'question' && rt.session.current_item === idx) paintQuestion();
        }
      }, 200);
      return;
    }
    let sent = false;
    const handle = tpl.renderRound(document.getElementById('s-round'), payload, {
      mode: 'live',
      onSubmit: async (value) => {
        if (sent) return;
        sent = true;
        const ms = serverNow() - rt.lastQuestionShownAt;
        const p = queuedSubmit(rt.session.id, rt.player.playerId, idx, value, ms);
        rescuedSubmit = p;   // paintRevealOwn puede esperar este POST si hizo falta rescatar
        const r = await p;
        // Solo pintar "esperando" si SEGUIMOS en la pregunta: cuando este submit
        // es el rescate de autoFlushQuestion, la fase ya cambió y paint() ya montó
        // el reveal/podio — pintarle "¡Respuesta enviada!" encima lo pisaba.
        if (rt.session.phase === 'question') {
          // `rejected` = el servidor dijo NO (credencial del dispositivo perdida,
          // §22-4). Reintentar no sirve: hay que volver a entrar a la sala. Se
          // dice, en vez de mostrar un "se enviará al reconectar" que no pasará.
          if (r.rejected) {
            sent = false;   // que pueda reintentar tras volver a entrar
            rt.paintWaiting('El servidor no aceptó tu respuesta. Vuelve a entrar a la sala con el PIN.');
          } else {
            rt.paintWaiting(r.queued ? 'Respuesta guardada (sin red). Se enviará al reconectar.' : '¡Respuesta enviada!');
          }
        }
      }
    });
    // Rescate del trazo en curso: si el profe avanza antes de que el alumno pulse
    // "Listo", la plantilla entrega lo dibujado vía el handle `{ flush }` de su
    // renderRound (capacidad del CONTRATO — Tildes/Comas la implementan; quiz no
    // devuelve handle → no-op). Nada de querySelector a clases internas.
    rt.autoFlushQuestion = () => {
      if (sent || !handle?.flush) return;
      rescuedIdx = idx;
      handle.flush();
    };

    // La ronda queda montada e interactiva para ESTE ítem: un repintado
    // posterior que solo cambie el reloj (pausa/reanudar) usa el atajo de
    // arriba en vez de volver a llamar a tpl.renderRound().
    mountedIdx = idx;
    // Cronómetro compartido (core/deadlineTicker.js): mismo reloj que el host,
    // con clock.now() y auto-parada cuando la fase cambia — antes era un
    // setInterval propio con clock.now() y limpieza a mano.
    startQuestionTicker(deadlineMs, total);
  }

  async function paintRevealOwn() {
    const idx = rt.session.current_item;
    let own = await getOwnAnswer(rt.session.id, rt.player.playerId, idx);
    // Si acabamos de RESCATAR el trazo de este ítem (autoFlushQuestion), su POST
    // puede seguir en vuelo mientras este GET ya respondió null → saldría "Sin
    // respuesta" al alumno que sí respondió (y lastPhaseKey no repinta). En vez
    // de un sleep a ciegas, esperamos la promesa REAL del submit y re-leemos.
    if (!own && rescuedIdx === idx && rescuedSubmit) {
      try { await rescuedSubmit; } catch { /* la cola offline ya lo tiene */ }
      rescuedIdx = -1; rescuedSubmit = null;
      if (rt.session.current_item !== idx || rt.session.phase !== 'reveal') return;
      own = await getOwnAnswer(rt.session.id, rt.player.playerId, idx);
    }
    const ok = own?.correct === true;
    const skipped = !own;
    // NO PUNTUABLE (deuda C): el ítem no tiene clave y los puntos los pone el
    // profe. Antes se pintaba "Incorrecto" a toda la clase por no haber respuesta
    // que comparar — decirle a un niño que falló cuando no había nada que acertar.
    const unscored = !!own && own.correct == null;
    // Bump streak ONCE per item. No per-question sounds or confetti in live
    // mode — celebration happens only at the end. Subsequent paints for the
    // same idx (caused by unrelated session UPDATEs) skip the side effects.
    if (own && !revealedItems.has(idx)) {
      revealedItems.add(idx);
      rt.myScore += own.points || 0;
      // Un ítem no puntuable no rompe la racha (ni la sube): no hubo acierto ni
      // fallo que juzgar.
      if (!unscored) Streaks.bump(rt.session.id, rt.player.playerId, ok);
    }
    const streak = Streaks.get(rt.session.id, rt.player.playerId);
    // R-2 · TU PUESTO Y TU DISTANCIA (el motor de enganche de los concursos): el
    // alumno veía "+80 puntos" y nada más — ni dónde está ni cuánto le falta.
    // Sale del leaderboard DERIVADO del servidor (misma fuente que el podio),
    // así que no puede discrepar de la pizarra. Fail-soft: si no llega, la
    // pantalla se pinta igual sin esa línea.
    let standing = null;
    try {
      // El cálculo vive en el DUEÑO del ranking (§21) y es puro, así que su test
      // comprueba números en vez de citar estas líneas.
      standing = standingOf(await leaderboard(rt.session.id, 100), rt.player.playerId);
    } catch { /* sin marcador: se pinta el resultado igual */ }
    // El empate se DICE, y se dice IGUAL a los dos: el puesto ya es compartido
    // (core/liveRank.js), así que la frase solo lo explica.
    const empateTxt = !standing || !standing.tied ? '' :
      (standing.tied === 1
        ? `empatado con ${escapeHtml(standing.tiedName || '')}`
        : `empatado con ${standing.tied} más`);
    const standingHtml = !standing ? '' : `
      <p class="h5 mt-3 mb-0">${standing.rank}º de ${standing.total} · ${standing.score} pts</p>
      ${standing.aboveName
        ? `<p class="text-muted">a ${standing.gap} ${standing.gap === 1 ? 'punto' : 'puntos'} de ${escapeHtml(standing.aboveName)}${empateTxt ? ` · ${empateTxt}` : ''}</p>`
        : `<p class="text-muted">${empateTxt ? `vas primero, ${empateTxt}` : '¡vas primero!'}</p>`}`;
    mount(rt.rootSel, html`
      <div class="text-center py-5">
        ${skipped
          ? `<i class="bi bi-dash-circle display-1 text-secondary"></i><h2 class="mt-3">Sin respuesta</h2>`
          : unscored
            ? `<i class="bi bi-hand-thumbs-up display-1 text-info"></i><h2 class="mt-3">¡Respuesta enviada!</h2><p class="text-muted">La valora tu profe.</p>`
            : ok
              ? `<i class="bi bi-check-circle-fill display-1 text-success"></i><h2 class="mt-3">¡Correcto!</h2>`
              : `<i class="bi bi-x-circle-fill display-1 text-danger"></i><h2 class="mt-3">Incorrecto</h2>`}
        <p class="lead">+${own?.points || 0} puntos</p>
        ${ok && streak >= 2 ? `<p class="h4">🔥 Racha de ${streak}</p>` : ''}
        ${standingHtml}
      </div>
    `);
  }

  return { paintQuestion, paintRevealOwn };
}
