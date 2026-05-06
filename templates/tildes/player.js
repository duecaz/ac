// Tildes player: drag the tilde icon from the palette onto the vowel that
// should be accented. One palette tilde per expected mark (or unlimited if
// rules.allowOverflow). Tracks correct placements vs wrong attempts.
import { html, escapeHtml, mount } from '../../core/html.js';
import { saveResult } from '../../core/results.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { isVowel, applyTilde } from '../../core/textMarks.js';
import { makeDraggable } from '../../core/dragDrop.js';
import { acquire } from '../../core/lifecycle.js';

export async function renderTildesPlayer(rootSel, activity, opts = {}) {
  const ctx = acquire('tildesPlayer');
  const passages = (activity.content?.passages || []).filter(p => p.text);
  if (!passages.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene texto.</div>`);
    return;
  }

  const ppc = activity.scoring?.pointsPerCorrect || 1;
  const ppw = activity.scoring?.pointsPerWrong || 0;
  const allowOverflow = activity.rules?.allowOverflow !== false;
  const totalExpected = passages.reduce((n, p) => n + (p.marks?.filter(m => m.kind === 'tilde').length || 0), 0);
  const maxScore = activity.scoring?.maxScore || ppc * totalExpected;

  const state = {
    score: 0,
    correct: 0,
    wrong: 0,
    startedAt: Date.now(),
    placements: new Map() // key: passageId+'_'+pos -> bool (true=correct)
  };

  function paint() {
    const expected = passages.reduce((n, p) => n + p.marks.filter(m => m.kind === 'tilde').length, 0);
    const missing = expected - state.correct;
    const paletteCount = allowOverflow ? Math.max(missing, 1) : missing;

    mount(rootSel, html`
      <div class="ww-tildes">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="badge bg-secondary">${state.correct} / ${expected}</span>
          <span class="badge bg-primary">★ ${state.score}</span>
        </div>
        <h4 class="mb-2 text-center">${escapeHtml(activity.title || 'Tildes')}</h4>
        ${activity.subtitle ? `<p class="text-center text-muted">${escapeHtml(activity.subtitle)}</p>` : ''}

        <div class="ww-tildes-passages mt-4">
          ${passages.map(p => renderPassage(p, state)).join('')}
        </div>

        <div class="ww-tildes-palette mt-4 d-flex justify-content-center gap-3 flex-wrap">
          ${paletteCount > 0 ? Array.from({ length: paletteCount }, (_, i) => `
            <div class="ww-tilde-src" data-src="tilde-${i}" title="Arrastra a una vocal">
              <span class="ww-tilde-mark">´</span>
            </div>
          `).join('') : `<button class="btn btn-success" id="ww-finish"><i class="bi bi-check2-circle"></i> Terminar</button>`}
        </div>

        <p class="text-muted small text-center mt-3">Arrastra la tilde sobre la vocal correcta.</p>
      </div>
    `);

    // Wire palette items as draggable. Each src can be used once.
    document.querySelectorAll('.ww-tilde-src').forEach(srcEl => {
      const teardown = makeDraggable(srcEl, {
        kind: 'tilde',
        dropTargetSel: '.ww-vowel:not(.placed)',
        onDrop: (target) => onDropTilde(target, srcEl)
      });
      ctx.add(teardown);
    });

    document.getElementById('ww-finish')?.addEventListener('click', finish);
  }

  function renderPassage(p, st) {
    const expected = new Set(p.marks.filter(m => m.kind === 'tilde').map(m => m.pos));
    return `<div class="ww-passage mb-2 fs-3">
      ${[...p.text].map((ch, i) => {
        const placedKey = `${p.id}_${i}`;
        const placement = st.placements.get(placedKey);
        if (placement === true) {
          return `<span class="ww-vowel placed correct">${escapeHtml(applyTilde(ch))}</span>`;
        }
        if (placement === false) {
          return `<span class="ww-vowel placed wrong">${escapeHtml(ch)}</span>`;
        }
        if (isVowel(ch)) {
          return `<span class="ww-vowel" data-passage="${p.id}" data-pos="${i}" data-expected="${expected.has(i)?'1':'0'}">${escapeHtml(ch)}</span>`;
        }
        return escapeHtml(ch === ' ' ? ' ' : ch);
      }).join('')}
    </div>`;
  }

  function onDropTilde(target, srcEl) {
    const passageId = target.dataset.passage;
    const pos = +target.dataset.pos;
    const expected = target.dataset.expected === '1';
    const key = `${passageId}_${pos}`;
    if (state.placements.has(key)) return false;
    state.placements.set(key, expected);
    if (expected) {
      state.score += ppc;
      state.correct++;
      emitGame(GameEvents.ANSWER_CORRECT, { points: ppc });
    } else {
      state.score += ppw < 0 ? ppw : 0;
      state.wrong++;
      emitGame(GameEvents.ANSWER_WRONG, {});
    }
    // Each tilde is consumed regardless of result.
    srcEl.remove();
    paint();
    if (state.correct >= totalExpected) finish();
    return expected;
  }

  function finish() {
    const timeUsed = Math.round((Date.now() - state.startedAt) / 1000);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: state.score }] });
    mount(rootSel, html`
      <div class="text-center py-5">
        <i class="bi bi-trophy-fill display-1 text-warning"></i>
        <h2 class="mt-3">¡Listo!</h2>
        <p class="lead">Puntos: <b>${state.score}</b> / ${maxScore}</p>
        <p class="text-muted">${state.correct} aciertos · ${state.wrong} fallos · ${timeUsed}s</p>
        <a href="#/home" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a>
      </div>
    `);
    if (opts.mode !== 'async-tracked') {
      saveResult({ activityId: activity.id, scoreAuto: state.score, scoreFinal: state.score, maxScore, timeUsed });
    }
    if (opts.onFinish) opts.onFinish({ score: state.score, startedAt: state.startedAt, mistakes: state.wrong });
  }

  paint();
}
