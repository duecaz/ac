// ALUMNO · bucle CARRERA (§26): cola de ítems a mi ritmo, un fallo VUELVE A LA
// COLA (racePassed — la vara es la hoja COMPLETA). Extraído de
// views/studentLive.js en el corte POR BUCLE (v1.51.628, deuda condicionada #2
// de CLAUDE.md). `raceFirstSent`/`raceSeed` son estado PROPIO de este bucle;
// `rt.raceQueue`/`rt.raceCorrectCount`/`rt.raceFinishMs` viajan en `rt` porque
// el informe final (views/live/studentFin.js) también los lee.
import { serverNow } from '../../core/serverNow.js';
import { startDeadlineTicker } from '../../core/deadlineTicker.js';
import { html, escapeHtml, mount } from '../../core/html.js';
import { listOwnAnswers, submitRaceAttempt } from '../../core/liveTransport.js';
import { raceResumeState } from '../../core/raceResume.js';
import { toast } from '../../core/toast.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { getTemplate } from '../../core/registry.js';
import { sessionItems, roundPayloadOf } from '../../kernel/session/engine.js';
import { hasClientKey } from '../../core/liveSnapshot.js';
import { RACE_FLASH_MS, mmss } from '../../core/timings.js';
import { pointsModeFor, racePassed } from '../../core/liveLoops.js';
import { endPolicyOf, waitingInfo } from '../../core/liveEnd.js';

