// Froggy Jumps — solo player + VS-round renderer.
import { html, escapeHtml, mount } from '../../core/html.js';
import { on } from '../../core/events.js';
import { trySaveResult } from '../../core/results.js';
import { resultScreenHtml } from '../../core/resultScreen.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import * as Streaks from '../../core/streaks.js';
import { scoreFroggy, jumpPads, streakLabel } from './scorer.js';
import { shuffle } from '../../core/roundRender.js';

// Scenario config — emoji pad + CSS class
export const SCENARIOS = {
  swamp:  { label: 'Pantano',  pad: '🪷', css: 'froggy-swamp'   },
  jungle: { label: 'Selva',    pad: '🌿', css: 'froggy-jungle'  },
  space:  { label: 'Espacio',  pad: '🪐', css: 'froggy-space'   },
  winter: { label: 'Hielo',    pad: '❄️',  css: 'froggy-winter'  },
  volcano:{ label: 'Volcán',   pad: '🌋', css: 'froggy-volcano' },
};

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];
const SHAPE_LABELS = ['A', 'B', 'C', 'D'];
const PAD_STRIDE = 72;   // px between pad centres
const FROG_W    = 48;   // px
const VIEWPORT_H = 140; // px

// ── Solo player ───────────────────────────────────────────────────────────────
export async function renderFroggyPlayer(rootSel, activity, opts = {}) {
  let items = (activity.content?.items || []).slice();
  if (activity.rules?.randomize) items = shuffle(items.slice());
  if (!items.length) {
    mount(rootSel, html`<div class="alert alert-warning m-3">No hay preguntas.</div>`);
    return;
  }

  const rules    = activity.rules  || {};
  const scoring  = activity.scoring || {};
  const timerSecs = rules.timer || 0;
  const scene    = SCENARIOS[rules.froggyScenario || activity.presentation?.froggyScenario || 'swamp'] || SCENARIOS.swamp;
  const totalPads = items.length * 4;   // finish line distance
  const ppc      = scoring.pointsPerCorrect || 1;
  const startedAt = Date.now();

  const state = { idx: 0, score: 0, pad: 0, streak: 0, answers: [] };
  let timerHandle = null, timerRemain = timerSecs, t0 = Date.now();
  let animating = false;

  function rootEl() { return typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel; }
  function worldEl()  { return rootEl()?.querySelector('#froggy-world'); }
  function viewportEl() { return rootEl()?.querySelector('#froggy-vp'); }
  function frogEl()  { return rootEl()?.querySelector('#froggy-frog'); }

  // ── Build track ─────────────────────────────────────────────────────────────
  function trackHtml() {
    const worldW = (totalPads + 2) * PAD_STRIDE;
    const pads = Array.from({ length: totalPads + 1 }, (_, i) =>
      `<div class="froggy-pad" style="left:${i * PAD_STRIDE}px">${scene.pad}</div>`
    ).join('');
    return `
      <div id="froggy-vp" class="froggy-vp">
        <div class="froggy-ambient"></div>
        <div id="froggy-world" class="froggy-world" style="width:${worldW}px">
          ${pads}
          <div class="froggy-start-flag" style="left:${-8}px">🚩</div>
          <div class="froggy-finish-flag" style="left:${totalPads * PAD_STRIDE - 4}px">🏁</div>
          <div id="froggy-frog" class="froggy-frog" style="left:0">
            <div class="froggy-streak-badge" id="froggy-badge"></div>
            <div class="froggy-char" id="froggy-char">🐸</div>
            <div class="froggy-shadow"></div>
          </div>
        </div>
      </div>`;
  }

  // ── Render question ──────────────────────────────────────────────────────────
  function renderItem() {
    if (state.idx >= items.length) return finish();
    stopTimer();
    animating = false;
    const item = items[state.idx];
    const opts2 = (activity.rules?.shuffleOptions !== false)
      ? shuffle((item.options || []).slice())
      : (item.options || []).slice();
    t0 = Date.now();
    timerRemain = timerSecs;

    mount(rootSel, html`
      <div class="froggy-game ${scene.css}">
        <div class="froggy-hud">
          <span class="froggy-hud-pos">🐸 ${state.pad}/${totalPads}</span>
          <div class="froggy-hud-center">
            ${state.streak >= 3 ? `<span class="froggy-hud-streak">${streakLabel(state.streak)} ×${state.streak}</span>` : ''}
          </div>
          <span class="froggy-hud-right">
            ${timerSecs > 0 ? `<span class="froggy-timer" id="froggy-timer">⏱ ${timerSecs}</span>` : ''}
            <span class="froggy-score">★ ${state.score}</span>
          </span>
        </div>

        ${trackHtml()}

        <div class="froggy-q-area">
          <div class="froggy-q-number">${state.idx + 1} / ${items.length}</div>
          <div class="froggy-q-text">${escapeHtml(item.question)}</div>
          ${item.image ? `<div class="froggy-q-img"><img src="${escapeHtml(item.image)}" alt=""></div>` : ''}
          <div class="froggy-options">
            ${opts2.map((o, i) => `
              <button class="froggy-opt froggy-opt-${i}" data-value="${escapeHtml(o)}">
                <i class="bi ${SHAPE_ICONS[i % 4]}"></i>
                <span>${escapeHtml(o)}</span>
              </button>`).join('')}
          </div>
        </div>
      </div>
    `);

    // Position frog at current pad (no animation on re-render)
    positionFrog(state.pad, false);
    updateBadge();

    on(rootSel, 'pointerdown', '.froggy-opt', (e, btn) => {
      e.preventDefault();
      if (animating) return;
      stopTimer();
      handleAnswer(btn.dataset.value, btn);
    });

    if (timerSecs > 0) startTimer(item);
  }

  function handleAnswer(value, btn) {
    const ms = Date.now() - t0;
    const item = items[state.idx];
    const r = scoreFroggy({ value, item, msTaken: ms, activity });

    rootEl()?.querySelectorAll('.froggy-opt').forEach(b => { b.style.pointerEvents = 'none'; });
    btn?.classList.add(r.correct ? 'froggy-opt-correct' : 'froggy-opt-wrong');
    if (!r.correct && item.answer != null) {
      const correct = Array.isArray(item.answer) ? item.answer.map(String) : [String(item.answer)];
      rootEl()?.querySelectorAll('.froggy-opt').forEach(b => {
        if (correct.includes(b.dataset.value)) b.classList.add('froggy-opt-correct');
      });
    }

    state.score += r.points;
    state.answers.push({ itemId: item.id, value, correct: r.correct, points: r.points, msTaken: ms });

    if (r.correct) {
      state.streak++;
      const pads = jumpPads(ms, timerSecs, state.streak);
      const newPad = Math.min(state.pad + pads, totalPads);
      const newStreak = Streaks.bump('solo', activity.id, true);
      emitGame(GameEvents.ANSWER_CORRECT, { idx: state.idx, points: r.points, streak: newStreak });
      if (newStreak >= 3) emitGame(GameEvents.STREAK, { count: newStreak });
      showJumpEffect(pads);
      animating = true;
      jumpFrog(state.pad, newPad, pads, () => {
        state.pad = newPad;
        if (newPad >= totalPads) { finish(); return; }
        state.idx++;
        animating = false;
        renderItem();
      });
    } else {
      state.streak = 0;
      Streaks.bump('solo', activity.id, false);
      emitGame(GameEvents.ANSWER_WRONG, { idx: state.idx });
      frogSlip();
      setTimeout(() => { state.idx++; renderItem(); }, 900);
    }
  }

  // ── Frog animation ───────────────────────────────────────────────────────────
  function positionFrog(pad, animate = true) {
    const frog = frogEl();
    if (!frog) return;
    const x = pad * PAD_STRIDE;
    frog.style.transition = animate ? `left 0.5s cubic-bezier(.25,.46,.45,.94)` : 'none';
    frog.style.left = `${x}px`;
    if (animate) scrollViewport(x);
  }

  function jumpFrog(fromPad, toPad, pads, onDone) {
    const frog = frogEl();
    if (!frog) { onDone?.(); return; }
    const toX  = toPad * PAD_STRIDE;
    const arcH = Math.min(20 + pads * 14, 80);
    const dur  = Math.min(350 + pads * 110, 1000);

    frog.style.transition = `left ${dur}ms cubic-bezier(.25,.46,.45,.94)`;
    frog.style.left = `${toX}px`;
    scrollViewport(toX, dur);

    const charEl = rootEl()?.querySelector('#froggy-char');
    if (charEl) {
      charEl.animate([
        { transform: 'scaleX(0.88) scaleY(1.12) translateY(0)',          offset: 0   },
        { transform: `scaleX(0.94) scaleY(1.06) translateY(-${arcH}px)`, offset: 0.45 },
        { transform: `scaleX(1.14) scaleY(0.84) translateY(0)`,          offset: 0.88 },
        { transform: 'scaleX(1)    scaleY(1)    translateY(0)',           offset: 1   },
      ], { duration: dur, easing: 'ease-out' }).onfinish = onDone;
    } else {
      setTimeout(onDone, dur);
    }

    // Golden glow for 10+ streak
    if (state.streak >= 10) charEl?.classList.add('froggy-golden');
    else charEl?.classList.remove('froggy-golden');
  }

  function frogSlip() {
    const charEl = rootEl()?.querySelector('#froggy-char');
    if (!charEl) return;
    charEl.animate([
      { transform: 'rotate(0deg) translateY(0)',  offset: 0   },
      { transform: 'rotate(-20deg) translateY(4px)', offset: 0.3 },
      { transform: 'rotate(15deg) translateY(2px)', offset: 0.6 },
      { transform: 'rotate(0deg) translateY(0)',  offset: 1   },
    ], { duration: 700, easing: 'ease-in-out' });
  }

  function updateBadge() {
    const badge = rootEl()?.querySelector('#froggy-badge');
    if (badge) badge.textContent = streakLabel(state.streak);
  }

  function showJumpEffect(pads) {
    const vp = viewportEl();
    if (!vp) return;
    const colors = ['#fbbf24','#f97316','#10b981','#3b82f6'];
    for (let i = 0; i < Math.min(pads * 3, 12); i++) {
      const p = document.createElement('span');
      p.className = 'froggy-particle';
      p.style.cssText = `
        left:${40 + Math.random() * 60}%;top:${20 + Math.random() * 50}%;
        --dx:${(Math.random() - 0.5) * 80}px;--dy:${-(20 + Math.random() * 50)}px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        width:${5 + Math.random() * 6}px;height:${5 + Math.random() * 6}px;`;
      vp.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
  }

  function scrollViewport(frogX, dur = 400) {
    const vp = viewportEl();
    if (!vp) return;
    const target = frogX - vp.offsetWidth * 0.38;
    vp.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }

  // ── Timer ────────────────────────────────────────────────────────────────────
  function startTimer(item) {
    timerHandle = setInterval(() => {
      timerRemain--;
      emitGame(GameEvents.TICK, { remainSec: timerRemain });
      const el = rootEl()?.querySelector('#froggy-timer');
      if (el) { el.textContent = `⏱ ${timerRemain}`; el.classList.toggle('froggy-timer-urgent', timerRemain <= 5); }
      if (timerRemain <= 0) {
        stopTimer();
        state.answers.push({ itemId: item.id, value: null, correct: false, points: 0, msTaken: timerSecs * 1000 });
        state.streak = 0;
        Streaks.bump('solo', activity.id, false);
        emitGame(GameEvents.ANSWER_WRONG, { idx: state.idx });
        frogSlip();
        setTimeout(() => { state.idx++; renderItem(); }, 900);
      }
    }, 1000);
  }
  function stopTimer() { clearInterval(timerHandle); timerHandle = null; }

  // ── Finish ────────────────────────────────────────────────────────────────────
  function finish() {
    stopTimer();
    const timeUsed = Math.round((Date.now() - startedAt) / 1000);
    const correct = state.answers.filter(a => a.correct).length;
    const max = Math.max(...[items.length * ppc, 1]);
    Streaks.reset('solo', activity.id);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    const racePct = Math.round(state.pad / totalPads * 100);
    mount(rootSel, resultScreenHtml({
      lead: `Puntos: <b>${state.score}</b> · Recorrido: <b>${racePct}%</b> de la pista`,
      stats: `${correct}/${items.length} correctas · ${timeUsed}s`,
      score: state.score, maxScore: max,
    }));
    trySaveResult(opts, { activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore: max, timeUsed });
    if (opts.onFinish) opts.onFinish(state);
  }

  renderItem();
}

// ── VS / Equipos round renderer ───────────────────────────────────────────────
// Compact: mini-track shows both frogs' approximate progress + question below.
export function renderFroggyRound(root, payload, { onSubmit } = {}) {
  const { question, image, options = [], p1Score = 0, p2Score = 0, total = 1,
          itemIndex = 0, scene = 'swamp' } = payload || {};
  const sc = SCENARIOS[scene] || SCENARIOS.swamp;

  // Estimate frog positions from score/total for a visual hint
  const maxPad = 8;
  const p1Pad = Math.round((p1Score / Math.max(total, 1)) * maxPad);
  const p2Pad = Math.round((p2Score / Math.max(total, 1)) * maxPad);
  const pads = Array.from({ length: maxPad + 1 }, (_, i) =>
    `<span class="froggy-mini-pad" style="left:${i * 36}px">${sc.pad}</span>`
  ).join('');

  root.innerHTML = `
    <div class="froggy-game froggy-round ${sc.css}">
      <div class="froggy-mini-track">
        <div class="froggy-mini-world" style="width:${(maxPad + 1) * 36}px">
          ${pads}
          <span class="froggy-mini-frog froggy-mini-p1" style="left:${p1Pad * 36}px">🐸</span>
          <span class="froggy-mini-frog froggy-mini-p2" style="left:${p2Pad * 36}px">🐸</span>
        </div>
        <div class="froggy-mini-finish" style="left:${maxPad * 36}px">🏁</div>
      </div>
      <div class="froggy-q-area">
        <div class="froggy-q-text" style="font-size:clamp(1rem,3cqmin,1.5rem)">${escapeHtml(question || '')}</div>
        ${image ? `<div class="froggy-q-img"><img src="${escapeHtml(image)}" alt=""></div>` : ''}
        <div class="froggy-options">
          ${options.map((o, i) => `
            <button class="froggy-opt froggy-opt-${i}" data-value="${escapeHtml(o)}">
              <i class="bi ${SHAPE_ICONS[i % 4]}"></i>
              <span>${escapeHtml(o)}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;

  let done = false;
  root.querySelectorAll('.froggy-opt').forEach(btn => btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (done) return;
    done = true;
    root.querySelectorAll('.froggy-opt').forEach(b => { b.disabled = true; });
    btn.classList.add('rq-picked');
    // Animate this player's frog forward
    const myFrog = root.querySelector('.froggy-mini-p1');
    if (myFrog) {
      const cur = p1Pad, nxt = Math.min(cur + 2, maxPad);
      myFrog.animate([
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-18px) scale(1.1)', offset: .4 },
        { transform: 'translateY(0) scale(1)', offset: 1 },
      ], { duration: 400 });
      setTimeout(() => { myFrog.style.left = `${nxt * 36}px`; }, 200);
    }
    onSubmit?.(btn.dataset.value);
  }));
}
