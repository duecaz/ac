// FreeformShell: guarantees resultScreenHtml + trySaveResult + PODIUM + onFinish for
// players whose finish moment is not a sequential item-by-item loop
// (Wheel, Question-Live, Memory, Match, Wordsearch, Crossword).
//
// Usage:
//   const ctx = runFreeformPlayer(rootSel, activity, opts);
//   // ... player-specific logic ...
//   ctx.finish({ score, maxScore, lead, stats });  // call once when done
import { mount, raizDe } from './html.js';
import { resultScreenHtml } from './resultScreen.js';
import { trySaveResult } from './results.js';
import { FEEDBACK_DELAY } from './constants.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { shuffle } from './azar.js';
import { hudSet } from './playerHud.js';
import { montarReloj, relojDe } from './reloj.js';
import { clock } from './clock.js';
import { defaultMaxScore } from './scoring/index.js';
import { lsGet, lsSet, lsDel } from './ls.js';
import { claimStage } from './stageClaim.js';

/**
 * @typedef {import('../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../kernel/contracts/template.js').PlayerOpts} PlayerOpts
 */

/**
 * Lo que el SHELL ya ha calculado cuando la partida termina. Se lo pasa a los
 * textos de la pantalla de fin para que una plantilla pueda citar el tiempo sin
 * llevar su propio reloj (el reloj es del shell, §23).
 * @typedef {Object} FinishCtx
 * @property {number} timeUsed   Segundos.
 * @property {number} score
 * @property {number} maxScore
 */

/**
 * Un texto de la pantalla de fin: ya escrito, o calculado con lo que el shell
 * sabe al terminar.
 * @typedef {string | ((ctx: FinishCtx) => string)} TextoDeFin
 */

/**
 * Lo que una plantilla puede AÑADIR sobre la pantalla estándar de fin — nunca
 * sustituirla (`skipResultScreen` no existe: lo caza `costuras-divergencia`).
 * @typedef {Object} PantallaFinExtra
 * @property {string} [icon]
 * @property {string} [iconColor]
 * @property {string} [title]
 * @property {string} [lead]
 * @property {string} [stats]
 */

/**
 * UNA RESPUESTA REGISTRADA por el shell secuencial. Los cuatro campos comunes
 * los lee el shell (los puntos van al marcador); el resto lo pone cada
 * plantilla para su propia revisión, y por eso el saco queda abierto.
 * @typedef {{ itemId?: string, value?: unknown, correct?: boolean|null,
 *   points?: number, msTaken?: number, i?: number } & Record<string, unknown>} AnswerRecord
 */

/**
 * EL ESTADO DEL SHELL SECUENCIAL — quién va por dónde y cuánto lleva. Es lo que
 * viaja en `ctx.state` y lo que recibe `callbacks.onFinish`.
 * @typedef {Object} SequentialState
 * @property {number} idx
 * @property {number} score
 * @property {number} startedAt      `clock.now()`.
 * @property {AnswerRecord[]} answers
 */

/**
 * LO QUE EL SHELL SECUENCIAL LE ENTREGA A LA PLANTILLA en cada ítem. Es el
 * contrato que consumen los cores de Quiz, Operaciones y Globos.
 *
 * `submit(record, {auto, delay})` registra la respuesta UNA vez (idempotente
 * dentro del ítem: un timeout y un clic registran una sola) y, con `auto`,
 * avanza tras `delay`. Un core con ritmo propio pasa `{auto:false}` y conduce
 * con `next()` / `finish()`.
 *
 * @template [I=unknown]   la forma del ítem, que solo conoce la plantilla
 * @typedef {Object} SequentialCtx
 * @property {string|Element} rootSel
 * @property {Activity} activity
 * @property {I} item
 * @property {number} idx
 * @property {number} total
 * @property {number} score
 * @property {SequentialState} state
 * @property {number} timerSecs      Segundos por ítem; 0 = sin cuenta atrás.
 * @property {(rec?: AnswerRecord|null, opts?: {auto?: boolean, delay?: number}) => void} submit
 * @property {() => void} next
 * @property {() => void} finish
 * @property {(cb: () => void) => void} alAgotarse  Qué hacer al llegar el reloj a cero.
 */

