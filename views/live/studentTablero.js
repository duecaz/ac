// ALUMNO · bucle TABLERO (§26): un tablero compartido (Ordena las Pelotas) que
// el alumno resuelve a su ritmo, retransmitiendo cada movimiento (con
// throttle) para que la pizarra lo vea en vivo. Extraído de
// views/studentLive.js en el corte POR BUCLE (v1.51.628, deuda condicionada #2
// de CLAUDE.md).
import { clock } from '../../core/clock.js';
import { html, mount } from '../../core/html.js';
import { submitProgress } from '../../core/liveTransport.js';
import { toast, TOAST_NORMAL } from '../../core/toast.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { getTemplate } from '../../core/registry.js';
import { roundPayloadOf } from '../../kernel/session/engine.js';

/**
 * @typedef {import('../studentLive.js').StudentRt} StudentRt
 * @typedef {import('../../kernel/contracts/session.js').RoundPayload} RoundPayload
 */

/**
 * Lo que viaja al host en cada movimiento y al resolver: esta vista lo RELAYA tal
 * cual (la forma la decide la plantilla de tablero, §0), así que aquí es un saco.
 * @typedef {{progress?: number} & Record<string, unknown>} SnapTablero
 */

/** @param {StudentRt} rt */
export function createStudentTablero(rt) {
  // LIVE "board" templates (Ball Sort): ONE shared board the student solves at
  // their own pace. Every move is broadcast (throttled) so the host sees the
  // board move-by-move; the final solve is sent immediately. Rides the 'race'
  // phase — lobby/podium are unchanged. The board is mounted once and kept
  // (paint() dedups identical phase keys, so host pings don't remount it).
  function paintLiveBoard() {
    const tpl = getTemplate(rt.activity.template);
    // `renderRound` es OPCIONAL en el contrato (kernel/contracts/template.js): sin
    // ella no hay tablero que montar (llamar a `undefined` ya lanzaba, R6).
    if (typeof tpl?.renderRound !== 'function') {
      throw new Error(`[studentTablero] ${rt.activity.template}: no implementa renderRound`);
    }
    const payload = /** @type {RoundPayload} */ (roundPayloadOf(tpl, rt.activity, 0));
    // El TABLERO es de la plantilla: la vista no lo interpreta, solo reenvía sus
    // medidas al host junto al movimiento (§0).
    const board = payload?.board;
    if (!board || typeof board !== 'object') return rt.paintWaiting('Esperando…');
    const medidas = /** @type {Record<string, unknown>} */ (board);
    emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item: payload });

    mount(rt.rootSel, html`
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-info text-dark"><i class="bi bi-droplet-half"></i> Ordena las pelotas</span>
        <span id="bs-status" class="badge bg-secondary">En juego…</span>
      </div>
      <div id="s-round"></div>
    `);

    let lastSent = 0, solved = false;
    /** @type {SnapTablero|null} */
    let pendingSnap = null;
    /** @type {number|null} */
    let flushHandle = null;
    const SEND_EVERY = 600;   // ms — cap network writes to ~1.7/s per student
    /** @param {SnapTablero} snap */
    const sendNow = (snap) => {
      lastSent = clock.now();
      pendingSnap = null;
      submitProgress(rt.session.id, rt.player.playerId, snap).catch(() => {});
    };
    /** @param {SnapTablero} snap */
    const onProgress = (snap) => {
      if (solved) return;
      const now = clock.now();
      const wait = SEND_EVERY - (now - lastSent);
      if (wait <= 0) { sendNow(snap); return; }
      pendingSnap = snap;                       // coalesce: keep only the latest
      if (!flushHandle) {
        flushHandle = rt.ctx.setTimeout(() => { flushHandle = null; if (pendingSnap && !solved) sendNow(pendingSnap); }, wait);
      }
    };

    const hueco = document.getElementById('s-round');
    if (!hueco) return;
    tpl.renderRound(hueco, payload, {
      onProgress,
      onSubmit: (res) => {
        solved = true;
        // Lo que entrega la plantilla al resolver: saco sin forma declarada para
        // la plataforma (la plantilla la conoce), se reenvía tal cual.
        const hecho = /** @type {Record<string, unknown>} */ (res && typeof res === 'object' ? res : {});
        const finalSnap = {
          tubes: hecho.tubes,
          tubeCapacity: medidas.tubeCapacity,
          colors: medidas.colors,
          moveCount: hecho.moveCount, elapsedMs: hecho.elapsedMs, solved: true,
        };
        sendNow(finalSnap);
        emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: 0 });
        const st = document.getElementById('bs-status');
        if (st) { st.className = 'badge bg-success'; st.textContent = '🏆 ¡Resuelto!'; }
        toast('¡Resuelto! Espera a que el profesor cierre la sala.', 'success', TOAST_NORMAL);
      },
    });
  }

  return { paintLiveBoard };
}
