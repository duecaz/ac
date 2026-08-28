// HOST · bucle CARRERA (§26): cada alumno a su ritmo, gana quien termina
// primero con TODAS bien (racePassedRow). Extraído de views/hostLive.js en el
// corte POR BUCLE (v1.51.628, deuda condicionada #2 de CLAUDE.md).
// `startRaceLoop`/`raceClock`/`endBadge`/`maybeAutoEnd` siguen en el
// ensamblador porque el TABLERO (views/live/hostTablero.js) también los usa.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { listAnswers, endSession } from '../../core/liveTransport.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../../core/fullscreen.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { toast, confirmModal } from '../../core/toast.js';
import { racePassedRow } from '../../core/liveLoops.js';
import { RACE_POLL_MS } from '../../core/timings.js';

export function createHostCarrera(rt) {
  async function loadRaceAnswers() {
    const all = await Promise.all(
      rt.items.map((_, i) => listAnswers(rt.sessionId, i).then(ans => ans.map(a => ({ ...a, itemIndex: i }))))
    );
    return all.flat();
  }

  async function paintRace(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_END);
    let allAnswers;
    try { allAnswers = await loadRaceAnswers(); } catch { allAnswers = []; }

    // Rank by CORRECT answers, not by how many were submitted. Counting any
    // submission let a student tapping fast through WRONG answers top the board
    // ("responde más → lo cuenta como buena"). Race answers are unsettled
    // (correct=null) during play, so score each here on the host (we hold the
    // answer key) — a settled row's verdict is trusted as-is.
    const prog = {};
    for (const p of rt.players) prog[p.id] = { name: p.name, items: new Set() };
    for (const a of allAnswers) {
      const pid = a.playerId || a.player_id;
      if (!prog[pid]) continue;
      // LA MISMA VARA que el móvil (§26, la regla de hoja completa): un ítem se
      // supera con la hoja COMPLETA. Aquí el host contaba `correct` a secas
      // —para Tildes, net>0— y una hoja 3/4 le contaba como terminada: cerraba
      // la sala por "terminan todos" mientras el móvil re-encolaba la hoja.
      if (racePassedRow(rt.tpl, a, rt.items[a.itemIndex], rt.activity, rt.loop)) {
        prog[pid].items.add(a.itemIndex);
      }
    }
    // POLÍTICA DE EXPOSICIÓN (decisión, docs/estudio-bucles-live.md ficha 2 C-2):
    // durante el juego la pizarra muestra AVANCE, no RANKING. Antes esta lista
    // se ordenaba por aciertos, así que el que menos sabía aparecía el último,
    // con su nombre y su barra vacía, proyectado VARIOS MINUTOS — mucho más
    // tiempo del que dura una revelación. El orden es ahora estable (el de
    // entrada a la sala): cada alumno ve su barra crecer sin compararse en
    // público. La clasificación existe, pero en el PODIO, al final.
    const sorted = rt.players.map(p => prog[p.id]).filter(Boolean);
    // ¿Se cumple la política de fin? (todos · primeros N · tiempo)
    if (await rt.maybeAutoEnd(sorted.filter(p => p.items.size >= rt.items.length).length)) return;
    const total = rt.items.length;
    mount(rt.rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0"><i class="bi bi-flag-fill text-warning me-2"></i>Carrera libre
          <span class="badge bg-secondary ms-2">${escapeHtml(rt.endBadge())}</span></h4>
        <span class="badge bg-secondary fs-6" id="race-timer">${rt.raceClock()}</span>
        ${fullscreenButtonHtml()}
      </div>
      <div class="mb-4" style="max-width:700px;margin:0 auto">
        ${sorted.map((p) => {
          const n = p.items.size;
          const pct = total > 0 ? Math.round(100 * n / total) : 0;
          const done = n >= total;
          return `<div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="fw-bold text-light fs-5">${escapeHtml(p.name)}${done ? ' 🏆' : ''}</span>
              <span class="badge ${done?'bg-success':'bg-warning text-dark'} fs-6">${n}/${total}</span>
            </div>
            <div class="progress" style="height:20px">
              <div class="progress-bar ${done?'bg-success':'bg-warning text-dark'} fw-bold" style="width:${Math.max(pct,2)}%;transition:width .5s"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="text-center">
        <button class="btn btn-warning btn-lg" id="btn-end-race">
          <i class="bi bi-flag-fill"></i> Terminar carrera y ver podio
        </button>
      </div>
    `);
    attachFullscreenButton(rt.rootSel);

    if (phaseChanged) rt.startRaceLoop(paintRace, RACE_POLL_MS);

    on(rt.rootSel, 'click', '#btn-end-race', async () => {
      const ok = await confirmModal('¿Terminar la carrera? Se calculará la clasificación final.', { okText: 'Terminar carrera' });
      if (!ok) return;
      const btn = document.getElementById('btn-end-race');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Finalizando…'; }
      // endSession liquida TODO lo pendiente en una pasada (settlePending del
      // adaptador) antes de marcar 'ended' — ya no hace falta el bucle de
      // settleItem por ítem que hacía N viajes redundantes.
      await endSession(rt.sessionId);
    });
  }

  return { paintRace };
}