/**
 * LO QUE LA PLANTILLA APORTA al shell secuencial: cómo se pinta un ítem y, si
 * hace falta, su techo, su ritmo y lo que añade a la pantalla de fin.
 * @template [I=unknown]
 * @typedef {Object} SequentialCallbacks
 * @property {(ctx: SequentialCtx<I>) => void} renderItem
 * @property {(items: I[], activity: Activity) => number} [maxScore]
 * @property {number} [feedbackDelay]
 * @property {(o: {state: SequentialState, items: I[], maxScore: number, timeUsed: number}) => (PantallaFinExtra|null|undefined)} [resultScreen]
 * @property {(state: SequentialState) => void} [onFinish]  Teardown de la plantilla.
 */

/**
 * Lo que se le pide al shell LIBRE para terminar.
 * @typedef {Object} FreeformFinishOpts
 * @property {number} [score]
 * @property {number} [maxScore]
 * @property {TextoDeFin} [lead]
 * @property {TextoDeFin} [stats]
 * @property {string} [title]
 * @property {string} [icon]
 * @property {string} [iconColor]
 * @property {TextoDeFin} [after]   HTML extra BAJO la pantalla estándar.
 * @property {unknown[]} [answers]  Detalle por ítem para la analítica de Tarea.
 */

/**
 * LO QUE DEVUELVE EL SHELL LIBRE. `loadProgress` lee del ALMACÉN, que es
 * frontera: el shell la estrecha UNA vez (`crearProgreso`) y la entrega como
 * saco de campos; qué significa cada campo lo sabe quien lo guardó.
 * @typedef {Object} FreeformCtx
 * @property {(o?: FreeformFinishOpts) => ({timeUsed: number, score: number, maxScore: number}|undefined)} finish
 * @property {(snapshot: unknown) => void} saveProgress
 * @property {() => Record<string, unknown>|null} loadProgress
 * @property {() => boolean} alive
 * @property {(cb: () => void) => void} alAgotarse
 */

// Reanudar al recargar (F5) SOLO en modo individual: guarda el avance (idx/score/
// answers/startedAt) por actividad y lo retoma si el navegador se recarga a mitad.
// NO aplica a Live (el ritmo lo marca el servidor) ni Tarea (registra su propio
// intento), ni a actividades con orden aleatorio (el barajado cambiaría). Se
// invalida si la actividad se editó (updatedAt) y se limpia al terminar/reiniciar.
/** @param {string} id */
const progressKey = (id) => `ww.solo.progress.${id}`;
/** @param {string|null|undefined} activityId */
export function clearSoloProgress(activityId) { if (activityId) lsDel(progressKey(activityId)); }

/**
 * EL PROGRESO GUARDADO, YA ESTRECHADO. El almacén es frontera (`localStorage` +
 * `JSON.parse`): lo que vuelve de ahí es `unknown`, y se convierte en estos
 * campos UNA sola vez, aquí. Quien reanuda (los dos shells, y la ronda de
 * Tildes/Comas a través del shell libre) ya recibe números y listas, no un saco
 * que cada uno tenga que volver a estrechar con sus propios casts.
 * @typedef {Object} ProgresoGuardado
 * @property {number|null} startedAt   Cuándo empezó la partida original.
 * @property {number|null} idx         Shell secuencial: por qué ítem iba.
 * @property {number} score
 * @property {AnswerRecord[]} answers
 * @property {Record<string, unknown>|null} snapshot  Shell libre: lo que guardó el core.
 */

/**
 * Lo que se le pide GUARDAR. Cada shell escribe lo suyo: el secuencial su
 * avance por ítems, el libre el snapshot que le da el core.
 * @typedef {{startedAt?: number, idx?: number, score?: number,
 *   answers?: AnswerRecord[], snapshot?: unknown}} ProgresoAGuardar
 */

/**
 * LA REANUDACIÓN, UNA VEZ PARA LOS DOS SHELLS (§21b). Estaba escrita dos veces
 * —misma clave, mismo `v:1`, misma invalidación por `updatedAt`— y con dos
 * lecturas distintas del mismo JSON.
 * @param {Activity} activity
 * @param {PlayerOpts} opts
 * @returns {{activo: boolean, cargar: () => ProgresoGuardado|null,
 *   guardar: (datos: ProgresoAGuardar) => void, limpiar: () => void}}
 */
