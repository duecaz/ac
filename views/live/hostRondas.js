// HOST · bucle RONDAS (§26): pregunta → revelar → clasificación, avance manual
// o automático. Extraído de views/hostLive.js en el corte POR BUCLE (v1.51.628,
// deuda condicionada #2 de CLAUDE.md). `tickHandle`/`settling`/`paused`/
// `pauseRemainMs`/`prevRanks` son estado PROPIO de este bucle (nadie más los
// lee) y se quedan aquí; `rt.openQuestion` sigue en el ensamblador porque
// también lo llama el lobby (arrancar en 'rounds').
import { clock } from '../../core/clock.js';
import { serverNow } from '../../core/serverNow.js';
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { setSessionState, endSession, settleItem, listAnswers, leaderboard } from '../../core/liveTransport.js';
import { roundPayloadOf } from '../../kernel/session/engine.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../../core/fullscreen.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { toast, confirmModal, TOAST_NORMAL } from '../../core/toast.js';

export function createHostRondas(rt) {
  let tickHandle = null;
  let settling = false;
  let paused = false;
  let pauseRemainMs = 0;
  let prevRanks = null;   // puestos de la ronda anterior (R-4)

  async function paintQuestion(phaseChanged = true) {
    const idx = rt.session.current_item;
    const item = rt.items[idx];
    if (phaseChanged) {
      emitGame(GameEvents.LOBBY_END);
      emitGame(GameEvents.QUESTION_SHOWN, { idx, total: rt.items.length, item });
    }
    rt.answers = await listAnswers(rt.sessionId, idx);
    const total = rt.players.length;
    const answered = rt.answers.length;
    const deadline = rt.session.deadline ? new Date(rt.session.deadline).getTime() : serverNow() + rt.timerSec * 1000;
    let payload;
    try {
      payload = roundPayloadOf(rt.tpl, rt.activity, idx, item);
    } catch (err) {
      console.warn('[hostLive] getRoundPayload threw — falling back to item:', err);
      payload = item;
    }
    mount(rt.rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary fs-6">Pregunta ${idx + 1} / ${rt.items.length}</span>
        <span id="time-left" class="badge bg-warning text-dark fs-5"></span>
        <span class="badge bg-info text-dark fs-6"><i class="bi bi-check2-circle"></i> <span id="ans-count">${answered}</span> / ${total}</span>
      </div>
      <div class="progress mb-3" style="height:8px"><div id="time-bar" class="progress-bar bg-warning" style="width:100%"></div></div>
      <div id="host-round" class="mb-4"></div>
      <div class="text-center d-flex gap-2 justify-content-center flex-wrap">
        <button class="btn btn-warning btn-lg" id="btn-reveal"><i class="bi bi-stop-fill"></i> Bloquear y revelar</button>
        <button class="btn btn-outline-secondary btn-lg" id="btn-pause"><i class="bi ${paused?'bi-play-fill':'bi-pause-fill'}"></i> ${paused?'Reanudar':'Pausa'}</button>
        <button class="btn btn-outline-secondary btn-lg" id="btn-skip" title="Saltar pregunta sin puntuar"><i class="bi bi-skip-forward-fill"></i> Saltar</button>
        ${fullscreenButtonHtml()}
      </div>
    `);
    // R-1 · LECTURA: hasta `answers_open_at` la pizarra muestra el enunciado
    // pero NO las opciones (clase `.hl-reading`), y el badge dice "Preparados".
    // Al llegar el instante se quita la clase — el mismo instante que desbloquea
    // los móviles, así nadie responde antes de que se vea la pregunta.
    const openAtMs = rt.session.answers_open_at ? new Date(rt.session.answers_open_at).getTime() : 0;
    try {
      rt.tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'question', item, payload });
      const hr = document.getElementById('host-round');
      if (hr && openAtMs > serverNow()) {
        hr.classList.add('hl-reading');
        rt.ctx.setTimeout(() => hr.classList.remove('hl-reading'), Math.max(0, openAtMs - serverNow()));
      }
    } catch (err) {
      console.error('[hostLive] renderRoundHost threw:', err);
      const el = document.getElementById('host-round');
      if (el) el.innerHTML = `<div class="alert alert-danger m-3">Error al mostrar pregunta ${idx + 1}: verifique el contenido de la actividad.</div>`;
    }
    attachFullscreenButton(rt.rootSel);

    on(rt.rootSel, 'click', '#btn-reveal', () => doSettle(idx));
    on(rt.rootSel, 'click', '#btn-pause', async () => {
      if (paused) {
        // Resume: extend deadline by the pauseRemainMs we saved.
        const newDeadline = new Date(serverNow() + pauseRemainMs).toISOString();
        await setSessionState(rt.sessionId, { deadline: newDeadline });
        paused = false;
      } else {
        pauseRemainMs = Math.max(0, deadline - serverNow());
        await setSessionState(rt.sessionId, { deadline: null });
        paused = true;
      }
    });
    on(rt.rootSel, 'click', '#btn-skip', async () => {
      const ok = await confirmModal('¿Saltar esta pregunta? Se cerrará sin puntuar.', { okText: 'Saltar', danger: false });
      if (!ok) return;
      const isLast = idx + 1 >= rt.items.length;
      // Saltar abre la siguiente por el MISMO camino que el resto (openQuestion):
      // si no, esa pregunta se abriría sin ventana de lectura y con el reloj ya
      // corriendo — el hueco que cazó tests/roundsLoop.test.mjs.
      if (isLast) await endSession(rt.sessionId);
      else await rt.openQuestion(idx + 1);
    });

    if (tickHandle) clearInterval(tickHandle);
    let pollBusy = false, lastPoll = 0;
    tickHandle = rt.ctx.setInterval(() => {
      if (rt.session.phase !== 'question') { clearInterval(tickHandle); tickHandle = null; return; }
      // Poll the answer count (~every 1.2s). With answers in their own collection,
      // a student's submit no longer touches the session record, so the SSE that
      // drives `answers` doesn't fire — without this the count would freeze and
      // auto-advance-on-all-answered would never trigger. Harmless in blob mode
      // too (covers the occasional coalesced/missed SSE event).
      if (!pollBusy && clock.now() - lastPoll > 1200) {
        pollBusy = true; lastPoll = clock.now();
        listAnswers(rt.sessionId, idx).then(a => { rt.answers = a; }).catch(() => {}).finally(() => { pollBusy = false; });
      }
      // If host paused (deadline cleared server-side), freeze the bar.
      if (!rt.session.deadline) {
        const t = document.getElementById('time-left');
        const ac = document.getElementById('ans-count');
        if (t) t.textContent = 'Pausa';
        if (ac) ac.textContent = String(rt.answers.length);
        return;
      }
      // Durante la LECTURA el reloj de respuesta aún no corre: se muestra la
      // cuenta atrás de "preparados" y no se liquida por tiempo.
      const readLeft = openAtMs - serverNow();
      if (readLeft > 0) {
        const t0 = document.getElementById('time-left');
        if (t0) t0.textContent = `Preparados… ${Math.ceil(readLeft / 1000)}`;
        const b0 = document.getElementById('time-bar');
        if (b0) b0.style.width = '100%';
        return;
      }
      const liveDeadline = new Date(rt.session.deadline).getTime();
      const remain = Math.max(0, liveDeadline - serverNow());
      // La ventana sale de los DOS INSTANTES de la sala, igual que en el móvil
      // (`views/studentLive.js`), no de la de la actividad: con R-3 (tiempo por
      // pregunta) el cierre lo fija `itemWindowMs` y el denominador se quedaba
      // en el de la actividad — con un ítem de 30 s y actividad de 20 la barra
      // se quedaba LLENA los primeros 10 s y luego caía de golpe. El número era
      // correcto y la barra mentía, que es peor que no tenerla.
      const ventanaMs = (openAtMs && liveDeadline > openAtMs)
        ? liveDeadline - openAtMs
        : rt.timerSec * 1000;
      const pct = Math.max(0, Math.min(100, 100 * remain / ventanaMs));
      const t = document.getElementById('time-left');
      const bar = document.getElementById('time-bar');
      const ac = document.getElementById('ans-count');
      if (t) t.textContent = `${Math.ceil(remain / 1000)}s`;
      if (bar) bar.style.width = pct + '%';
      if (ac) ac.textContent = String(rt.answers.length);
      // Auto-advance triggers. P2-9: honrar la elección de "Automático" del lobby
      // (`autoAdvance`, runtime) además del `advanceMode` estático de la actividad;
      // antes elegir "Automático" no liquidaba al responder todos porque solo se
      // miraba `advanceMode`, que el <select> del lobby no cambia.
      const allAnswered = total > 0 && rt.answers.length >= total;
      if (allAnswered && (rt.autoAdvance || rt.advanceMode === 'autoOnAllAnswered' || rt.live.lockAnswersOn === 'allAnswered')) {
        return doSettle(idx);
      }
      if (remain <= 0 && (rt.advanceMode === 'autoOnTimer' || rt.advanceMode === 'autoOnAllAnswered' || rt.advanceMode === 'manual')) {
        // Even in manual, expiring the timer settles to avoid stuck rooms.
        return doSettle(idx);
      }
    }, 250);
  }

  async function doSettle(idx) {
    if (settling || rt.session.phase !== 'question') return;
    settling = true;
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    const btn = document.getElementById('btn-reveal');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Calculando…'; }
    try { await settleItem(rt.sessionId, idx); }
    catch (e) {
      toast('Error al revelar: ' + e.message, 'danger', TOAST_NORMAL);
      if (btn) { btn.disabled = false; btn.innerHTML = 'Reintentar'; }
    } finally { settling = false; }
  }

  async function paintReveal(phaseChanged = true) {
    const idx = rt.session.current_item;
    const item = rt.items[idx];
    if (phaseChanged) emitGame(GameEvents.REVEAL, { idx, item });
    rt.answers = await listAnswers(rt.sessionId, idx);

    // Build name map: answer value → [playerName, …] for each option.
    const playerById = Object.fromEntries(rt.players.map(p => [p.id, p.name]));
    const playerMap = {};
    rt.answers.forEach(a => {
      const pid = a.playerId || a.player_id;
      const name = playerById[pid];
      if (name) {
        const val = String(a.value);
        (playerMap[val] = playerMap[val] || []).push(name);
      }
    });

    const isLast = idx + 1 >= rt.items.length;
    // «Mostrar respuesta tras cada» del panel: la pantalla de revelado (que es
    // la que ENSEÑA la respuesta correcta y quién eligió qué) se pintaba
    // siempre, así que el interruptor no hacía nada. Apagado, se pasa de largo
    // — la última sí se revela: cerrar la ronda sin decir la respuesta deja la
    // clase a medias.
    if (!isLast && rt.live.showAnswerAfterEach === false) {
      if (rt.live.showLeaderboardBetween !== false) setSessionState(rt.sessionId, { phase: 'leaderboard' });
      else rt.openQuestion(idx + 1);
      return;
    }
    // «Leaderboard entre preguntas» del panel: estaba escrito por el editor y no
    // lo leía nadie — la clasificación se pintaba SIEMPRE, así que apagarlo no
    // hacía nada. Al final de la ronda se enseña igualmente (ahí es el podio).
    const conClasificacion = isLast || rt.live.showLeaderboardBetween !== false;
    mount(rt.rootSel, html`
      <div id="host-round" class="mb-4"></div>
      <div class="text-center">
        <button class="btn btn-primary btn-lg" id="btn-lb">
          <i class="bi ${conClasificacion ? 'bi-bar-chart-fill' : 'bi-arrow-right-circle-fill'}"></i>
          <span id="btn-lb-txt">${conClasificacion
            ? (isLast ? 'Ver clasificación final' : 'Ver clasificación')
            : 'Siguiente pregunta'}</span>
        </button>
      </div>
    `);
    rt.tpl.renderRoundHost(document.getElementById('host-round'), { phase: 'reveal', item, answers: rt.answers, playerMap });
    // Sin clasificación intermedia se va DIRECTO a la siguiente pregunta, que
    // es lo que el profe pidió al apagar el interruptor. La última siempre pasa
    // por la clasificación: ahí es el podio.
    const seguir = () => (conClasificacion
      ? setSessionState(rt.sessionId, { phase: 'leaderboard' })
      : rt.openQuestion(idx + 1));
    on(rt.rootSel, 'click', '#btn-lb', seguir);

    // Auto-advance countdown: tick down in the button text, then trigger leaderboard.
    if (rt.autoAdvance && phaseChanged) {
      let secs = 4;
      const tick = rt.ctx.setInterval(() => {
        if (rt.session.phase !== 'reveal') { clearInterval(tick); return; }
        secs--;
        const t = document.getElementById('btn-lb-txt');
        if (t) t.textContent = conClasificacion
          ? (isLast ? `Clasificación final (${secs}s)` : `Clasificación (${secs}s)`)
          : `Siguiente pregunta (${secs}s)`;
        if (secs <= 0) { clearInterval(tick); seguir(); }
      }, 1000);
    }
  }

  async function paintLeaderboard(phaseChanged = true) {
    const lb = await leaderboard(rt.sessionId, 10);
    // R-4 · MOVIMIENTO: la tabla estática no cuenta nada; una flecha sí ("subió
    // dos"). Se compara con el orden de la ronda anterior, que se guarda aquí
    // mismo (nada que persistir: si el host recarga, simplemente no hay flechas
    // en la primera tabla que pinte).
    const move = (id) => {
      if (!prevRanks || !prevRanks.has(id)) return '';
      const before = prevRanks.get(id);
      const now = lb.findIndex(p => p.id === id) + 1;
      if (now < before) return `<span class="text-success" title="subió ${before - now}"><i class="bi bi-caret-up-fill"></i></span>`;
      if (now > before) return `<span class="text-danger" title="bajó ${now - before}"><i class="bi bi-caret-down-fill"></i></span>`;
      return '<span class="text-muted">·</span>';
    };
    const idx = rt.session.current_item;
    const isLast = idx + 1 >= rt.items.length;
    mount(rt.rootSel, html`
      <h2 class="text-center mb-4"><i class="bi bi-bar-chart-fill"></i> Clasificación</h2>
      <div class="ww-leaderboard mx-auto" style="max-width:600px">
        ${lb.map((p, i) => `
          <div class="row align-items-center bg-dark text-light rounded mb-2 p-2">
            <div class="col-1"><b>${i+1}</b></div>
            <div class="col-1">${move(p.id)}</div>
            <div class="col-6">${escapeHtml(p.name)}</div>
            <div class="col-4 text-end"><b>${p.score}</b> pts</div>
          </div>`).join('')}
      </div>
      <div class="text-center mt-4">
        ${isLast
          ? `<button class="btn btn-warning btn-lg" id="btn-end"><i class="bi bi-trophy-fill"></i> Terminar y mostrar podio</button>`
          : `<button class="btn btn-primary btn-lg" id="btn-next"><i class="bi bi-arrow-right"></i> <span id="btn-next-txt">Siguiente pregunta</span></button>`}
      </div>
    `);
    prevRanks = new Map(lb.map((p, i) => [p.id, i + 1]));   // para las flechas de la próxima
    on(rt.rootSel, 'click', '#btn-next', () => rt.openQuestion(idx + 1));
    on(rt.rootSel, 'click', '#btn-end', () => endSession(rt.sessionId));

    // Auto-advance to next question after 5s (only between questions, not on the last).
    if (rt.autoAdvance && !isLast && phaseChanged) {
      let secs = 5;
      const tick = rt.ctx.setInterval(() => {
        if (rt.session.phase !== 'leaderboard') { clearInterval(tick); return; }
        secs--;
        const t = document.getElementById('btn-next-txt');
        if (t) t.textContent = `Siguiente pregunta (${secs}s)`;
        if (secs <= 0) { clearInterval(tick); rt.openQuestion(idx + 1); }
      }, 1000);
    }
  }

  return { paintQuestion, paintReveal, paintLeaderboard };
}
