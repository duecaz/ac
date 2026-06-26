// Simulates TEAMS (turn-based, shared screen) and VS (parallel duel) sessions in
// memory — no DOM, no backend — to prove the unified engine's new formats.
// Run: node tests/sessionEngine.test.mjs
import assert from 'node:assert';
import { createSession, isVsCompatible, FORMATS, sessionItems } from '../kernel/session/engine.js';
import { registerTemplate, getTemplate } from '../core/registry.js';
import { scoreQuizSubmission } from '../templates/quiz/scorer.js';

let passed = 0;
const ok = (m) => { passed++; console.log('  ✓', m); };

// A quiz-like template with the REAL pure scorer + a round payload.
if (!getTemplate('quiz_sess')) registerTemplate({
  meta: { name: 'quiz_sess', contentModel: 'qa', modes: { live: true },
          defaultRules: () => ({}), defaultScoring: () => ({}), defaultLive: () => ({}) },
  renderPlayer() {}, renderEditor() {},
  scoreSubmission: scoreQuizSubmission,
  getRoundPayload(activity, ctx) {
    const it = activity.content.items[ctx.itemIndex];
    return it ? { question: it.question, options: it.options } : null;
  },
  renderRound() {}, // present so isVsCompatible passes (DOM-rendered in views)
});

// A scorer-less template — only valid for teacher-judged teams play.
if (!getTemplate('canvas_judge')) registerTemplate({
  meta: { name: 'canvas_judge', contentModel: 'qa', modes: { solo: true },
          defaultRules: () => ({}), defaultScoring: () => ({}) },
  renderPlayer() {}, renderEditor() {},
});

const quizActivity = {
  id: 'a1', template: 'quiz_sess',
  scoring: { mode: 'flat', pointsPerCorrect: 1, pointsPerWrong: 0 },
  content: { items: [
    { id: 'q1', question: '2+2', answer: '4', options: ['3', '4', '5'], points: 1 },
    { id: 'q2', question: '3+3', answer: '6', options: ['6', '7'], points: 2 },
    { id: 'q3', question: '5+5', answer: '10', options: ['10', '11'], points: 1 },
    { id: 'q4', question: '9-1', answer: '8', options: ['8', '9'], points: 2 },
  ] },
};

// ───────────────────────── TEAMS — auto-scored, turns rotate ─────────────────
{
  const s = createSession(quizActivity, { format: FORMATS.TEAMS, teams: ['Rojo', 'Azul'] });
  assert.strictEqual(s.state.teams.length, 2);
  assert.strictEqual(s.state.scoring, 'auto', 'scorer present → auto');

  s.dispatch('start');
  assert.strictEqual(s.activeTeam().name, 'Rojo', 'team 0 (Rojo) starts');

  // Item 0 → Rojo answers correctly.
  s.submit('t1', 0, '4');
  assert.throws(() => s.submit('t2', 0, '4'), /No es el turno/, 'off-turn team rejected');
  s.dispatch('reveal');
  assert.strictEqual(s.state.teams[0].score, 1, 'Rojo scored item 0');

  // Advance → turn rotates to Azul for item 1.
  s.dispatch('next');
  assert.strictEqual(s.activeTeam().name, 'Azul', 'turn rotated to Azul');
  s.submit('t2', 1, '6');
  s.dispatch('reveal');
  assert.strictEqual(s.state.teams[1].score, 2, 'Azul scored item 1 (2 pts)');

  // Item 2 → back to Rojo, wrong answer scores nothing.
  s.dispatch('next');
  assert.strictEqual(s.activeTeam().name, 'Rojo', 'turn rotated back to Rojo');
  s.submit('t1', 2, '11');
  s.dispatch('reveal');
  assert.strictEqual(s.state.teams[0].score, 1, 'Rojo stays at 1 (wrong)');

  ok('teams (auto): turns rotate per item and only the active team scores');

  const lb = s.leaderboard();
  assert.strictEqual(lb[0].name, 'Azul', 'leaderboard ranks teams by score');
  assert.strictEqual(lb[0].score, 2);
  ok('teams (auto): leaderboard ranks teams by score');
}