function crearProgreso(activity, opts) {
  const activo = (!opts.mode || opts.mode === 'solo') && !activity?.rules?.randomize;
  const key = progressKey(activity.id);
  const num = (/** @type {unknown} */ v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    activo,
    cargar() {
      if (!activo) return null;
      /** @type {unknown} */
      let crudo = null;
      try { crudo = JSON.parse(lsGet(key, '') || 'null'); } catch { crudo = null; }
      if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
      const saco = /** @type {Record<string, unknown>} */ (crudo);
      if (saco.updatedAt !== (activity.updatedAt || '')) return null;   // la actividad se editó
      const snap = saco.snapshot;
      return {
        startedAt: num(saco.startedAt),
        idx: num(saco.idx),
        score: num(saco.score) ?? 0,
        answers: Array.isArray(saco.answers) ? /** @type {AnswerRecord[]} */ (saco.answers) : [],
        snapshot: snap && typeof snap === 'object' && !Array.isArray(snap)
          ? /** @type {Record<string, unknown>} */ (snap)
          : null,
      };
    },
    /** @param {ProgresoAGuardar} datos */
    guardar(datos) {
      if (!activo) return;
      lsSet(key, JSON.stringify({ v: 1, updatedAt: activity.updatedAt || '', ...datos }));
    },
    limpiar() { if (activo) lsDel(key); },
  };
}

/**
 * EL CIERRE DE UNA PARTIDA, UNA VEZ PARA LOS DOS SHELLS (§21b). Los dos hacían
 * lo mismo en distinto orden: el libre guardaba y luego pintaba, el secuencial
 * pintaba y luego guardaba. Se unifica al orden del LIBRE —guardar antes de
 * pintar— porque el registro del resultado no puede quedar a merced de que el
 * pintado salga bien: `mount` toca el DOM (y las plantillas le añaden HTML
 * propio), y si algo de eso lanza, el alumno ya habría terminado sin que su
 * puntaje llegase a `results`. Pintar, en cambio, no depende de guardar.
 * El PODIO se emite aquí (sonido · confeti · la rana que llega a la meta): es
 * del shell, no de cada plantilla — seis lo copiaban a mano y otros seis se
 * quedaban sin él.
 * @param {{rootSel: string|Element, activity: Activity, opts: PlayerOpts,
 *   score: number, maxScore: number, timeUsed: number,
 *   pantalla: Parameters<typeof resultScreenHtml>[0], after?: string}} o
 */
function cerrarPartida({ rootSel, activity, opts, score, maxScore, timeUsed, pantalla, after = '' }) {
  emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score }] });
  trySaveResult(opts, {
    activityId: activity.id,
    scoreAuto: score,
    scoreFinal: score,
    maxScore,
    timeUsed,
  });
  mount(rootSel, resultScreenHtml({ ...pantalla, score, maxScore, mode: opts.mode }) + after);
  cablearRepetir(rootSel, activity.id);
}

// «Jugar otra vez» (core/resultScreen.js) → volver a montar la actividad desde
// cero. Se hace RECARGANDO la página en vez de re-ejecutando el player: la
// ruta ya es la de esta actividad (`#/play/:id`, o el `?id=` del embed), así
// que la recarga es la única forma que no depende de en qué shell/modo estamos
// ni deja a medias los relojes, listeners y progresos del intento anterior.
// El progreso guardado se borra ANTES (si no, «otra vez» reanudaría el final).
/** @param {string|Element} rootSel @param {string} activityId */
function cablearRepetir(rootSel, activityId) {
  const raiz = raizDe(rootSel);
  const btn = raiz?.querySelector('[data-ww-replay]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearSoloProgress(activityId);
    location.reload();
  }, { once: true });
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {PlayerOpts} [opts]
 * @returns {FreeformCtx}
 */
