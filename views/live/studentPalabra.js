// ALUMNO · bucle PEDIR LA PALABRA (§26): el alumno elige una caja (o gira la
// ruleta) y espera a que el docente reparta los puntos a mano. Extraído de
// views/studentLive.js en el corte POR BUCLE (v1.51.628, deuda condicionada #2
// de CLAUDE.md). `qlRotation` es estado PROPIO de este bucle; `rt.qlSpinning`
// viaja en `rt` porque paint() (ensamblador) lo consulta para no repintar
// encima de un giro en curso.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { claimQuestion } from '../../core/liveTransport.js';
import { sessionItems } from '../../kernel/session/engine.js';
import { visibleItem } from '../../core/liveSnapshot.js';
import { wheelSvg } from '../../templates/wheel/render.js';
import { pickIndex } from '../../templates/wheel/logic.js';
import { spinTarget, normalizeRotation, animateSpin, SPIN_DUR_PICK } from '../../templates/wheel/spin.js';
import { qlBoxesHtml } from '../../core/questionLive.js';

export function createStudentPalabra(rt) {
  let qlRotation = 0;   // persisted wheel angle across spins

  const rootEl = () => (typeof rt.rootSel === 'string' ? document.querySelector(rt.rootSel) : rt.rootSel);

  async function qlOpenQuestion(idx) {
    if (rt.session.ql_open !== null) return; // race — someone beat us
    // §22-2 — lo que el alumno puede leer de un ítem sale de su PAYLOAD (ya sin
    // solución), no del contenido: el snapshot de la sala ya no lo lleva.
    const raw = visibleItem(rt.activity, idx);
    // Support both new {q, image} format and old flat-string entries format.
    const label = typeof raw === 'string' ? raw : (raw?.question ?? raw?.q ?? '');   // ?? q: sesión en vuelo pre-migración
    // Image is NOT put in session state (data-URLs are heavy) — both host and
    // student already hold the full activity and read it locally by index.
    // Pedir la palabra escribe SOLO el campo `ql` de la sala: el alumno no
    // puede tocar fase/ítem/deadline/puntajes (ley de confianza §22).
    await claimQuestion(rt.session.id, {
      open: idx,
      question: label,
      by: rt.player.playerId,
      byName: rt.player.name,
    });
  }

  // Card shown to everyone once a question is open (the picker sees "¡Tu pregunta!").
  function qlOpenCardHtml(qlQuestion, qlImage, iMine) {
    return `<div class="card bg-dark text-light p-4 mx-auto mt-2" style="max-width:500px">
       <p class="text-muted small mb-1">${iMine ? '<i class="bi bi-hand-index-fill text-warning"></i> ¡Tu pregunta!' : '<i class="bi bi-hand-index-fill"></i> Pregunta en curso'}</p>
       ${qlImage ? `<div class="text-center mb-2"><img src="${escapeHtml(qlImage)}" class="img-fluid rounded" style="max-height:180px"></div>` : ''}
       <h3 class="text-center">${escapeHtml(qlQuestion || '')}</h3>
     </div>`;
  }

  function paintQuestionLive() {
    // wheel template always spins; question-live reads its selector rule.
    // La ruleta la declara la ACTIVIDAD (rules.selector), no el nombre de la
    // plantilla: 'wheel' trae ese selector por defecto en sus reglas.
    const selector = rt.activity.rules?.selector || 'boxes';
    if (selector === 'wheel') return paintQuestionLiveWheel();
    return paintQuestionLiveBoxes();
  }

  function paintQuestionLiveBoxes() {
    const qlOpen     = rt.session.ql_open ?? null;
    const qlQuestion = rt.session.ql_question ?? null;
    const qlImage    = qlOpen !== null ? (visibleItem(rt.activity, qlOpen)?.image ?? null) : null;
    const qlPoints   = rt.session.ql_points || {};
    const qlBy       = rt.session.ql_by ?? null;
    const allItems   = sessionItems(rt.activity);
    const cols       = Math.min(4, Math.max(2, Math.ceil(allItems.length / 2)));
    const iMine      = qlBy === rt.player.playerId;
    const canPick    = qlOpen === null; // only 1 box open at a time

    // El tablero, de su dueño (core/questionLive.js). Lo propio de esta pantalla
    // es solo QUÉ puede tocar el alumno: una caja libre, y solo si le toca.
    const boxesHtml = qlBoxesHtml(allItems.length, {
      done: qlPoints, open: qlOpen, cls: 'ql-sbox',
      pickable: () => canPick, extraStyle: 'border-radius:8px',
    });

    mount(rt.rootSel, html`
      <div class="text-center py-3">
        <div class="ql-student-grid mb-3" style="grid-template-columns:repeat(${cols},1fr)">${boxesHtml}</div>
        ${qlOpen !== null
          ? qlOpenCardHtml(qlQuestion, qlImage, iMine)
          : `<p class="text-muted mt-3"><i class="bi bi-hand-index"></i> Elige una caja</p>`}
      </div>
    `);

    on(rt.rootSel, 'click', '.ql-sbox:not([disabled])', (_, btn) => qlOpenQuestion(+btn.dataset.idx));
  }

  function paintQuestionLiveWheel() {
    const qlOpen     = rt.session.ql_open ?? null;
    const qlQuestion = rt.session.ql_question ?? null;
    const qlPoints   = rt.session.ql_points || {};
    const qlBy       = rt.session.ql_by ?? null;
    const allItems   = sessionItems(rt.activity);
    const qlImage    = qlOpen !== null ? (visibleItem(rt.activity, qlOpen)?.image ?? null) : null;
    const iMine      = qlBy === rt.player.playerId;

    // A question is open → show the question card, no wheel.
    if (qlOpen !== null) {
      mount(rt.rootSel, html`<div class="text-center py-3">${qlOpenCardHtml(qlQuestion, qlImage, iMine)}</div>`);
      return;
    }

    // Available = questions not yet scored. Wheel slices are their numbers.
    const available = allItems.map((_, i) => i).filter(i => qlPoints[i] == null);
    if (available.length === 0) {
      mount(rt.rootSel, html`
        <div class="text-center py-5">
          <i class="bi bi-check2-all display-1 text-success"></i>
          <h3 class="mt-3">¡Todas respondidas!</h3>
          <p class="text-muted">Espera a que el profesor termine.</p>
        </div>`);
      return;
    }

    const entries = available.map(i => String(i + 1));
    mount(rt.rootSel, html`
      <div class="text-center py-3">
        <div class="ql-wheel ww-wheel-stage">
          ${wheelSvg(entries, { rotation: qlRotation, dur: 0, spinning: false, size: 300 })}
          <div class="ww-wheel-pointer">▶</div>
        </div>
        <div class="mt-3">
          <button class="btn btn-warning btn-lg px-5" id="ql-spin"><i class="bi bi-arrow-repeat"></i> Girar</button>
        </div>
        <p class="text-muted small mt-2">Gira la rueda y responde la pregunta que te toque.</p>
      </div>
    `);

    on(rt.rootSel, 'click', '#ql-spin', () => qlSpin(available, entries.length));
  }

  function qlSpin(available, count) {
    if (rt.qlSpinning || count === 0) return;
    rt.qlSpinning = true;
    const dur = SPIN_DUR_PICK;
    const target = pickIndex(count);
    const realIdx = available[target];
    qlRotation = spinTarget(qlRotation, count, target);

    const btn = rootEl()?.querySelector('#ql-spin');
    if (btn) btn.disabled = true;
    animateSpin(rootEl()?.querySelector('.ql-wheel svg'), qlRotation, dur);

    // ctx.setTimeout: si el alumno abandona la vista mientras gira la ruleta, este
    // callback ESCRIBE en el servidor (qlOpenQuestion → setSessionState). Con
    // setTimeout desnudo disparaba tras navegar; ctx lo cancela en disposeAll.
    rt.ctx.setTimeout(async () => {
      rt.qlSpinning = false;
      qlRotation = normalizeRotation(qlRotation);
      // Someone may have opened a question while we spun — bail and repaint.
      if (rt.session.ql_open !== null) { rt.lastPhaseKey = ''; rt.paint(); return; }
      await qlOpenQuestion(realIdx);
    }, dur);
  }

  return { paintQuestionLive };
}
