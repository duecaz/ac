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
import { trySaveResult } from './results.js';
import { resultScreenHtml } from './resultScreen.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { speak, isAvailable as ttsAvailable } from './tts.js';
import { clock } from './clock.js';
import { mountTcDraw } from './textCorrectionDraw.js';

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
      <div class="tc-toolbar">
        <button type="button" class="btn btn-sm btn-primary tc-tool tc-tool-pen is-active" data-tool="pen"><i class="bi bi-pencil-fill"></i> Lápiz</button>
        <button type="button" class="btn btn-sm btn-outline-secondary tc-tool tc-tool-eraser" data-tool="eraser"><i class="bi bi-eraser-fill"></i> Borrador</button>
        <button type="button" class="btn btn-sm btn-outline-danger tc-clear"><i class="bi bi-trash"></i> Limpiar</button>
      </div>
      <div class="tc-passage">${passageHtml(text, kind)}</div>
      <div class="text-center mt-3"><button type="button" class="btn btn-success btn-lg tc-done"><i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="tc-hint text-muted text-center mt-2">${kind === 'tilde' ? 'Dibuja la tilde sobre las vocales que la llevan.' : 'Dibuja la coma en el hueco donde falta.'}</p>
    </div>`;

  const passageEl = root.querySelector('.tc-passage');
  const draw = mountTcDraw(passageEl, { targets: passageEl.querySelectorAll('.tc-target') });

  const tools = root.querySelectorAll('.tc-tool');
  tools.forEach(b => b.addEventListener('click', () => {
    const eraser = b.dataset.tool === 'eraser';
    draw.setEraser(eraser);
    tools.forEach(t => {
      const on = t === b;
      t.classList.toggle('is-active', on);
      t.classList.toggle('btn-primary', on && t.dataset.tool === 'pen');
      t.classList.toggle('btn-warning', on && t.dataset.tool === 'eraser');
      t.classList.toggle('btn-outline-secondary', !on);
    });
  }));
  root.querySelector('.tc-clear').addEventListener('click', () => draw.clear());

  let done = false;
  root.querySelector('.tc-done').addEventListener('click', () => {
    if (done) return;
    done = true;
    draw.freeze();
    onSubmit?.(draw.getMarked());
  });
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
