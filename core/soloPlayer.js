// FreeformShell: guarantees resultScreenHtml + trySaveResult + onFinish for
// players whose finish moment is not a sequential item-by-item loop
// (Wheel, Question-Live, Memory, Match, Wordsearch, Crossword).
//
// Usage:
//   const ctx = runFreeformPlayer(rootSel, activity, opts);
//   // ... player-specific logic ...
//   ctx.finish({ score, maxScore, lead, stats });  // call once when done
import { mount } from './html.js';
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

// Reanudar al recargar (F5) SOLO en modo individual: guarda el avance (idx/score/
// answers/startedAt) por actividad y lo retoma si el navegador se recarga a mitad.
// NO aplica a Live (el ritmo lo marca el servidor) ni Tarea (registra su propio
// intento), ni a actividades con orden aleatorio (el barajado cambiaría). Se
// invalida si la actividad se editó (updatedAt) y se limpia al terminar/reiniciar.
const progressKey = (id) => `ww.solo.progress.${id}`;
function canResumeSolo(activity, opts) {
  return (!opts.mode || opts.mode === 'solo') && !activity?.rules?.randomize;
}
export function clearSoloProgress(activityId) { if (activityId) lsDel(progressKey(activityId)); }

// «Jugar otra vez» (core/resultScreen.js) → volver a montar la actividad desde
// cero. Se hace RECARGANDO la página en vez de re-ejecutando el player: la
// ruta ya es la de esta actividad (`#/play/:id`, o el `?id=` del embed), así
// que la recarga es la única forma que no depende de en qué shell/modo estamos
// ni deja a medias los relojes, listeners y progresos del intento anterior.
// El progreso guardado se borra ANTES (si no, «otra vez» reanudaría el final).
function cablearRepetir(rootSel, activityId) {
  const raiz = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  const btn = raiz?.querySelector('[data-ww-replay]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearSoloProgress(activityId);
    location.reload();
  }, { once: true });
}

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
  const resumeOn = canResumeSolo(activity, opts);
  const pKey = progressKey(activity.id);
  function loadProgress() {
    if (!resumeOn) return null;
    let saved = null;
    try { saved = JSON.parse(lsGet(pKey, '') || 'null'); } catch { saved = null; }
    if (!saved || saved.updatedAt !== (activity.updatedAt || '')) return null;
    if (saved.startedAt) startedAt = saved.startedAt;
    return saved.snapshot ?? null;
  }
  function saveProgress(snapshot) {
    if (!resumeOn || finished) return;
    lsSet(pKey, JSON.stringify({ v: 1, updatedAt: activity.updatedAt || '', startedAt, snapshot }));
  }

  // `lead` and `stats` may be strings OR functions of { timeUsed, score,
  // maxScore } — the latter lets a player show the elapsed time without
  // tracking its own clock (the shell owns startedAt).
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
    if (resumeOn) lsDel(pKey); // partida terminada → no reanudar

    const timeUsed = Math.round((clock.now() - startedAt) / 1000);
    const ctx = { timeUsed, score, maxScore };
    const leadStr = typeof lead === 'function' ? lead(ctx) : lead;
    const statsStr = typeof stats === 'function' ? stats(ctx) : stats;

    trySaveResult(opts, {
      activityId: activity.id,
      scoreAuto: score,
      scoreFinal: score,
      maxScore,
      timeUsed,
    });

    // EL FINAL LO PONE EL SHELL, SIN SALIDA: una plantilla puede AÑADIR encima
    // (title/icon/stats/after que digan la verdad de cómo acabó) y nunca
    // sustituir la pantalla. Hubo un `skipResultScreen` (2026-09-04, un día):
    // el Crucigrama lo usaba para un cartel propio que dejaba al alumno sin
    // puntaje ni salida, y Abre Cajas sin decir por qué. Se pensó en un mapa
    // de excepciones con motivo y el dueño lo cerró: «todos deben seguir las
    // reglas a rajatabla». Una opción que se ignora es peor que una que no
    // existe — si un player la pasa, `costuras-divergencia` lo caza en CI.
    mount(rootSel, resultScreenHtml({ icon, iconColor, title, lead: leadStr, stats: statsStr, score, maxScore, mode: opts.mode })
      + (typeof after === 'function' ? after(ctx) : after));
    cablearRepetir(rootSel, activity.id);

    if (opts.onFinish) opts.onFinish({ score, maxScore, timeUsed, ...(answers !== undefined ? { answers } : {}) });
    // Lo calculado vuelve al player por si su `after` quiere citarlo.
    return { timeUsed, score, maxScore };
  }

  return { finish, saveProgress, loadProgress, alive, alAgotarse: (cb) => { alAgotarseCb = cb; } };
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
export function runSequentialPlayer(rootSel, activity, opts = {}, callbacks = {}) {
  const source = activity.content?.items || [];
  const items = (activity.rules?.randomize ? shuffle(source.slice()) : source).slice();
  const state = { idx: 0, score: 0, startedAt: clock.now(), answers: [] };
  const timerSecs = activity.rules?.timer ?? 0;
  // Qué reloj toca lo decide `core/reloj.js` (uno para las 13). Aquí solo se
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
  const resumeOn = canResumeSolo(activity, opts);
  const pKey = progressKey(activity.id);
  if (resumeOn) {
    let saved = null;
    try { saved = JSON.parse(lsGet(pKey, '') || 'null'); } catch { saved = null; }
    if (saved && saved.updatedAt === (activity.updatedAt || '') && Array.isArray(saved.answers)
        && Number.isInteger(saved.idx) && saved.idx > 0 && saved.idx < items.length) {
      state.idx = saved.idx;
      state.score = saved.score || 0;
      state.answers = saved.answers;
      state.startedAt = saved.startedAt || state.startedAt;
    }
  }
  function persistProgress() {
    if (!resumeOn || finished) return;
    if (state.idx <= 0 || state.idx >= items.length) return; // nada útil al inicio/final
    lsSet(pKey, JSON.stringify({ v: 1, updatedAt: activity.updatedAt || '', idx: state.idx, score: state.score, answers: state.answers, startedAt: state.startedAt }));
  }

  const maxScore = () => (callbacks.maxScore
    ? callbacks.maxScore(items, activity)
    : defaultMaxScore(activity, items.length));

  let timerHandle = null;
  let recorded = false;   // per-item: answer already taken?
  let stepped = false;    // per-item: already advanced past this item?
  let finished = false;   // run already ended?
  function stopTimer() { if (timerHandle) { timerHandle.stop(); timerHandle = null; } }

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

  function submit(rec, { auto = true, delay = callbacks.feedbackDelay ?? FEEDBACK_DELAY } = {}) {
    if (!record(rec)) return;
    if (auto) setTimeout(next, delay);
  }

  // LO QUE PASA AL AGOTARSE EL TIEMPO lo pone la plantilla (revelar la
  // respuesta, registrar el fallo); PINTAR el reloj es del shell. Antes el
  // player recibía `startTimer({onTick,onTimeout})` y cada uno pintaba su chip:
  // tres copias de la misma línea y ninguna garantía de que el reloj existiera
  // en las demás plantillas.
  let alAgotarseCb = null;
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
        const item = items[state.idx];
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
    if (resumeOn) lsDel(pKey); // partida terminada → no reanudar
    const timeUsed = Math.round((clock.now() - state.startedAt) / 1000);
    const max = maxScore();
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    // Sin salida, como en el shell libre: `resultScreen` AÑADE (título, lead,
    // stats propios) sobre la estándar; nadie la sustituye.
    {
      const custom = callbacks.resultScreen?.({ state, items, maxScore: max, timeUsed }) || {};
      mount(rootSel, resultScreenHtml({
        lead: `Puntos: <b>${state.score}</b> / ${max}`,
        stats: `Tiempo: ${timeUsed}s`,
        score: state.score, maxScore: max, mode: opts.mode,
        ...custom,
      }));
      cablearRepetir(rootSel, activity.id);
    }
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore: max, timeUsed });
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