export function runFreeformPlayer(rootSel, activity, opts = {}) {
  let startedAt = clock.now();
  let finished = false;
  // Ficha de ocupación (§23): un timer del core (el spin de la Ruleta, el
  // voltear de Memoria) que dispare con el escenario ya en manos de otra vista
  // u otro modo NO debe repintar — el core pregunta ctx.alive() antes.
  const alive = claimStage(rootSel);

  // EL RELOJ lo monta el SHELL, porque el shell es quien posee el tiempo — el
  // core solo pinta su tablero. Cuál toca (cuenta atrás o cronómetro) lo decide
  // `core/reloj.js`, que es el único que lo sabe; aquí solo se dice DÓNDE se
  // pinta (el chip del HUD, que hudSet re-encuentra aunque el core re-renderice)
  // y hasta cuándo vale (el guard del escenario, §23).
  // `alAgotarse`: qué hace la plantilla cuando el reloj llega a cero (la Sopa
  // termina la partida). El shell monta el reloj UNA vez y lo pinta; la
  // plantilla ya no monta relojes.
  /** @type {(() => void)|null} */
  let alAgotarseCb = null;
  const crono = montarReloj({
    activity, alive,
    pintar: (texto) => hudSet(rootSel, 'tiempo', texto),
    onFin: () => alAgotarseCb?.(),
  });

  // Progreso opt-in para players LIBRES (Memoria, etc.): como el shell no posee
  // el estado del tablero, el core lo aporta. loadProgress() devuelve el snapshot
  // guardado (o null) al montar y restaura el startedAt; saveProgress(snapshot)
  // lo guarda tras cada jugada. Mismas garantías que el secuencial: solo modo
  // individual, invalidado por updatedAt, limpiado al terminar.
  const progreso = crearProgreso(activity, opts);
  /** @returns {Record<string, unknown>|null} */
  function loadProgress() {
    const saved = progreso.cargar();
    if (!saved) return null;
    if (saved.startedAt !== null) startedAt = saved.startedAt;
    return saved.snapshot;
  }
  /** @param {unknown} snapshot */
  function saveProgress(snapshot) {
    if (finished) return;
    progreso.guardar({ startedAt, snapshot });
  }

  // `lead` and `stats` may be strings OR functions of { timeUsed, score,
  // maxScore } — the latter lets a player show the elapsed time without
  // tracking its own clock (the shell owns startedAt).
  /** @param {FreeformFinishOpts} [o] */
  function finish({
    score = 0,
    maxScore = 0,
    lead = '',
    stats = '',
    title = undefined,
    icon = undefined,
    iconColor = undefined,
    after = '',        // HTML extra BAJO la pantalla estándar (p.ej. revisión de errores)
    answers = undefined, // detalle por ítem → llega a opts.onFinish (analítica de Tarea)
  } = {}) {
    if (finished || !alive()) return;   // un final zombi ni guarda ni repinta (§23)
    finished = true;
    crono.stop();   // §23: el reloj se va con su pantalla (y los tests sin DOM real salen limpios)
    progreso.limpiar(); // partida terminada → no reanudar

    const timeUsed = Math.round((clock.now() - startedAt) / 1000);
    const ctx = { timeUsed, score, maxScore };
    const leadStr = typeof lead === 'function' ? lead(ctx) : lead;
    const statsStr = typeof stats === 'function' ? stats(ctx) : stats;

    // EL FINAL LO PONE EL SHELL, SIN SALIDA: una plantilla puede AÑADIR encima
    // (title/icon/stats/after que digan la verdad de cómo acabó) y nunca
    // sustituir la pantalla. Hubo un `skipResultScreen` (2026-09-04, un día):
    // el Crucigrama lo usaba para un cartel propio que dejaba al alumno sin
    // puntaje ni salida, y Abre Cajas sin decir por qué. Se pensó en un mapa
    // de excepciones con motivo y el dueño lo cerró: «todos deben seguir las
    // reglas a rajatabla». Una opción que se ignora es peor que una que no
    // existe — si un player la pasa, `costuras-divergencia` lo caza en CI.
    cerrarPartida({
      rootSel, activity, opts, score, maxScore, timeUsed,
      pantalla: { icon, iconColor, title, lead: leadStr, stats: statsStr },
      after: typeof after === 'function' ? after(ctx) : after,
    });

    if (opts.onFinish) opts.onFinish({ score, maxScore, timeUsed, ...(answers !== undefined ? { answers } : {}) });
    // Lo calculado vuelve al player por si su `after` quiere citarlo.
    return { timeUsed, score, maxScore };
  }

  return { finish, saveProgress, loadProgress, alive, alAgotarse: (/** @type {() => void} */ cb) => { alAgotarseCb = cb; } };
}