// ───────────────────────── TEAMS — teacher judge (no scorer needed) ──────────
{
  const judgeActivity = { ...quizActivity, template: 'canvas_judge' };
  assert.throws(
    () => createSession(judgeActivity, { format: FORMATS.TEAMS, scoring: 'auto' }),
    /scoreSubmission/, 'auto rejected without a scorer');

  const s = createSession(judgeActivity, { format: FORMATS.TEAMS });
  assert.strictEqual(s.state.scoring, 'judge', 'no scorer → judge by default');

  s.dispatch('start');                       // Rojo on item 0 (2+2... but content irrelevant to judge)
  const r = s.judge({ correct: true });      // teacher rules correct → item.points (1)
  assert.strictEqual(r.points, 1);
  assert.strictEqual(s.activeTeam().score, 1, 'judge awards the active team');

  // Re-judging the same item replaces the prior ruling (idempotent score).
  s.judge({ correct: false });
  assert.strictEqual(s.activeTeam().score, 0, 're-judge undoes the previous award');

  s.dispatch('reveal');                       // judge mode: reveal just flips phase
  assert.strictEqual(s.phase, 'reveal');

  s.dispatch('next');                         // → Azul, item 1 (points 2)
  s.judge({ correct: true });
  assert.strictEqual(s.activeTeam().name, 'Equipo 2');
  assert.strictEqual(s.activeTeam().score, 2, 'judge uses item.points when none given');

  s.award('t1', 5);                           // buzzer-bonus steal to Rojo
  assert.strictEqual(s.state.teams[0].score, 5, 'award() grants raw points');
  ok('teams (judge): teacher rules ✓/✗, re-judge is idempotent, award() works');
}

// ───────────────────────────── VS — parallel duel ────────────────────────────
{
  assert.strictEqual(isVsCompatible(quizActivity), true, '4-item quiz is VS-compatible');
  assert.strictEqual(
    isVsCompatible({ ...quizActivity, content: { items: [quizActivity.content.items[0]] } }),
    false, 'single-item activity is NOT VS-compatible');

  const s = createSession(quizActivity, { format: FORMATS.VS, left: 'Ana', right: 'Beto' });
  assert.throws(() => s.answer('left', '4'), /no está en curso/, 'no answers before start');
  s.start();

  // Each side races independently through the same 4 items.
  assert.strictEqual(s.roundPayloadFor('left').question, '2+2', 'left sees its current item');

  s.answer('left', '4');   // +1
  s.answer('left', '6');   // +2  → Ana 3, cursor 2
  let st = s.standings();
  assert.strictEqual(st.leader, 'left', 'Ana leads after pulling ahead');
  assert.strictEqual(st.left.score, 3);
  assert.strictEqual(st.diff, 3);

  s.answer('right', 'wrong'); // 0
  s.answer('right', '6');     // +2 → Beto 2
  st = s.standings();
  assert.strictEqual(st.leader, 'left', 'Ana still ahead 3–2');
  assert.strictEqual(st.right.correct, 1, 'Beto has 1 correct of 2 attempted');
  ok('vs: sides advance independently and standings track the live gap');

  // Ana finishes all her items first. Each side plays at its own pace, so the
  // duel does NOT end yet — Ana's panel shows "done" and she can't answer again,
  // but Beto keeps playing and the session stays running.
  s.answer('left', '10'); s.answer('left', '8');   // Ana done: +1 +2 → 6
  st = s.standings();
  assert.strictEqual(s.status, 'running', 'session stays running until BOTH sides finish');
  assert.strictEqual(st.finished, false, 'standings not finished while one side is mid-duel');
  assert.strictEqual(st.left.score, 6);
  assert.strictEqual(st.left.done, true, 'Ana is marked done');
  assert.strictEqual(st.right.done, false, 'Beto is still playing');
  assert.strictEqual(st.leader, 'left', 'Ana leads 6–2');
  assert.throws(() => s.answer('left', 'x'), /ya terminó/,
    'a finished side cannot keep answering');
  ok('vs: a finished side stops, but the duel runs until BOTH sides complete');

  // Beto plays out his remaining two items → now BOTH are done → duel ends.
  s.answer('right', '10'); s.answer('right', '8'); // Beto: +1 +2 → 5
  st = s.standings();
  assert.strictEqual(s.status, 'ended', 'duel ends once both sides have finished');
  assert.strictEqual(st.finished, true, 'standings report finished when both complete');
  assert.strictEqual(st.right.score, 5, 'Beto finishes with 5');
  assert.strictEqual(st.leader, 'left', 'Ana still wins 6–5');
  assert.throws(() => s.answer('right', 'x'), /no está en curso/,
    'no answers after the duel has ended');
  ok('vs: the duel ends only when the SECOND (last) side finishes too');
}

