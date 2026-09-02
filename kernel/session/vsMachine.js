// ────────────────────────────── VS ──────────────────────────────
// vs     1-vs-1 duel: two sides race through the SAME item sequence in
//        PARALLEL, each auto-scored on submit; standings() drives the central
//        "who's winning" animation. Needs a scorer and ≥2 items to be fair.
//
// Two sides race the SAME items in parallel. No host: each answer is auto-scored
// on submit and advances only that side's own cursor. standings() exposes the
// live gap so the UI can animate who's ahead. Each side plays at its own pace; a
// side that finishes stops there (shows its "done" card) while the other plays
// on, and the match ends only once BOTH sides have completed every item.
//
// v1.51.630: extraído de kernel/session/engine.js al partir el motor POR
// MÁQUINA (docs/leyes.md §0, deuda condicionada de CLAUDE.md). `isVsCompatible`
// se mudó aquí con `createVsSession` (la elegibilidad y la máquina son la
// misma familia) — kernel/session/engine.js la RE-EXPORTA para que sus
// importadores actuales no se enteren del corte.
import { getTemplate } from '../../core/registry.js';
import { supportsLoop } from '../../core/liveLoops.js';
import { sessionItems } from '../content/sessionItems.js';
import { autoScore } from './score.js';
import { FORMATS } from './formats.js';

/** VS pits two sides head-to-head with no host to judge, so it only works on
 *  templates that can both render a single round (renderRound) and self-score
 *  it (scoreSubmission), with enough items for a real race.
 *  EXCEPCIÓN: las plantillas "de tablero" (meta.play.live 'board', p.ej. Ordena las
 *  Pelotas) son UN solo reto compartido — ambos lados resuelven el MISMO tablero
 *  y gana quien termina antes (raceToFinish). Ahí basta con 1 ítem. */
export function isVsCompatible(activity) {
  const T = getTemplate(activity?.template);
  if (!T) return false;
  // DECLARACIÓN (§0): la plantilla dice si juega en VS con meta.play.vs, no se
  // adivina por si tiene scoreSubmission/renderRound — eso es CAPACIDAD, y el
  // contrato (core/templateContract.js) ya EXIGE esos dos métodos a quien
  // declara play.vs!=='none' (líneas 111 y 177), así que aquí basta con leer
  // la declaración.
  const declared = !!T.meta?.play?.vs && T.meta.play.vs !== 'none';
  if (!declared) return false;
  // Aviso defensivo (R6), no criterio: si declaración y capacidad se
  // desalinean, templateContract.js ya rompe CI antes de llegar aquí; esto
  // solo evita un crash si algo se coló.
  if (typeof T.scoreSubmission !== 'function' || typeof T.renderRound !== 'function') {
    console.warn(`[isVsCompatible] ${activity?.template}: declara play.vs="${T.meta.play.vs}" pero le falta scoreSubmission/renderRound (contrato roto)`);
    return false;
  }
  const total = sessionItems(activity).length;
  const minItems = supportsLoop(T, 'board') ? 1 : 2;
  return total >= minItems;
}