// SequentialShell: drives the item-by-item loop common to Quiz and Math.
// The shell owns: items prep (+randomize), state, idx++, optional per-item
// timer, finish() (timeUsed, maxScore, result screen, trySaveResult, onFinish)
// and the QUESTION_SHOWN / PODIUM emits. The CORE (per template) only decides
// HOW to render an item and HOW to score it.
//
// Usage:
//   runSequentialPlayer(rootSel, activity, opts, {
//     renderItem(ctx) {            // ctx = { rootSel, activity, item, idx, total, score, state, timerSecs, submit, alAgotarse }
//       // ...render the item-specific UI...
//       // on answer: ctx.submit({ itemId, value, correct, points, msTaken });
//       // optional: ctx.alAgotarse(() => …)  ← qué hacer si se acaba el tiempo
//     },
//     maxScore(items, activity) { return n; },  // optional override
//   });
//
// submit(record, { auto = true, delay = FEEDBACK_DELAY }):
//   - records the answer once (points → running score, record → answers).
//     Idempotent within an item: a timeout-then-click (or vice versa) records once.
//   - auto (default): schedules the next item after `delay`. Cores with custom,
//     animation-driven pacing pass { auto: false } and drive progression
//     themselves via ctx.next() / ctx.finish().
// ctx.next()   — advance to the next item now (idempotent per item).
// ctx.finish() — end the run now (e.g. reached the finish line before the last item).
// callbacks.resultScreen({ state, items, maxScore, timeUsed }) — optional; return
//   resultScreenHtml options to override the default "Puntos: X / max · Tiempo".
/**
 * @template [I=unknown]
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {PlayerOpts} opts
 * @param {SequentialCallbacks<I>} callbacks
 * @returns {{state: SequentialState}}
 */
