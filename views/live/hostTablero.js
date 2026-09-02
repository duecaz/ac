// HOST · bucle TABLERO (§26): un tablero compartido (Ordena las Pelotas) donde
// cada alumno avanza a su ritmo y la pizarra ve todos los tableros a la vez.
// Extraído de views/hostLive.js en el corte POR BUCLE (v1.51.628, deuda
// condicionada #2 de CLAUDE.md). `startRaceLoop`/`raceClock`/`endBadge`/
// `maybeAutoEnd` siguen en el ensamblador porque la CARRERA
// (views/live/hostCarrera.js) también los usa.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { listAnswers, endSession } from '../../core/liveTransport.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../../core/fullscreen.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { confirmModal } from '../../core/toast.js';
import { roundPayloadOf } from '../../kernel/session/engine.js';
import { BOARD_POLL_MS } from '../../core/timings.js';
import { supportsLoop } from '../../core/liveLoops.js';

export function createHostTablero(rt) {
  // LIVE "board" dashboard (Ball Sort): a grid of every student's board updating
  // move-by-move. Reads progress rows from live_answers (item 0); each student
  // upserts their own row via submitProgress, so there's no clobber. Rides the
  // 'race' phase, so the lobby/start/podium are the standard ones.
  async function paintLiveBoardHost(phaseChanged = true) {
    if (phaseChanged) emitGame(GameEvents.LOBBY_END);
    const mode = rt.activity.content?.mode || 'moves';
    const initialBoard = roundPayloadOf(rt.tpl, rt.activity, 0)?.board || null;

    let rows = [];
    try { rows = await listAnswers(rt.sessionId, 0); } catch { rows = []; }
    const byPlayer = {};
    for (const r of rows) byPlayer[r.playerId || r.player_id] = r.value;

    // One cell per player; players with no move yet show the starting board.
    const cells = rt.players.map(p => ({
      id: p.id, name: p.name,
      value: byPlayer[p.id] || (initialBoard ? { tubes: initialBoard.tubes, tubeCapacity: initialBoard.tubeCapacity, colors: initialBoard.colors, moveCount: 0, elapsedMs: 0, solved: false } : null),
    }));
    // MISMA política de exposición que la carrera (ficha 3 B-1): durante el
    // juego la rejilla NO se reordena por quién va ganando — cada tablero se
    // queda en su sitio y el alumno ve el suyo donde lo dejó. Reordenar en vivo
    // además hace saltar las celdas bajo el dedo del que está jugando. La
    // clasificación (resuelto → menos movimientos/tiempo) es cosa del PODIO.
    const solvedCount = cells.filter(c => c.value?.solved).length;
    if (await rt.maybeAutoEnd(solvedCount)) return;
    mount(rt.rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="mb-0"><i class="bi bi-droplet-half text-info me-2"></i>Ordena las pelotas
          <span class="badge bg-success ms-2">${solvedCount}/${rt.players.length} resueltos</span>
          <span class="badge bg-secondary ms-1">${escapeHtml(rt.endBadge())}</span></h4>
        <span class="badge bg-secondary fs-6" id="race-timer">${rt.raceClock()}</span>
        ${fullscreenButtonHtml()}
      </div>
      ${rt.players.length === 0
        ? `<p class="text-center text-light">Esperando jugadores…</p>`
        : `<div class="bs-grid" id="bs-grid"></div>`}
      <div class="text-center mt-4">
        <button class="btn btn-warning btn-lg" id="btn-end-race">
          <i class="bi bi-flag-fill"></i> Terminar y ver podio
        </button>
      </div>
    `);
    attachFullscreenButton(rt.rootSel);

    const grid = document.getElementById('bs-grid');
    // DECLARACIÓN (§0): quien pinta la celda del tablero es quien DECLARA el
    // bucle 'board' en meta.play.live (core/templateContract.js lo exige más
    // abajo), no quien resulta tener renderRaceCell. El aviso es defensivo
    // (R6), no el criterio.
    const declaresBoard = supportsLoop(rt.tpl, 'board');
    if (declaresBoard && typeof rt.tpl.renderRaceCell !== 'function') {
      console.warn(`[hostTablero] ${rt.tpl?.meta?.name || '?'}: declara play.live con 'board' pero no implementa renderRaceCell (contrato roto)`);
    }
    if (grid && declaresBoard) {
      for (const c of cells) {
        const cellEl = document.createElement('div');
        cellEl.className = 'bs-grid-cell';
        grid.appendChild(cellEl);
        // Aísla el fallo de UNA celda para no romper la rejilla, pero lo registra
        // (un bug de renderRaceCell de la plantilla era invisible; antes: catch {}).
        try { rt.tpl.renderRaceCell(cellEl, { value: c.value, name: c.name, mode }); }
        catch (e) { console.warn('[hostLive] renderRaceCell falló:', e); }
      }
    }

    if (phaseChanged) rt.startRaceLoop(paintLiveBoardHost, BOARD_POLL_MS);

    on(rt.rootSel, 'click', '#btn-end-race', async () => {
      const ok = await confirmModal('¿Terminar la sala? Se calculará la clasificación final.', { okText: 'Terminar' });
      if (!ok) return;
      const btn = document.getElementById('btn-end-race');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Finalizando…'; }
      // endSession liquida el tablero pendiente (settlePending) antes de cerrar.
      await endSession(rt.sessionId);
    });
  }

  return { paintLiveBoardHost };
}