// ───────────────────── VS — modo carrera (raceToFinish) ──────────────────────
{
  const s = createSession(quizActivity, { format: FORMATS.VS, left: 'Ana', right: 'Beto', raceToFinish: true });
  s.start();

  // Ana races ahead through 3 of 4 items; Beto answers just 1. Still running.
  s.answer('left', '4'); s.answer('left', '6'); s.answer('left', '10');
  s.answer('right', '4');
  let st = s.standings();
  assert.strictEqual(s.status, 'running', 'race still running until someone finishes ALL items');
  assert.strictEqual(st.finished, false, 'not finished mid-race');
  assert.strictEqual(st.finishedBy, null, 'no finisher yet');

  // Ana answers her 4th and LAST item → she finishes first → duel ends NOW,
  // even though Beto has 3 items left.
  s.answer('left', '8');
  st = s.standings();
  assert.strictEqual(s.status, 'ended', 'race ends the instant the first side completes');
  assert.strictEqual(st.finished, true, 'standings finished on first finisher');
  assert.strictEqual(st.finishedBy, 'left', 'Ana is crowned as the side that finished first');
  assert.strictEqual(st.right.done, false, 'Beto never got to finish — race was already won');
  assert.throws(() => s.answer('right', '6'), /no está en curso/,
    'the trailing side cannot answer after the race is won');
  ok('vs (carrera): the duel ends the moment the FIRST side finishes; winner = finishedBy');
}

// ──────────── sessionItems + TEAMS judge over a non-`items` model ────────────
{
  // textCorrection stores rounds under `passages`, not `items`.
  const passagesAct = {
    id: 'tc', template: 'canvas_judge',
    content: { passages: [
      { id: 'p1', text: 'la cancion popular', marks: [{ pos: 6, kind: 'tilde' }] },
      { id: 'p2', text: 'mi mama me ama', marks: [{ pos: 4, kind: 'tilde' }] },
    ] },
  };
  assert.strictEqual(sessionItems(passagesAct).length, 2, 'sessionItems resolves passages as rounds');
  assert.strictEqual(sessionItems({ content: { entries: ['a', 'b', 'c'] } }).length, 3, 'and entries');

  const s = createSession(passagesAct, { format: FORMATS.TEAMS });
  assert.strictEqual(s.totalItems, 2, 'teams session counts passages');
  assert.strictEqual(s.state.scoring, 'judge', 'no scorer → judge');
  s.dispatch('start');
  s.judge({ correct: true });
  assert.strictEqual(s.activeTeam().score, 1, 'judge scores a passage round');
  s.dispatch('reveal'); s.dispatch('next');
  assert.strictEqual(s.currentItem, 1, 'advances to the 2nd passage');
  ok('teams (judge): plays a textCorrection activity (passages) end-to-end');
}

