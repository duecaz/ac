// TEAMS view — shared-screen, no-device classroom play (Baamboozle/Factile
// style). Teams take TURNS on one question flow; the turn rotates each time the
// teacher advances. Two scoring modes, both driven by the session engine
// (format 'teams'):
//   • auto  — the active team taps an option and the machine scores it (Quiz).
//   • judge — the TEACHER marks ✓/✗ on whatever the team answered out loud, so
//             ANY content plays in teams even without a machine scorer.
//
// All flow/scoring lives in kernel/session/teamsMachine.js (via the engine.js
// facade); this view paints the board, the scoreboard and the host controls.
//
// EMBEDDING: mountTeams(host, activity, ctx, opts) renders setup + game INTO
// `host` (the activity stage). (Wrapper de ruta suelta eliminado: sin callers.)
import { html, escapeHtml, mount, $, $$ } from '../core/html.js';
import { on } from '../core/events.js';
import { getTemplate } from '../core/registry.js';
import { createSession, FORMATS } from '../kernel/session/engine.js';
import { sessionItems } from '../kernel/content/sessionItems.js';
import { GameEvents, emitGame } from '../core/gameEvents.js';
import { applyMarks } from '../core/textMarks.js';
import { renderAntesala } from './antesala.js';
import { applyPlayOptions } from '../core/playOptions.js';
import { teamColor, teamsScoreboardHtml, teamsSetupBody, wireTeamsSetup, readTeamNames, teamsPodiumHtml } from '../core/teams.js';
import { canAutoScoreRound } from '../core/templateCapability.js';


/** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
/** @typedef {import('../kernel/contracts/session.js').LivePhase} LivePhase */
/** @typedef {import('../kernel/session/teamsMachine.js').RosterTeam} RosterTeam */
/** @typedef {import('../kernel/contracts/template.js').RoundPayload} RoundPayload */
/** Lo que `roundPayload()` devuelve: la ronda que expone la plantilla o, si no
 *  la declara, el ítem crudo (kernel/session/score.js).
 *  @typedef {RoundPayload|SessionItem|null} Payload */
/** @typedef {import('../core/playOptions.js').PlayChoices} PlayChoices */
/** @typedef {import('../kernel/contracts/activity.js').SessionItem} SessionItem */
/** @typedef {import('../kernel/contracts/activity.js').TextMark} TextMark */

/** Los campos que esta vista mira de un ítem, sea del modelo que sea.
 *  @typedef {{question?: string, text?: string, prompt?: string, left?: string,
 *    right?: string, image?: string|null, marks?: TextMark[],
 *    answer?: string|string[]|null}} CamposItem */

/** @param {unknown} item @returns {CamposItem} */
const campos = (item) =>
  /** @type {CamposItem} */ ((item && typeof item === 'object') ? item : {});
/** LA SESIÓN DE EQUIPOS. `createSession` despacha a las tres máquinas y devuelve
 *  la unión; el formato lo fija esta vista (`FORMATS.TEAMS`), así que aquí se
 *  nombra la que es.
 *  @typedef {ReturnType<typeof import('../kernel/session/teamsMachine.js').createTeamsSession>} SesionEquipos */

// Standalone route wrapper (#/teams/:id).
// Embedded entry point. `host` is the stage: el elemento o su SELECTOR (así lo
// declara core/modes.js y así lo pasa views/playerView.js, con
// '#ww-player-widget'). Solo viaja a `mount`/`on`/`renderAntesala`, que aceptan
// las dos formas. Returns { dispose }.
/**
 * @param {string|Element} host
 * @param {Activity} a
 * @param {ReturnType<import('../core/lifecycle.js').acquire>} [ctx]
 * @param {{backHref?: string}} [opts]
 * @returns {{dispose: () => void}}
 */
