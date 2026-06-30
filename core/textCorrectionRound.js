// Shared text-correction round — the single, touch-first mechanic for Tildes
// and Comas (and any future "mark the text" template). One passage per screen,
// big tap targets, tap-to-toggle (no drag): works the same on mouse, touch and
// IR pen, and reflows into a narrow VS panel.
//
//   kind 'tilde' → tap the VOWELS that take an accent.
//   kind 'coma'  → tap the GAP between two words where a comma is missing.
//
// value is number[]: for tildes, the char positions marked; for comas, the
// index of the char AFTER which the comma goes (matches the answer-key `pos`).
import { html, escapeHtml, mount } from './html.js';
import { isVowel, applyTilde, scoreMarks } from './textMarks.js';
import { trySaveResult } from './results.js';
import { resultScreenHtml } from './resultScreen.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { clock } from './clock.js';
import { mountTcDraw } from './textCorrectionDraw.js';

const HINTS = {
  tilde: 'Toca las vocales que llevan tilde.',
  coma: 'Toca el hueco donde falta una coma.'
};
// Build the inline passage. `reveal` (optional) bakes correct/wrong/missed
// classes for a read-only answer review; otherwise targets are interactive.
function passageHtml(text, kind, reveal) {
  const chars = [...text];
  // ESPACIOS como texto crudo y rompible (antes era \u00a0 = no-rompible, por eso
  // no cortaba la linea): las palabras quedan enteras y el texto envuelve al marco.
  const ch = (c) => c === ' ' ? ' ' : `<span class="tc-ch">${escapeHtml(c)}</span>`;
  const stateCls = (pos, isTargetMarkable) => {
    if (!reveal) return '';
    const got = reveal.got.has(pos), want = reveal.want.has(pos);
    if (got && want) return ' ok';
    if (got && !want) return ' bad';
    if (!got && want) return ' miss';
    return '';
  };

  if (kind === 'tilde') {
    return chars.map((c, i) => {
      if (!isVowel(c)) return ch(c);
      if (reveal) {
        const cls = stateCls(i);
        const show = (reveal.got.has(i) || reveal.want.has(i)) ? applyTilde(c) : c;
        return `<span class="tc-tap tc-vowel is-revealed${cls}">${escapeHtml(show)}</span>`;
      }
      // Modo DIBUJO: el target es un span de solo lectura; el canvas captura el
      // trazo y la zona de este span decide la marca (data-pos).
      return `<span class="tc-target tc-vowel" data-pos="${i}">${escapeHtml(c)}</span>`;
    }).join('');
  }
  // coma: gaps only at word-end boundaries (after a non-space before a space)
  // to prevent placing commas inside words.
  return chars.map((c, i) => {
    const last = i === chars.length - 1;
    if (last) return ch(c);
    if (reveal) {
      const cls = stateCls(i);
      const sym = (reveal.got.has(i) || reveal.want.has(i)) ? ',' : '';
      return ch(c) + `<span class="tc-tap tc-gap is-revealed${cls}">${sym}</span>`;
    }
    if (c === ' ' || chars[i + 1] !== ' ') return ch(c);
    return ch(c) + `<span class="tc-target tc-gap" data-pos="${i}" aria-label="hueco"></span>`;
  }).join('');
}

// Interactive round (VS / Equipos-auto / LIVE / Solo) — modo DIBUJO: el alumno
// dibuja la marca con lápiz/táctil sobre el texto. onSubmit(value:number[]) al
// pulsar "Listo" (mismas posiciones que el modo tocar → scoring intacto).
export function renderTextCorrectionRound(root, payload, { kind = 'tilde', onSubmit } = {}) {
  const text = payload?.text || '';
  root.innerHTML = `
    <div class="tc-round">
      <div class="tc-passage-area"><div class="tc-passage">${passageHtml(text, kind)}</div></div>
      <div class="tc-done-wrap"><button type="button" class="btn btn-success btn-lg tc-done"><i class="bi bi-check2-circle"></i> Listo</button></div>
    </div>`;

  const areaEl = root.querySelector('.tc-passage-area');
  const passageEl = root.querySelector('.tc-passage');
  // El texto LLENA el área disponible (grande en pantalla completa). Se monta el
  // canvas, se ajusta el tamaño de letra al hueco, y se recalculan las zonas.
  const draw = mountTcDraw(passageEl, { targets: passageEl.querySelectorAll('.tc-target') });
  const stopFit = fitPassage(areaEl, passageEl);

  let done = false;
  root.querySelector('.tc-done').addEventListener('click', () => {
    if (done) return;
    done = true;
    stopFit();
    draw.freeze();
    onSubmit?.(draw.getMarked());
  });
}

