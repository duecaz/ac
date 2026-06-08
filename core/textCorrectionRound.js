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
import { isVowel, applyTilde, applyMarks, scoreMarks } from './textMarks.js';
import { saveResult } from './results.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { speak, isAvailable as ttsAvailable } from './tts.js';

const HINTS = {
  tilde: 'Toca las vocales que llevan tilde.',
  coma: 'Toca el hueco donde falta una coma.'
};
const SYMBOL = { tilde: ch => applyTilde(ch), coma: () => ',' };

// Build the inline passage. `reveal` (optional) bakes correct/wrong/missed
// classes for a read-only answer review; otherwise targets are interactive.
function passageHtml(text, kind, reveal) {
  const chars = [...text];
  const ch = (c) => `<span class="tc-ch">${escapeHtml(c === ' ' ? ' ' : c)}</span>`;
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
      return `<button type="button" class="tc-tap tc-vowel" data-pos="${i}">${escapeHtml(c)}</button>`;
    }).join('');
  }
  // coma: a gap after every char except the last
  return chars.map((c, i) => {
    const last = i === chars.length - 1;
    if (last) return ch(c);
    if (reveal) {
      const cls = stateCls(i);
      const sym = (reveal.got.has(i) || reveal.want.has(i)) ? ',' : '';
      return ch(c) + `<span class="tc-tap tc-gap is-revealed${cls}">${sym}</span>`;
    }
    return ch(c) + `<button type="button" class="tc-tap tc-gap" data-pos="${i}" aria-label="hueco"></button>`;
  }).join('');
}

// Interactive round for the session formats (VS / Equipos-auto / LIVE).
// onSubmit(value:number[]) fires once when the student presses "Listo".
export function renderTextCorrectionRound(root, payload, { kind = 'tilde', onSubmit } = {}) {
  const text = payload?.text || '';
  const marked = new Set();
  root.innerHTML = `
    <div class="tc-round">
      <div class="tc-passage">${passageHtml(text, kind)}</div>
      <div class="text-center mt-3"><button type="button" class="btn btn-success btn-lg tc-done"><i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="tc-hint text-muted text-center mt-2">${HINTS[kind]}</p>
    </div>`;
  root.querySelectorAll('.tc-tap').forEach(el => el.addEventListener('click', () => {
    const pos = +el.dataset.pos;
    if (marked.has(pos)) { marked.delete(pos); el.classList.remove('on'); el.textContent = kind === 'tilde' ? text[pos] : ''; }
    else { marked.add(pos); el.classList.add('on'); el.textContent = SYMBOL[kind](text[pos]); }
  }));
  let done = false;
  root.querySelector('.tc-done').addEventListener('click', () => {
    if (done) return;
    done = true;
    root.querySelectorAll('.tc-tap').forEach(el => { el.disabled = true; });
    onSubmit?.([...marked].sort((a, b) => a - b));
  });
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
  const startedAt = Date.now();
  let idx = 0, score = 0, correct = 0, wrong = 0;

  const shell = (bodyHtml) => mount(rootSel, html`
    <div class="tc-solo">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="badge bg-secondary">Frase ${idx + 1} / ${passages.length}</span>
        <span class="badge bg-primary">★ ${score}</span>
      </div>
      <h4 class="text-center mb-1">${escapeHtml(title || activity.title || '')}</h4>
      ${activity.subtitle ? `<p class="text-center text-muted mb-2">${escapeHtml(activity.subtitle)}</p>` : ''}
      <div id="tc-body">${bodyHtml}</div>
    </div>`);

  function ask() {
    shell('');
    const body = document.getElementById('tc-body');
    renderTextCorrectionRound(body, passages[idx], { kind, onSubmit: grade });
    addTts(body, passages[idx]);
  }

  function grade(value) {
    const p = passages[idx];
    const r = scoreMarks(value, p, [kind], activity);
    score += r.points;
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
    addTts(document.getElementById('tc-body'), p);
    document.querySelector('.tc-next').addEventListener('click', () => {
      if (last) finish();
      else { idx++; ask(); }
    });
  }

  function addTts(scope, p) {
    if (!ttsAvailable()) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-secondary tc-tts';
    btn.innerHTML = '<i class="bi bi-volume-up-fill"></i> Escuchar';
    btn.addEventListener('click', () => speak(applyMarks(p.text, p.marks || []), { lang: 'es-ES' }));
    scope.querySelector('.tc-round')?.prepend(btn);
  }

  function finish() {
    const timeUsed = Math.round((Date.now() - startedAt) / 1000);
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score }] });
    mount(rootSel, html`
      <div class="text-center py-5">
        <i class="bi bi-trophy-fill display-1 text-warning"></i>
        <h2 class="mt-3">¡Listo!</h2>
        <p class="lead">Puntos: <b>${score}</b> / ${maxScore}</p>
        <p class="text-muted">${correct} aciertos · ${wrong} fallos · ${timeUsed}s</p>
        <a href="#/home" class="btn btn-primary"><i class="bi bi-house"></i> Inicio</a>
      </div>`);
    if (opts.mode !== 'async-tracked') {
      saveResult({ activityId: activity.id, scoreAuto: score, scoreFinal: score, maxScore, timeUsed });
    }
    if (opts.onFinish) opts.onFinish({ score, startedAt, mistakes: wrong });
  }

  ask();
}