export function runSequentialPlayer(rootSel, activity, opts = {}, callbacks) {
  // `content` es de cada modelo (§0): el shell secuencial solo sabe que hay una
  // lista `items`, y la lee por su forma en vez de exigir un contenido concreto.
  const contenido = /** @type {Record<string, unknown>} */ (activity.content || {});
  const source = /** @type {I[]} */ (Array.isArray(contenido.items) ? contenido.items : []);
  const items = (activity.rules?.randomize ? shuffle(source.slice()) : source).slice();
  /** @type {SequentialState} */
  const state = { idx: 0, score: 0, startedAt: clock.now(), answers: [] };
  const timerSecs = activity.rules?.timer ?? 0;
  // Qué reloj toca lo decide `core/reloj.js` (uno para todas). Aquí solo se
  // distingue CUÁNDO se monta: el cronómetro corre toda la partida; la cuenta
  // atrás se rearma en cada ítem, porque el límite es POR ítem.
  const relojTipo = relojDe(activity).tipo;
  // Ficha de ocupación (§23): `setTimeout(next)` y el countdown por ítem
  // sobreviven al cambio de ruta/modo; sus repintados tardíos se descartan.
  const alive = claimStage(rootSel);

  const crono = relojTipo === 'crono'
    ? montarReloj({ activity, alive, pintar: (t) => hudSet(rootSel, 'tiempo', t) })
    : { stop: () => {} };

  // Reanudar (F5): retoma el avance guardado si es de ESTA versión y va a medias.
  const progreso = crearProgreso(activity, opts);
  {
    const saved = progreso.cargar();
    if (saved && saved.idx !== null && Number.isInteger(saved.idx)
        && saved.idx > 0 && saved.idx < items.length) {
      state.idx = saved.idx;
      state.score = saved.score;
      state.answers = saved.answers;
      if (saved.startedAt !== null) state.startedAt = saved.startedAt;
    }
  }
  function persistProgress() {
    if (finished) return;
    if (state.idx <= 0 || state.idx >= items.length) return; // nada útil al inicio/final
    progreso.guardar({ idx: state.idx, score: state.score, answers: state.answers, startedAt: state.startedAt });
  }

  const maxScore = () => (callbacks.maxScore
    ? callbacks.maxScore(items, activity)
    : defaultMaxScore(activity, items.length));

  /** @type {{stop: () => void}|null} */
  let timerHandle = null;
  let recorded = false;   // per-item: answer already taken?
  let stepped = false;    // per-item: already advanced past this item?
  let finished = false;   // run already ended?
  function stopTimer() { if (timerHandle) { timerHandle.stop(); timerHandle = null; } }

  /** @param {AnswerRecord|null|undefined} rec */
  function record(rec) {
    if (recorded) return false;
    recorded = true;
    stopTimer();
    if (rec) {
      state.score += rec.points || 0;
      // Sella el índice de ítem para la analítica por ítem (F3): así el detalle
      // del intento sabe a qué pregunta corresponde cada respuesta.
      state.answers.push({ i: state.idx, ...rec });
    }
    return true;
  }

  function next() {
    if (stepped) return;
    if (!alive()) { stopTimer(); return; }   // avance zombi: el escenario ya es de otro (§23)
    stepped = true;
    stopTimer();
    state.idx++;
    persistProgress();
    renderItem();
  }

  /** @param {AnswerRecord|null} [rec] @param {{auto?: boolean, delay?: number}} [o] */
  function submit(rec, { auto = true, delay = callbacks.feedbackDelay ?? FEEDBACK_DELAY } = {}) {
    if (!record(rec)) return;
    if (auto) setTimeout(next, delay);
  }

  // LO QUE PASA AL AGOTARSE EL TIEMPO lo pone la plantilla (revelar la
  // respuesta, registrar el fallo); PINTAR el reloj es del shell. Antes el
  // player recibía `startTimer({onTick,onTimeout})` y cada uno pintaba su chip:
  // tres copias de la misma línea y ninguna garantía de que el reloj existiera
  // en las demás plantillas.
  /** @type {(() => void)|null} */
  let alAgotarseCb = null;
  /** @param {() => void} cb */
  function alAgotarse(cb) { alAgotarseCb = cb; }
  function montarCuenta() {
    stopTimer();
    if (relojTipo !== 'cuenta') return null;
    timerHandle = montarReloj({
      activity, alive,
      pintar: (texto) => hudSet(rootSel, 'tiempo', texto),
      // SIN LÍMITE NO HAY MISTERIO, PERO CON LÍMITE HAY QUE HACER ALGO. Si la
      // plantilla no dice qué (Operaciones no lo decía), el shell hace lo
      // obvio: se acabó el tiempo de este ítem, se registra sin respuesta y se
      // pasa al siguiente. Antes el reloj llegaba a cero y la pantalla se
      // quedaba quieta — el alumno esperando algo que no iba a pasar.
      onFin: () => {
        timerHandle = null;
        if (alAgotarseCb) return alAgotarseCb();
        const item = /** @type {{id?: string}|undefined} */ (items[state.idx]);
        if (item) submit({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
      },
    });
    return timerHandle;
  }

  function renderItem() {
    recorded = false;
    stepped = false;
    stopTimer();
    if (state.idx >= items.length) return finish();
    const item = items[state.idx];
    emitGame(GameEvents.QUESTION_SHOWN, { idx: state.idx, total: items.length, item });
    callbacks.renderItem({
      rootSel, activity, item,
      idx: state.idx, total: items.length,
      score: state.score, state, timerSecs,
      submit, next, finish, alAgotarse,
    });
    // El reloj se monta DESPUÉS de pintar el ítem: así el primer número aparece
    // sobre la pregunta ya montada y no sobre la anterior.
    montarCuenta();
  }

  function finish() {
    crono.stop();
    if (finished || !alive()) return;   // un final zombi ni guarda ni repinta (§23)
    finished = true;
    stopTimer();
    progreso.limpiar(); // partida terminada → no reanudar
    const timeUsed = Math.round((clock.now() - state.startedAt) / 1000);
    const max = maxScore();
    // Sin salida, como en el shell libre: `resultScreen` AÑADE (título, lead,
    // stats propios) sobre la estándar; nadie la sustituye.
    const custom = callbacks.resultScreen?.({ state, items, maxScore: max, timeUsed }) || {};
    cerrarPartida({
      rootSel, activity, opts, score: state.score, maxScore: max, timeUsed,
      pantalla: {
        lead: `Puntos: <b>${state.score}</b> / ${max}`,
        stats: `Tiempo: ${timeUsed}s`,
        ...custom,
      },
    });
    // Template-level teardown (e.g. reset streaks) runs before the caller's hook.
    callbacks.onFinish?.(state);
    // El caller recibe TAMBIÉN el techo y el tiempo que el shell ya calculó (igual
    // que el shell libre): así Tarea no tiene que recalcularlos por su cuenta y el
    // "X / max" que ve el alumno y el que se registra son el MISMO número.
    if (opts.onFinish) opts.onFinish({ ...state, maxScore: max, timeUsed });
  }

  renderItem();
  return { state };
}