export function mountTeams(host, a, ctx, opts = {}) {
  const backHref = opts.backHref;
  const total = sessionItems(a).length;
  if (!total) {
    mount(host, html`<div class="alert alert-info m-3">Esta actividad no tiene preguntas. <a href="#/edit/${a.id}">Editar</a></div>`);
    return { dispose() {} };
  }
  const T = getTemplate(a.template);
  // Opciones de partida elegidas en el setup (core/playOptions.js): se aplican
  // a una COPIA al arrancar, nunca a la actividad guardada.
  /** @type {PlayChoices} */
  let playChoices = {};
  // MISMO criterio que core/modes.js y createTeamsSession (core/templateCapability.js):
  // hace falta scoreSubmission Y renderRound — roundBody()/wire() más abajo exigen
  // renderRound para pintar la ronda "Automática"; exigir solo getRoundPayload
  // dejaba el botón "Revelar" deshabilitado para siempre si se llegara a habilitar.
  const canAuto = canAutoScoreRound(T);
  // DECLARACIÓN (§0): quien pinta la ronda genérica es quien la DECLARA
  // (meta.play.teams 'turns'/'board'), no quien resulta tener renderRound — el
  // contrato (core/templateContract.js:111) ya EXIGE renderRound a esa
  // declaración, así que aquí basta con leerla. `canAuto` (capacidad) sigue
  // decidiendo si se ofrece el botón "Automática": el aviso de abajo es solo
  // defensivo (R6), no el criterio.
  const usesGenericRound = ['turns', 'board'].includes(T?.meta?.play?.teams ?? '');
  if (usesGenericRound && typeof T?.renderRound !== 'function') {
    console.warn(`[teamsView] ${a.template}: declara play.teams="${T?.meta?.play?.teams}" pero no implementa renderRound (contrato roto)`);
  }

  // Defaults configured in the editor's "Modos" tab (presentation.*); still
  // changeable here before starting.
  let teamCount = a.presentation?.teamsCount || 2;
  const defScoring = a.presentation?.teamsScoring;
  renderSetup();

  function renderSetup() {
    // El cuerpo común (cuántos equipos + nombres) es del dueño del modo
    // (core/teams.js); aquí solo lo PROPIO de Equipos por turnos: la
    // puntuación y el aviso de cuántas preguntas tocan a cada uno.
    const body = teamsSetupBody({ count: teamCount, color: 'success', extra: `
      <div class="my-3">
        <label class="form-label small text-muted d-block">Puntuación</label>
        <div class="btn-group" role="group" id="teams-scoring">
          <button class="btn btn-outline-secondary ${canAuto && defScoring !== 'judge' ? 'active' : ''} ${canAuto ? '' : 'd-none'}" data-mode="auto" ${canAuto ? '' : 'disabled'}>
            <i class="bi bi-cpu"></i> Automática
          </button>
          <button class="btn btn-outline-secondary ${!canAuto || defScoring === 'judge' ? 'active' : ''}" data-mode="judge">
            <i class="bi bi-person-check"></i> Juez docente
          </button>
        </div>
        <div class="form-text">${canAuto
          ? 'Automática: el equipo toca la opción. Juez: tú marcas ✓/✗.'
          : 'Esta plantilla no se autocorrige: el docente marca ✓/✗.'}</div>
      </div>
      <div id="teams-hint" class="mt-2"></div>` });

    renderAntesala(host, {
      activity: a,
      icon: 'bi-people-fill', color: 'success', title: 'Modo Equipos',
      subtitle: `${a.title} · ${total} preguntas · por turnos`,
      bodyHtml: body, backHref,
      playOpts: { T, activity: a, choices: playChoices, onChange: (id, v) => { if (id) playChoices = { ...playChoices, [id]: v }; } },
      onMount: () => {
        wireTeamsSetup(host, teamCount, (n) => { teamCount = n; updateTeamsHint(); });
        updateTeamsHint();
        on(host, 'click', '#teams-scoring button', (_, el) => {
          if (/** @type {HTMLButtonElement} */ (el).disabled) return;
          $$('#teams-scoring button').forEach(x => x.classList.toggle('active', x === el));
        });
      },
      onStart: () => {
        const names = readTeamNames();
        const elegido = $('#teams-scoring .active')?.dataset.mode;
        const scoring = elegido === 'auto' || elegido === 'judge' ? elegido : (canAuto ? 'auto' : 'judge');
        startGame(names, scoring);
      }
    });
  }

  function updateTeamsHint() {
    const hint = $('#teams-hint');
    if (!hint) return;
    const turns = Math.floor(total / teamCount);
    if (total < teamCount) {
      hint.innerHTML = `<div class="alert alert-warning py-2 small mb-0">
        <i class="bi bi-exclamation-triangle-fill"></i>
        Con ${teamCount} equipos y solo ${total} pregunta${total !== 1 ? 's' : ''}, no todos los equipos podrán jugar.
        Añade al menos ${teamCount} preguntas en el editor para que cada equipo tenga turno.
      </div>`;
    } else {
      hint.innerHTML = `<div class="text-muted small">
        <i class="bi bi-info-circle"></i>
        Modo por turnos: cada pregunta la responde un equipo distinto en rotación.
        Con ${total} preguntas y ${teamCount} equipos, cada equipo responde ~${turns} vez${turns !== 1 ? 'es' : ''}.
      </div>`;
    }
  }

  /**
   * @param {string[]} names
   * @param {'auto'|'judge'} scoring
   */
  function startGame(names, scoring) {
    const session = /** @type {SesionEquipos} */ (createSession(applyPlayOptions(T, a, playChoices),
      { format: FORMATS.TEAMS, teams: names, scoring }));
    // El TOTAL de la partida es el del MOTOR, no el nº bruto de ítems: el motor
    // recorta a múltiplo del nº de equipos (todos responden lo mismo). Usar el
    // bruto aquí desincronizaba el rótulo "Pregunta X / N" y el botón final.
    const roundsTotal = session.totalItems;
    session.dispatch('start');
    /** @type {unknown} */
    let selected = null; // auto-mode: the active team's tapped value (pre-reveal)

    paint();

    function paint() {
      const phase = session.phase;
      const teams = session.state.teams;
      const active = session.activeTeam();
      const idx = session.currentItem;
      const item = sessionItems(a)[idx];
      const payload = session.roundPayload();

      mount(host, html`
        <div class="teams-arena">
          ${scoreboard(teams, active, phase)}
          <div class="teams-stage">
            <div class="teams-turn">
              ${active ? `<span class="badge text-bg-${colorOf(active)} fs-6">
                <i class="bi bi-arrow-right-circle"></i> Turno: ${escapeHtml(active.name)}
              </span>` : ''}
              <span class="text-muted ms-2">Pregunta ${idx + 1} / ${roundsTotal}</span>
            </div>
            <div class="teams-card">
              ${roundBody(item, payload, phase)}
            </div>
            <div class="teams-controls">
              ${controls(phase)}
            </div>
          </div>
        </div>`);

      wire(item, payload, phase);
    }

    /** `active` puede ser nulo (roster vacío): el marcador se pinta igual, solo
     *  que sin resaltar turno.
     * @param {RosterTeam[]} teams
     * @param {RosterTeam|null} active
     * @param {LivePhase} phase
     */
    function scoreboard(teams, active, phase) {
      return teamsScoreboardHtml(teams, active?.id ?? null, phase === 'ended');
    }

    // Question body. In AUTO mode the template paints the interactive round
    // itself (renderRound) while answering; in JUDGE mode — and on reveal — we
    // render a generic prompt plus the answer (model-aware).
    /**
     * @param {SessionItem|undefined} item
     * @param {Payload} payload
     * @param {LivePhase} phase
     * @returns {string}
     */
    function roundBody(item, payload, phase) {
      if (phase === 'ended') return podium();

      // AUTO + answering → the template owns the round DOM (filled after mount).
      if (scoring === 'auto' && phase === 'question' && payload && usesGenericRound) {
        return `<div id="teams-round"></div>`;
      }

      const prompt = campos(payload).question || promptOf(item);
      let media = '';
      const imagen = campos(payload).image || campos(item).image;
      if (imagen) media = `<div class="text-center mb-2"><img src="${escapeHtml(imagen)}" style="max-height:150px" class="img-fluid"></div>`;

      // On reveal, surface the right answer so the class sees it; in judge mode
      // offer it as a discreet teacher-only hint beforehand.
      const ans = answerOf(item);
      let reveal = '';
      if (phase === 'reveal' && ans) {
        reveal = `<div class="teams-answer"><i class="bi bi-check-circle-fill text-success"></i>
          Respuesta: <b>${escapeHtml(ans)}</b></div>`;
      } else if (scoring === 'judge' && ans) {
        reveal = `<details class="teams-hint"><summary>Ver respuesta (docente)</summary>
          <b>${escapeHtml(ans)}</b></details>`;
      }

      return `<div class="teams-q">${escapeHtml(prompt)}</div>${media}${reveal}`;
    }

    // Prompt/answer adapt to the content model so judge mode works everywhere:
    // quiz→question/answer, tildes/comas→passage text / corrected text,
    // match/memory→left / right, ruleta→the entry string.
    // El ítem es la UNIÓN de todos los modelos (SessionItem): cada modelo nombra
    // a su manera lo que se lee y lo que se responde, así que se miran por forma.
    /** @param {SessionItem|undefined} item @returns {string} */
    function promptOf(item) {
      if (item == null) return '';
      if (typeof item === 'string') return item;
      const it = campos(item);
      return it.question || it.text || it.prompt || it.left || '';
    }
    /** @param {SessionItem|undefined} item @returns {string} */
    function answerOf(item) {
      if (item == null || typeof item === 'string') return '';
      const it = campos(item);
      if (Array.isArray(it.marks)) return applyMarks(it.text || '', it.marks); // textCorrection
      if (it.answer != null) return Array.isArray(it.answer) ? it.answer.join(' / ') : String(it.answer);
      if (it.right != null) return String(it.right); // pairs
      return '';
    }

    /** @param {LivePhase} phase @returns {string} */
    function controls(phase) {
      const last = session.currentItem >= roundsTotal - 1;
      if (phase === 'question') {
        if (scoring === 'judge') {
          return `
            <button class="btn btn-success btn-lg teams-judge" data-correct="1"><i class="bi bi-check-lg"></i> Correcto</button>
            <button class="btn btn-danger btn-lg teams-judge" data-correct="0"><i class="bi bi-x-lg"></i> Incorrecto</button>`;
        }
        // auto: reveal enabled once the team has tapped an option
        return `<button class="btn btn-primary btn-lg" id="teams-reveal" ${selected ? '' : 'disabled'}>
          <i class="bi bi-eye"></i> Revelar</button>`;
      }
      if (phase === 'reveal') {
        return `<button class="btn btn-success btn-lg" id="teams-next">
          ${last ? '<i class="bi bi-flag-fill"></i> Ver resultado' : '<i class="bi bi-arrow-right"></i> Siguiente equipo'}</button>`;
      }
      // Fin de partida: los botones van dentro del cierre (podium()), no aquí.
      return '';
    }

    function podium() {
      // Cierre COMPARTIDO del modo (core/teams.js → core/podium.js): mismo podio
      // de barras que En vivo / VS y los mismos dos botones que Memoria.
      const ranked = session.leaderboard().map(t => ({ name: t.name, score: t.score }));
      return teamsPodiumHtml({ ranked, backHref, color: 'success' });
    }

    /**
     * @param {SessionItem|undefined} item
     * @param {Payload} payload
     * @param {LivePhase} phase
     */
    function wire(item, payload, phase) {
      // Auto mode: the template renders the round; on submit we store the active
      // team's answer (scored later at reveal) and enable the Revelar button.
      const roundEl = $('#teams-round');
      if (roundEl && scoring === 'auto' && phase === 'question' && payload
          && typeof T?.renderRound === 'function') {
        // La ronda genérica la pide la plantilla que DECLARA `play.teams`, y esa
        // trae `getRoundPayload` por contrato: aquí el payload es el suyo.
        T.renderRound(roundEl, /** @type {RoundPayload} */ (payload), { onSubmit: (value) => {
          selected = value;
          session.submit(session.activeTeam()?.id ?? '', session.currentItem, value);
          const rev = /** @type {HTMLButtonElement|null} */ ($('#teams-reveal'));
          if (rev) rev.disabled = false;
        } });
      }

      on(host, 'click', '#teams-reveal', () => {
        session.dispatch('reveal'); // auto → settle scores
        const ans = session.state.answers[`${session.currentItem}:${session.activeTeam()?.id ?? ''}`];
        emitGame(ans?.correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, {});
        selected = null;
        paint();
      });

      // Judge mode: teacher rules, then we flip to reveal.
      on(host, 'click', '.teams-judge', (_, btn) => {
        const correct = btn.dataset.correct === '1';
        session.judge({ correct });
        session.dispatch('reveal'); // judge → just flips phase
        emitGame(correct ? GameEvents.ANSWER_CORRECT : GameEvents.ANSWER_WRONG, {});
        paint();
      });

      on(host, 'click', '#teams-next', () => {
        const last = session.currentItem >= roundsTotal - 1;
        session.dispatch(last ? 'end' : 'next'); // 'next' rotates the turn
        selected = null;
        if (last) emitGame(GameEvents.PODIUM, { top: session.leaderboard().slice(0, 1).map(t => ({ name: t.name, score: t.score })) });
        paint();
      });

      on(host, 'click', '#teams-again', () => renderSetup());
    }

    /** @param {RosterTeam} team */
    function colorOf(team) {
      return teamColor(team.id, session.state.teams);
    }
  }

  return { dispose() {} };
}
