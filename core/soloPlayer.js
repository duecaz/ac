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
import { shuffle } from './roundRender.js';
import { createCountdown } from './soloTimer.js';
import { clock } from './clock.js';
import { lsGet, lsSet, lsDel } from './ls.js';

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

export function runFreeformPlayer(rootSel, activity, opts = {}) {
  let startedAt = clock.now();
  let finished = false;

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
    skipResultScreen = false,
  } = {}) {
    if (finished) return;
    finished = true;
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

    if (!skipResultScreen) {
      mount(rootSel, resultScreenHtml({ icon, iconColor, title, lead: leadStr, stats: statsStr, score, maxScore }));
    }

    if (opts.onFinish) opts.onFinish({ score, maxScore, timeUsed });
    // Return the computed values so players with their own end UI (e.g. Crossword's
    // celebration overlay, skipResultScreen) can show the elapsed time.
    return { timeUsed, score, maxScore };
  }

  return { finish, saveProgress, loadProgress };
}

// SequentialShell: drives the item-by-item loop common to Quiz and Math.
// The shell owns: items prep (+randomize), state, idx++, optional per-item
// timer, finish() (timeUsed, maxScore, result screen, trySaveResult, onFinish)
// and the QUESTION_SHOWN / PODIUM emits. The CORE (per template) only decides
// HOW to render an item and HOW to score it.
//
// Usage:
//   runSequentialPlayer(rootSel, activity, opts, {
//     renderItem(ctx) {            // ctx = { rootSel, activity, item, idx, total, score, state, timerSecs, submit, startTimer }
//       // ...render the item-specific UI...
//       // on answer: ctx.submit({ itemId, value, correct, points, msTaken });
//       // optional: ctx.startTimer({ onTick, onTimeout });
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
    : (activity.scoring?.maxScore || ((activity.scoring?.pointsPerCorrect || 1) * items.length)));

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

  function startTimer({ onTick, onTimeout } = {}) {
    if (!(timerSecs > 0)) return null;
    stopTimer();
    timerHandle = createCountdown(timerSecs, {
      onTick,
      onTimeout: () => { timerHandle = null; onTimeout?.(); },
    });
    timerHandle.start();
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
      submit, next, finish, startTimer,
    });
  }

  function finish() {
    if (finished) return;
    finished = true;
    stopTimer();
    if (resumeOn) lsDel(pKey); // partida terminada → no reanudar
    const timeUsed = Math.round((clock.now() - state.startedAt) / 1000);
    const max = maxScore();
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    if (!callbacks.skipResultScreen) {
      const custom = callbacks.resultScreen?.({ state, items, maxScore: max, timeUsed }) || {};
      mount(rootSel, resultScreenHtml({
        lead: `Puntos: <b>${state.score}</b> / ${max}`,
        stats: `Tiempo: ${timeUsed}s`,
        score: state.score, maxScore: max,
        ...custom,
      }));
    }
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore: max, timeUsed });
    // Template-level teardown (e.g. reset streaks) runs before the caller's hook.
    callbacks.onFinish?.(state);
    if (opts.onFinish) opts.onFinish(state);
  }

  renderItem();
  return { state };
}