export function createStudentCarrera(rt) {
  let raceFirstSent = new Set();  // ítems cuyo PRIMER intento ya se envió (análisis)
  let raceSeed = null;            // promesa de la siembra de la cola (una sola vez)

  function paintRace() {
    const allItems = sessionItems(rt.activity);
    const tpl = getTemplate(rt.activity.template);

    // SIN CLAVE NO SE JUZGA (§22). En carrera el veredicto lo da este móvil, así
    // que necesita la actividad completa; la sala la sube al arrancar, pero
    // puede tardar en llegar (o fallar el PATCH). Sin este guard, `scoreSubmission`
    // sobre un ítem vacío devolvía `correct:false` SIEMPRE: la hoja perfecta
    // sonaba a error y volvía a la cola — la carrera no terminaba nunca. Antes
    // que castigar al alumno por un fallo nuestro, se espera.
    if (!hasClientKey(rt.activity)) {
      mount(rt.rootSel, html`
        <div class="text-center py-5">
          <div class="spinner-border text-warning"></div>
          <p class="mt-3">Preparando la carrera…</p>
        </div>`);
      rt.refreshSession();
      return;
    }

    if (rt.raceQueue === null) {
      // REANUDAR, no reiniciar (bug real de la primera partida): una recarga a
      // mitad de carrera (F5, el móvil descartando la página al bloquear, o la
      // auto-actualización de versión) perdía la cola en memoria y el alumno
      // repetía TODO. La cola se siembra desde sus propias filas del servidor:
      // lo ya acertado no vuelve; los fallados y los nuevos sí
      // (core/raceResume.js). Sin red/sin filas → carrera desde cero, como antes.
      if (!raceSeed) {
        raceSeed = listOwnAnswers(rt.session.id, rt.player.playerId)
          .catch(() => [])
          .then((rows) => {
            const s = raceResumeState(sessionItems(rt.activity).length, rows);
            rt.raceQueue = s.queue;
            rt.raceCorrectCount = s.correctCount;
            raceFirstSent = s.firstSent;
            // Tras una recarga POST-meta, la hora real sale de las filas del
            // servidor — no del reloj de "ahora" (revisión v1.51.432).
            if (s.finishMs != null) rt.raceFinishMs = s.finishMs;
            // ctx.setTimeout: si el alumno navegó (o el profe cerró) mientras la
            // siembra estaba en vuelo, no pintar sobre otra vista/fase.
            rt.ctx.setTimeout(() => { if (rt.session.phase === 'race') paintRace(); }, 0);
          });
      }
      mount(rt.rootSel, html`<div class="text-center py-5"><div class="spinner-border text-warning"></div></div>`);
      return;
    }

    if (rt.raceQueue.length === 0) {
      // C-1 · El que termina primero ya no mira un "esperando…" mudo: se le dice
      // QUÉ se espera, según la política declarada en la sala (core/liveEnd.js).
      // Con tiempo límite ve el mismo reloj que la pizarra (instante de la sala,
      // no un contador propio).
      const { policy, n, deadlineMs } = endPolicyOf(rt.session);
      // El alumno no lee la lista de jugadores (§21): se le dice la REGLA, no un
      // número inventado. El conteo exacto lo ve el profe en la pizarra.
      const info = waitingInfo({ policy, n });
      // TU HORA DE META: es lo que decide la carrera (todos acaban con todas
      // bien), así que el alumno tiene que verla — si no, el orden del podio le
      // llega sin explicación. APROXIMADA a propósito: sale del reloj del móvil,
      // mientras que la que ORDENA la mide el servidor (§22). Puede bailar un
      // segundo; por eso se marca como "tu tiempo" y no como el oficial.
      const startMs = rt.session.started_at ? Date.parse(rt.session.started_at) : 0;
      // Se CONGELA la primera vez que la cola queda vacía: si se recalculara en
      // cada repintado, el "tu tiempo" seguiría subiendo mientras se espera.
      if (rt.raceFinishMs == null && startMs) rt.raceFinishMs = serverNow() - startMs;
      const myFinish = rt.raceFinishMs != null ? mmss(rt.raceFinishMs, Math.floor) : null;
      mount(rt.rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-trophy-fill display-1 text-warning"></i>
          <h2 class="mt-3">¡Terminaste!</h2>
          <p class="lead">${rt.raceCorrectCount} / ${allItems.length} correctas${myFinish ? ` · <strong title="Tu tiempo (aprox.). La clasificación usa el reloj del servidor.">${myFinish}</strong>` : ''}</p>
          <p class="text-muted">${escapeHtml(info.text)}</p>
          ${info.showClock ? '<div class="h3" id="race-left">—</div>' : '<div class="spinner-border text-warning mt-2"></div>'}
        </div>
      `);
      if (info.showClock && deadlineMs) {
        // Primitivo compartido (§23): reloj hasta un instante del servidor, con
        // guard de fase para que no repinte encima del podio.
        startDeadlineTicker({
          deadline: deadlineMs, ctx: rt.ctx,
          while: () => rt.session.phase === 'race' && !!document.getElementById('race-left'),
          onTick: (leftMs) => {
            const el = document.getElementById('race-left');
            // `Math.ceil`: en una cuenta atrás, mostrar 0:00 con un segundo aún
            // por correr le dice al alumno que se acabó cuando no se ha acabado.
            if (el) el.textContent = mmss(leftMs, Math.ceil);
          },
        });
      }
      return;
    }

    const idx = rt.raceQueue[0];
    const payload = roundPayloadOf(tpl, rt.activity, idx, allItems[idx]);
    const streak = Streaks.get(rt.session.id, rt.player.playerId);
    rt.lastQuestionShownAt = serverNow();
    const total = allItems.length;
    emitGame(GameEvents.QUESTION_SHOWN, { idx, total, item: allItems[idx] });

    // UNA SOLA BARRA (dueño, 2026-08-14, con captura): los chips de la carrera
    // (aciertos · racha · restantes) se le OFRECEN a la ronda por su contrato
    // (`opts.chips`). Si la plantilla trae su propia barra (Tildes/Comas la
    // tienen, con Lápiz/Borrador), los integra y responde `chromePropio` — y
    // esta vista NO pinta su fila encima: dos barras apiladas era el fallo.
    // Si la plantilla no sabe de chips, la vista pinta su fila como siempre.
    // La vista sigue sin conocer plantillas concretas (§0): pregunta, no adivina.
    // TEXTO PLANO, sin HTML: los chips van al HUD de las esquinas
    // (core/playerHud.js), que escapa su contenido — un icono de Bootstrap aquí
    // se vería como texto literal. El respaldo de abajo (plantillas sin barra
    // propia) construye sus badges aparte.
    const chips = {
      left: `✓ ${rt.raceCorrectCount}/${total}` + (streak >= 2 ? ` · 🔥 ${streak}` : ''),
      right: `${rt.raceQueue.length} restantes`,
    };
    mount(rt.rootSel, html`<div id="s-race-extra"></div><div id="s-round"></div>`);

    let sent = false;
    const ronda = tpl.renderRound(document.getElementById('s-round'), payload, {
      mode: 'live',
      chips,
      onSubmit: (value) => {
        if (sent) return;
        sent = true;
        const ms = serverNow() - rt.lastQuestionShownAt;

        // Score locally (activity_snap contains full answers on PocketBase).
        let ok = false;
        let pts = 0;
        let faltan = null;   // detalle de lo que faltó, si la hoja vuelve a la cola
        try {
          // El modelo de puntos lo decide el BUCLE (core/liveLoops.js), igual que
          // el settle del servidor — si aquí se estimara distinto, el alumno
          // vería un puntaje que el podio luego desmiente.
          const r = tpl.scoreSubmission({ value, item: allItems[idx], msTaken: ms, activity: rt.activity, mode: pointsModeFor(rt.session.loop || 'race') });
          // En CARRERA la vara es COMPLETA (§26 · `racePassed`): una hoja de
          // Tildes a medias VUELVE A LA COLA en vez de darse por superada — si
          // no, el podio ordena por hora de meta a gente que no hizo lo mismo.
          ok = racePassed(r);
          pts = ok ? (r.points || 0) : 0;
          faltan = ok ? null : r;
        } catch (err) {
          // No se pudo juzgar (ítem sin clave pese al guard, o scorer roto). NO
          // se puede decir "mal": se deja pasar sin puntos y se avisa. Un fallo
          // nuestro no puede costarle la carrera al alumno.
          console.warn('[studentLive] carrera: no se pudo puntuar en local —', err);
          ok = true; pts = 0;
        }

        // Color the selected button in-place — no DOM replacement, same as solo player.
        const roundEl = document.getElementById('s-round');
        if (roundEl) {
          const picked = [...roundEl.querySelectorAll('.rq-opt')].find(b => b.dataset.value === value)
                        || roundEl.querySelector('.rq-picked');
          if (picked) picked.classList.add(ok ? 'btn-success' : 'btn-danger');
        }

        // Advance queue and score.
        rt.raceQueue.shift();
        if (!ok) rt.raceQueue.push(idx);
        else { rt.raceCorrectCount++; rt.myScore += pts; }
        const newStreak = Streaks.bump(rt.session.id, rt.player.playerId, ok);

        // Sound events (correct/wrong chime).
        if (ok) emitGame(GameEvents.ANSWER_CORRECT, { idx, points: pts, streak: newStreak });
        else    emitGame(GameEvents.ANSWER_WRONG, { idx });

        // POR QUÉ vuelve a la cola. Sin esto, una hoja de Tildes a medias
        // reaparecía sin explicación y el alumno repetía el mismo error a
        // ciegas. El detalle sale del SCORER (aciertos · de más), no de una
        // cuenta propia de esta vista.
        if (!ok && faltan && Number.isFinite(faltan.total) && faltan.total > 1) {
          const sinMarcar = Math.max(0, faltan.total - (faltan.hits || 0));
          const partes = [];
          if (sinMarcar) partes.push(`${sinMarcar} sin marcar`);
          if (faltan.over) partes.push(`${faltan.over} de más`);
          if (partes.length) toast(`Casi: ${partes.join(' · ')}. Vuelve a intentarlo.`, 'warning', 2500);
        }

        // Analítica opción A: el PRIMER intento de cada ítem (bien o mal) se envía
        // SIEMPRE → captura v0/c0 (el error real) para el análisis de clase. Los
        // reintentos posteriores solo se envían si son CORRECTOS, para avanzar el
        // progreso del host. submitRaceAttempt no cambia el juego: preserva v0/c0
        // (inmutable) y solo mueve value/correct al acertar. Ver docs/historico/handoff-analitica-items.md.
        const firstForItem = !raceFirstSent.has(idx);
        if (firstForItem || ok) {
          raceFirstSent.add(idx);
          submitRaceAttempt(rt.session.id, rt.player.playerId, idx, value, ok, pts, ms).catch(() => {});
        }

        // Brief pause to see the color flash, then load next question. Guardia:
        // si el profesor terminó la carrera en esa ventana (p.ej. "Terminar
        // carrera"), `session.phase` ya no es 'race' — no repintar la carrera
        // sobre lo que paint() ya haya mostrado (resultado/podio); el próximo
        // evento real de sesión (subscribeRoom/poll) lo enruta correctamente.
        // (No se puede usar paint() aquí: cachea por `session.*` y el avance de
        // raceQueue es 100% local, así que repintaría la MISMA pregunta.)
        // ctx.setTimeout: paintRace hace mount(rootSel,…) sobre #app; con
        // setTimeout desnudo, si el alumno navega en esta ventana pisaba el #app
        // de otra vista. ctx lo cancela al desmontar.
        rt.ctx.setTimeout(() => { if (rt.session.phase === 'race') paintRace(); }, RACE_FLASH_MS);
      }
    });
    if (!ronda?.chromePropio) {
      const extra = document.getElementById('s-race-extra');
      if (extra) extra.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2 s-race-head">
          <span class="badge bg-success fs-6">${chips.left}</span>
          <span class="badge bg-info text-dark fs-6">${chips.right}</span>
        </div>
        <div class="progress mb-3" style="height:6px">
          <div class="progress-bar bg-success" style="width:${total > 0 ? Math.round(100 * rt.raceCorrectCount / total) : 0}%"></div>
        </div>`;
    }
  }

  return { paintRace };
}
