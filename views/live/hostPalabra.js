// HOST · bucle PEDIR LA PALABRA (§26): el docente reparte turnos y puntos a
// mano (Abre Cajas · Ruleta). Extraído de views/hostLive.js en el corte POR
// BUCLE (v1.51.628, deuda condicionada #2 de CLAUDE.md).
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { setSessionState, endSession } from '../../core/liveTransport.js';
import { fullscreenButtonHtml, attachFullscreenButton } from '../../core/fullscreen.js';
import { confirmModal } from '../../core/toast.js';
import { qlBoxesHtml, qlCols, qlAwardPatch, qlClosePatch } from '../../core/questionLive.js';

export function createHostPalabra(rt) {
  // CL-1 · QUIÉN HA PARTICIPADO YA (aviso, no regla). El problema real de este
  // bucle es de reparto: el primero que toca se queda la caja, así que los
  // rápidos acaparan y el docente no tiene forma de ver a quién le falta. Esto
  // NO bloquea a nadie —sería una promesa que el cliente no puede garantizar—:
  // pone el dato delante para que el profe reparta con la vista. Los que aún no
  // han participado salen destacados, que es lo accionable.
  function participationHtml() {
    if (!rt.players.length) return '';
    const taken = rt.session.ql_taken || {};
    const count = {};
    for (const pid of Object.values(taken)) if (pid) count[pid] = (count[pid] || 0) + 1;
    const pending = rt.players.filter(p => !count[p.id]);
    return `<div class="ql-participation mb-3">
      <div class="small text-light-emphasis mb-1">
        ${pending.length
          ? `<i class="bi bi-people-fill"></i> Aún no participan: <b>${pending.length}</b> de ${rt.players.length}`
          : '<i class="bi bi-check2-all"></i> Todos han participado al menos una vez'}
      </div>
      <div class="d-flex flex-wrap gap-1 justify-content-center">
        ${rt.players.map(p => {
          const n = count[p.id] || 0;
          return `<span class="badge ${n ? 'bg-secondary' : 'bg-warning text-dark'}">${escapeHtml(p.name)}${n > 1 ? ` ×${n}` : ''}</span>`;
        }).join('')}
      </div>
    </div>`;
  }

  async function paintQuestionLive() {
    const qlOpen     = rt.session.ql_open ?? null;
    const qlQuestion = rt.session.ql_question ?? null;
    // Image stored inline in the activity — read locally by index (not in session state).
    const qlImage    = qlOpen !== null ? (rt.items[qlOpen]?.image || null) : null;
    const qlPoints   = rt.session.ql_points || {};
    const qlBy       = rt.session.ql_by ?? null;
    const qlByName   = rt.session.ql_by_name ?? null;
    const doneCount  = Object.keys(qlPoints).length;
    const cols       = qlCols(rt.items.length, 6);   // el proyector cabe más ancho que el móvil
    const isWheel    = (rt.activity.rules?.selector || 'boxes') === 'wheel';
    const viewTitle  = isWheel ? 'Ruleta Live' : 'Pregunta Live';
    const viewIcon   = isWheel ? 'bi-bullseye' : 'bi-chat-square-text-fill';

    // El tablero lo pinta su DUEÑO (core/questionLive.js): estaba escrito tres
    // veces —aquí, en el alumno y en Individual— con la misma decisión de color.
    // Esta pantalla es SOLO ESTADO: las cajas las eligen los alumnos.
    const boxesHtml = qlBoxesHtml(rt.items.length, { done: qlPoints, open: qlOpen, cls: 'ql-box' });

    mount(rt.rootSel, html`
      <div class="py-3">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h4 class="mb-0 text-light"><i class="bi ${viewIcon} text-warning me-2"></i> ${escapeHtml(viewTitle)}</h4>
          <span class="badge bg-secondary fs-6">${doneCount} / ${rt.items.length} respondidas</span>
          ${fullscreenButtonHtml()}
        </div>
        <div class="ql-grid mb-4" style="grid-template-columns:repeat(${cols},1fr)">${boxesHtml}</div>
        ${participationHtml()}
        ${qlOpen !== null ? `
          <div class="card bg-dark text-light p-4 mb-3 mx-auto" style="max-width:700px">
            <p class="text-warning fw-bold mb-2 fs-5"><i class="bi bi-hand-index-fill"></i> ${escapeHtml(qlByName || '—')} eligió esta caja</p>
            ${qlImage ? `<div class="text-center mb-3"><img src="${escapeHtml(qlImage)}" class="img-fluid rounded" style="max-height:240px"></div>` : ''}
            <h3 class="text-center mb-4">${escapeHtml(qlQuestion || '')}</h3>
            <div class="d-flex justify-content-center gap-3 flex-wrap">
              <button class="btn btn-outline-success btn-lg ql-award" data-pts="10">+10 pts</button>
              <button class="btn btn-success btn-lg ql-award" data-pts="50">+50 pts</button>
              <button class="btn btn-outline-secondary btn-lg" id="ql-close">
                <i class="bi bi-x-circle"></i> Sin puntos
              </button>
            </div>
          </div>` : `<p class="text-center text-muted">Los alumnos eligen una caja…</p>`}
        <div class="text-center mt-3">
          <button class="btn btn-danger btn-lg" id="ql-end">
            <i class="bi bi-stop-circle-fill"></i> Terminar y ver clasificación
          </button>
        </div>
      </div>
    `);
    attachFullscreenButton(rt.rootSel);

    on(rt.rootSel, 'click', '.ql-award', async (_, btn) => {
      if (!qlBy || qlOpen === null) return;
      const points    = +btn.dataset.pts;
      await setSessionState(rt.sessionId, qlAwardPatch({
        playerId: qlBy, points, item: qlOpen,
        points0: qlPoints, taken0: rt.session.ql_taken || {},
      }));
    });

    // "Sin puntos" closes the box as if it was never opened — it stays available.
    on(rt.rootSel, 'click', '#ql-close', async () => {
      await setSessionState(rt.sessionId, qlClosePatch());
    });

    on(rt.rootSel, 'click', '#ql-end', async () => {
      const ok = await confirmModal('¿Terminar la sala?', { okText: 'Terminar' });
      if (!ok) return;
      await endSession(rt.sessionId);
    });
  }

  return { paintQuestionLive };
}