// ───────────── F3: renderRound templates are VS-playable & auto-scored ───────
{
  // Register a tildes-like template with the REAL pure scorer + getRoundPayload.
  const { scoreTildesSubmission } = await import('../templates/tildes/scorer.js');
  if (!getTemplate('tildes_sess')) registerTemplate({
    meta: { name: 'tildes_sess', contentModel: 'textCorrection', modes: { solo: true },
            defaultRules: () => ({}), defaultScoring: () => ({}) },
    renderPlayer() {}, renderEditor() {},
    scoreSubmission: scoreTildesSubmission,
    getRoundPayload(activity, ctx) { const p = activity.content.passages[ctx.itemIndex]; return p ? { id: p.id, text: p.text } : null; },
    renderRound() {}, // present so isVsCompatible passes
  });

  const tildesAct = {
    id: 'ta', template: 'tildes_sess', scoring: { pointsPerCorrect: 1 },
    content: { passages: [
      { id: 'p1', text: 'cancion', marks: [{ pos: 4, kind: 'tilde' }] },   // canción → 'o' at 4
      { id: 'p2', text: 'arbol', marks: [{ pos: 0, kind: 'tilde' }] },      // árbol → 'a' at 0
    ] },
  };

  assert.strictEqual(isVsCompatible(tildesAct), true, 'tildes is VS-compatible (renderRound + scorer + ≥2)');
  // Exact-match scoring: right positions → correct; extra/missing → wrong.
  assert.deepStrictEqual(scoreTildesSubmission({ value: [4], item: tildesAct.content.passages[0], activity: tildesAct }), { correct: true, points: 1 });
  assert.deepStrictEqual(scoreTildesSubmission({ value: [], item: tildesAct.content.passages[0], activity: tildesAct }), { correct: false, points: 0 });
  assert.deepStrictEqual(scoreTildesSubmission({ value: [3, 4], item: tildesAct.content.passages[0], activity: tildesAct }), { correct: false, points: 0 });

  // A VS duel over tildes scores via the engine.
  const vs = createSession(tildesAct, { format: FORMATS.VS, left: 'A', right: 'B' });
  vs.start();
  vs.answer('left', [4]);   // A passage 0 correct → +1
  vs.answer('right', [1]);  // B passage 0 wrong   → 0   (interleaved, before A finishes)
  vs.answer('left', [0]);   // A passage 1 correct → +1  (A done: 2)
  let st = vs.standings();
  assert.strictEqual(st.left.score, 2, 'A scored both passages in VS');
  assert.strictEqual(st.finished, false, 'duel keeps running until B also finishes');
  assert.strictEqual(st.left.done, true, 'A is done while B plays on');
  vs.answer('right', [0]);   // B passage 1 correct → +1 (B done: 1) → both done → ends
  st = vs.standings();
  assert.strictEqual(st.finished, true, 'tildes VS ends once BOTH sides finish');
  assert.strictEqual(st.leader, 'left');
  ok('vs: a renderRound template (tildes) is auto-scored end-to-end');

  // Comas binds the same shared scorer to the 'coma' kind.
  const { scoreComasSubmission } = await import('../templates/comas/scorer.js');
  const comaItem = { text: 'Hola como estas', marks: [{ pos: 3, kind: 'coma' }] };
  assert.deepStrictEqual(scoreComasSubmission({ value: [3], item: comaItem, activity: {} }), { correct: true, points: 1 });
  assert.deepStrictEqual(scoreComasSubmission({ value: [], item: comaItem, activity: {} }), { correct: false, points: 0 });
  ok('comas: shared mark scorer bound to the coma kind');

  // Match: each pair is a matching round, scored by the chosen right side.
  const { scoreMatchSubmission } = await import('../templates/match/scorer.js');
  if (!getTemplate('match_sess')) registerTemplate({
    meta: { name: 'match_sess', contentModel: 'pairs', modes: { solo: true },
            defaultRules: () => ({}), defaultScoring: () => ({}) },
    renderPlayer() {}, renderEditor() {},
    scoreSubmission: scoreMatchSubmission,
    getRoundPayload(activity, ctx) { const p = activity.content.pairs[ctx.itemIndex]; return p ? { question: p.left, options: [p.right] } : null; },
    renderRound() {},
  });
  const matchAct = { id: 'ma', template: 'match_sess', scoring: { pointsPerCorrect: 1 },
    content: { pairs: [{ id: 'm1', left: 'dog', right: 'perro' }, { id: 'm2', left: 'cat', right: 'gato' }] } };
  assert.strictEqual(isVsCompatible(matchAct), true, 'match is VS-compatible');
  assert.deepStrictEqual(scoreMatchSubmission({ value: 'perro', item: matchAct.content.pairs[0], activity: matchAct }), { correct: true, points: 1 });
  assert.deepStrictEqual(scoreMatchSubmission({ value: 'gato', item: matchAct.content.pairs[0], activity: matchAct }), { correct: false, points: 0 });
  const mvs = createSession(matchAct, { format: FORMATS.VS, left: 'A', right: 'B' });
  mvs.start(); mvs.answer('left', 'perro'); mvs.answer('left', 'gato');
  assert.strictEqual(mvs.standings().left.score, 2, 'match VS scores correct picks');
  ok('match: pairs play as matching rounds in VS');
}