// Ajusta el tamaño de letra para que el texto LLENE el área (sin desbordar): el
// texto se ve grande en pantalla completa y se reajusta al cambiar de tamaño
// (fullscreen, rotación). Búsqueda binaria del font-size que cabe en ancho y alto.
// Devuelve una función para detener el observador (al congelar / cambiar de frase).
function fitPassage(areaEl, passageEl) {
  let raf = 0;
  const fit = () => {
    const availW = areaEl.clientWidth, availH = areaEl.clientHeight;
    if (!availW || !availH) return;
    let lo = 16, hi = 220, best = 16;
    for (let i = 0; i < 13; i++) {
      const mid = (lo + hi) / 2;
      passageEl.style.fontSize = mid + 'px';
      // Cabe si el contenido no desborda el área en ninguna dirección.
      if (passageEl.scrollWidth <= availW + 1 && passageEl.scrollHeight <= availH + 1) {
        best = mid; lo = mid;
      } else {
        hi = mid;
      }
    }
    passageEl.style.fontSize = best + 'px';
    // El canvas de dibujo observa passageEl y recalcula sus zonas solo.
  };
  const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); };
  const ro = new ResizeObserver(schedule);
  ro.observe(areaEl);
  schedule();
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

// Projector (host) view for LIVE: the passage big and read-only. In the reveal
// phase, show the solution with the correct marks highlighted (green).
export function renderTextCorrectionHost(root, { phase, item, kind = 'tilde' } = {}) {
  const text = item?.text || '';
  if (phase === 'reveal') {
    const want = new Set((item?.marks || []).filter((m) => m.kind === kind).map((m) => m.pos));
    root.innerHTML = `
      <div class="tc-passage">${passageHtml(text, kind, { got: want, want })}</div>
      <p class="text-center text-success fw-bold mt-2"><i class="bi bi-check-circle-fill"></i> Solución</p>`;
    return;
  }
  root.innerHTML = `
    <div class="tc-passage">${escapeHtml(text)}</div>
    <p class="text-center text-muted mt-2">${HINTS[kind]}</p>`;
}

// Full SOLO runner shared by Tildes and Comas: paginate passages one per
// screen, tap to mark, "Listo" reveals the correct/wrong/missed marks, then
// advance. Final summary + saveResult, identical scoring to VS (scoreMarks).
export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = {}) {
  const passages = (activity.content?.passages || []).filter(p => p.text);
  if (!passages.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene texto.</div>`);
    return;
  }
  const ppc = activity.scoring?.pointsPerCorrect || 1;
  const maxScore = activity.scoring?.maxScore || passages.length * ppc;
  const startedAt = clock.now();
  let idx = 0, score = 0, correct = 0, wrong = 0;
  const passageResults = [];

  const shell = (bodyHtml) => mount(rootSel, html`
    <div class="tc-solo">
      <span class="tc-frase">${idx + 1} / ${passages.length}</span>
      <div id="tc-body" class="tc-body">${bodyHtml}</div>
    </div>`);

  function ask() {
    shell('');
    const body = document.getElementById('tc-body');
    renderTextCorrectionRound(body, passages[idx], { kind, onSubmit: grade });
  }

  function grade(value) {
    const p = passages[idx];
    const r = scoreMarks(value, p, [kind], activity);
    score += r.points;
    const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
    passageResults.push({ p, got: new Set(value.map(Number)), want, correct: r.correct });
    if (r.correct) { correct++; emitGame(GameEvents.ANSWER_CORRECT, { points: r.points }); }
    else { wrong++; emitGame(GameEvents.ANSWER_WRONG, {}); }
    reveal(value, r);
  }

  function reveal(value, r) {
    const p = passages[idx];
    const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
    const got = new Set(value.map(Number));
    const last = idx === passages.length - 1;
    shell(`
      <div class="tc-round">
        <div class="tc-passage">${passageHtml(p.text, kind, { got, want })}</div>
        <div class="text-center mt-3">
          <span class="tc-verdict ${r.correct ? 'ok' : 'bad'}">
            <i class="bi ${r.correct ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
            ${r.correct ? '¡Correcto!' : 'Revisa las marcas'}
          </span>
          <div class="mt-3"><button type="button" class="btn btn-primary btn-lg tc-next">
            ${last ? '<i class="bi bi-flag-fill"></i> Ver resultado' : 'Siguiente <i class="bi bi-arrow-right"></i>'}
          </button></div>
        </div>
      </div>`);
    document.querySelector('.tc-next').addEventListener('click', () => {
      if (last) finish();
      else { idx++; ask(); }
    });
  }

  function finish() {
    const timeUsed = Math.round((clock.now() - startedAt) / 1000);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score }] });
    const wrongResults = passageResults.filter(r => !r.correct);
    const reviewHtml = wrongResults.length ? `
      <div class="tc-review mt-4 text-start" style="max-width:900px;margin:0 auto;padding:0 1rem">
        <h5 class="mb-3"><i class="bi bi-search"></i> Revisión de errores</h5>
        ${wrongResults.map((r, i) => `
          <div class="tc-review-item mb-4">
            <div class="tc-passage tc-review-passage">${passageHtml(r.p.text, kind, { got: r.got, want: r.want })}</div>
          </div>`).join('')}
      </div>` : '';
    mount(rootSel, resultScreenHtml({ lead: `Puntos: <b>${score}</b> / ${maxScore}`, stats: `${correct} aciertos · ${wrong} fallos · ${timeUsed}s`, score, maxScore }) + reviewHtml);
    trySaveResult(opts, { activityId: activity.id, scoreAuto: score, scoreFinal: score, maxScore, timeUsed });
    if (opts.onFinish) opts.onFinish({ score, startedAt, mistakes: wrong });
  }

  ask();
}