function createVsSession(activity, T, opts) {
  const items = sessionItems(activity);
  const total = items.length;
  if (!isVsCompatible(activity)) {
    throw new Error('VS requiere una plantilla con scoreSubmission y ≥2 ítems');
  }

  const side = (id, name) => ({ id, name, score: 0, cursor: 0, correct: 0, answers: [] });
  // Cómo termina el duelo — POLÍTICA DECLARADA por la plantilla en `meta.play.vs`:
  //   'race'   → carrera: el primero que completa todos los ítems gana y cierra
  //              (Operaciones: con reintento, terminar = tenerlo todo bien).
  //   'points' → cada lado va a su ritmo; acaba cuando AMBOS terminan y gana quien
  //              más sumó (Quiz/Emparejar/Tildes: cortar al otro le robaba lo que
  //              llevaba hecho — el bug que reportó QA).
  // `opts.raceToFinish` sigue disponible para forzarlo desde un caller concreto.
  const raceToFinish = opts.raceToFinish ?? (T?.meta?.play?.vs === 'race');
  const state = opts.state ? { ...opts.state } : {
    format: FORMATS.VS,
    code: opts.code || 'VS1',
    status: 'lobby',
    finishedBy: null,
    sides: {
      left: side('left', opts.left || 'Alumno 1'),
      right: side('right', opts.right || 'Alumno 2'),
    },
  };

  const getSide = (id) => state.sides[id] || null;

  function start() {
    if (state.status === 'ended') throw new Error('El duelo ya terminó');
    state.status = 'running';
    return state;
  }

  // Submit one answer for a side. Scored immediately; advances that side only.
  function answer(sideId, value, msTaken = 0) {
    if (state.status !== 'running') throw new Error('El duelo no está en curso');
    const s = getSide(sideId);
    if (!s) throw new Error('Lado desconocido');
    if (s.cursor >= total) throw new Error('Ese lado ya terminó');
    const item = items[s.cursor];
    const r = autoScore(T, { value, item, msTaken, activity, mode: 'vs' });
    // El DETALLE del scorer (aciertos · de más · total de marcas) se conserva
    // cuando lo hay. Sin él, al terminar un duelo de Tildes solo se podía decir
    // "3 de 5 aciertos" y el profe no tenía cómo explicar quién ganó — el dato
    // ya estaba calculado y se tiraba. Las plantillas de todo-o-nada no lo
    // declaran y su resumen se queda en aciertos, como hasta ahora.
    s.answers.push({ index: s.cursor, value, msTaken, correct: r.correct, points: r.points, ...(r.detail ? { detail: r.detail } : {}) });
    s.score += r.points;
    if (r.correct) s.correct += 1;
    s.cursor += 1;
    // Record the FIRST side to complete all items. In points mode this breaks a
    // score tie: Operaciones (math) with unlimited retries advances only on a
    // correct answer, so BOTH sides finish at 100% — a draw on points. The
    // faster finisher should win, not show "empate".
    if (s.cursor >= total && !state.finishedBy) state.finishedBy = sideId;
    if (raceToFinish) {
      // Carrera: el primero que completa todos los ítems gana y cierra el duelo.
      if (s.cursor >= total) state.status = 'ended';
    } else if (state.sides.left.cursor >= total && state.sides.right.cursor >= total) {
      // Puntos: cada lado va a su ritmo; termina cuando AMBOS acaban.
      state.status = 'ended';
    }
    return { correct: r.correct, points: r.points, cursor: s.cursor, done: s.cursor >= total };
  }

  // The central "who's winning" snapshot — score gap plus progress, with a
  // tie-break on items completed so an early lead still reads as "ahead".
  // Suma del detalle por marcas de un lado (Tildes/Comas). `null` cuando el
  // scorer de esta plantilla no lo declara: mejor no decir nada que inventar.
  function marksOf(s) {
    const con = (s.answers || []).filter(a => a.detail);
    if (!con.length) return null;
    const out = con.reduce((acc, a) => ({
      hits: acc.hits + (a.detail.hits || 0),
      over: acc.over + (a.detail.over || 0),
      total: acc.total + (a.detail.total || 0),
      // `marca`: esta plantilla cuenta MARCAS (Tildes/Comas), no respuestas.
      marca: acc.marca || Number.isFinite(a.detail.over),
    }), { hits: 0, over: 0, total: 0, marca: false });
    return out;
  }

  function standings() {
    const L = state.sides.left, R = state.sides.right;
    const diff = L.score - R.score;
    let leader = 'tie';
    if (diff > 0) leader = 'left';
    else if (diff < 0) leader = 'right';
    return {
      left: { name: L.name, score: L.score, cursor: L.cursor, correct: L.correct, done: L.cursor >= total, marks: marksOf(L) },
      right: { name: R.name, score: R.score, cursor: R.cursor, correct: R.correct, done: R.cursor >= total, marks: marksOf(R) },
      leader, diff: Math.abs(diff), total, finished: state.status === 'ended',
      finishedBy: state.finishedBy || null,
      race: raceToFinish,   // la vista decide el podio según la política
    };
  }

  const roundPayloadFor = (sideId) => {
    const s = getSide(sideId);
    if (!s || s.cursor >= total) return null;
    // Pass the side id (so templates can build a DIFFERENT board per side, e.g.
    // word search) and the values already answered (so a free-find board can
    // mark what's done across re-renders). Other templates ignore the extra ctx.
    return T.getRoundPayload
      ? T.getRoundPayload(activity, { itemIndex: s.cursor, side: sideId, found: s.answers.map(a => a.value).filter(Boolean) })
      : null;
  };

  return {
    state, start, answer, standings, roundPayloadFor,
    get status() { return state.status; },
    get totalItems() { return total; },
  };
}

export { createVsSession };