// ───────────────────────── Robustness guards (bug-hunt fixes) ───────────────
{
  // Empty-activity SOLO must report 'ended', not hang in 'running'.
  const emptyAct = { id: 'empty', template: 'quiz_sess', scoring: { pointsPerCorrect: 1 }, content: { items: [] } };
  const solo = createSession(emptyAct, { format: FORMATS.SOLO });
  assert.strictEqual(solo.status, 'ended', 'SOLO con 0 ítems termina de inmediato');
  assert.strictEqual(solo.result().done, true, 'result().done coherente con status');
  ok('solo: actividad vacía → status "ended" (no se queda en running)');

  // award() rejects non-numeric deltas instead of poisoning the score with NaN.
  const t = createSession(quizActivity, { format: FORMATS.TEAMS, teams: ['Rojo', 'Azul'] });
  t.dispatch('start');
  const id = t.state.teams[0].id;
  assert.throws(() => t.award(id), /Puntos inválidos/, 'award sin delta → error, no NaN');
  assert.throws(() => t.award(id, 'x'), /Puntos inválidos/, 'award con texto → error');
  assert.strictEqual(t.award(id, 5), 5, 'award con número válido suma');
  assert.ok(Number.isFinite(t.state.teams[0].score), 'el score sigue siendo finito');
  ok('teams: award() valida el delta (sin NaN)');

  // settle() with an out-of-range item degrades to 0 instead of throwing.
  const live = createSession(quizActivity, { format: FORMATS.LIVE });
  assert.strictEqual(live.settle(999), 0, 'settle fuera de rango → 0 sin lanzar');
  ok('live: settle() fuera de rango no lanza');

  // VS points mode: answering fast-but-WRONG must NOT win over correct answers.
  // Both sides answer every item; the winner is whoever got more right.
  const vs = createSession(quizActivity, { format: FORMATS.VS, left: 'Veloz', right: 'Cuidadoso' });
  vs.start();
  const its = sessionItems(quizActivity);
  const wrongFor = (it) => it.options.find(o => o !== it.answer);
  // 'left' (Veloz) blasts through every item WRONG; 'right' (Cuidadoso) answers all correct.
  for (let i = 0; i < its.length; i++) vs.answer('left', wrongFor(its[i]));
  for (let i = 0; i < its.length; i++) vs.answer('right', its[i].answer);
  const st = vs.standings();
  assert.strictEqual(st.finished, true, 'el duelo termina cuando AMBOS acaban');
  assert.strictEqual(st.left.score, 0, 'Veloz (todo mal) suma 0 pese a acabar primero');
  assert.ok(st.right.score > 0, 'Cuidadoso (todo bien) suma puntos');
  assert.strictEqual(st.leader, 'right', 'gana quien más acierta, no quien responde más rápido');
  ok('vs (puntos): acertar gana sobre responder rápido/más');
}

console.log(`\nsessionEngine.test: ${passed} checks passed`);
