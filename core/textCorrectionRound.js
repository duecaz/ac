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
import { isVowel, applyTilde } from './textMarks.js';
import { trySaveResult } from './results.js';
import { resultScreenHtml } from './resultScreen.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { clock } from './clock.js';
import { mountTcDraw } from './textCorrectionDraw.js';
import { observeResize } from './observeResize.js';
import { heatClass } from './itemStats.js';

const HINTS = {
  tilde: 'Toca las vocales que llevan tilde.',
  coma: 'Toca el hueco donde falta una coma.'
};

// Preview de tarjeta (miniatura del home) para Tildes/Comas. Reutiliza el MISMO
// `passageHtml` del juego → la miniatura no puede desincronizarse del player.
// La comparten templates/tildes/template.js y templates/comas/template.js.
export function textCorrectionPreviewHtml(act, kind) {
  const passages = (act.content?.passages || []).filter(p => p && p.text);
  if (!passages.length) {
    return `<div class="ww-player" style="display:flex;align-items:center;justify-content:center">
      <h2 class="text-center">${escapeHtml(act.title || 'Actividad')}</h2></div>`;
  }
  return `<div class="tc-solo">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="badge bg-secondary">Frase 1 / ${passages.length}</span>
      <span class="badge bg-primary">★ 0</span></div>
    <h4 class="text-center mb-1">${escapeHtml(act.title || '')}</h4>
    <div class="tc-round">
      <div class="tc-passage">${passageHtml(passages[0].text, kind)}</div>
      <div class="text-center mt-3"><button type="button" class="btn btn-success btn-lg">
        <i class="bi bi-check2-circle"></i> Listo</button></div>
      <p class="tc-hint text-muted text-center mt-2">${HINTS[kind]}</p>
    </div>
  </div>`;
}
// Build the inline passage. `reveal` (optional) bakes correct/wrong/missed
// classes for a read-only answer review; otherwise targets are interactive.
// Exportada: el preview de tarjeta (core/activityThumb.js) reutiliza ESTE mismo
// markup para que la miniatura sea fiel al juego y no se desfase (los targets
// son spans limpios; solo el canvas los vuelve interactivos).
export function passageHtml(text, kind, reveal) {
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
  // coma: el hueco existe SOLO en el límite fin-de-palabra (un carácter que no es
  // espacio y va seguido de un espacio), nunca entre letras de una palabra.
  const isGap = (i) => i < chars.length - 1 && chars[i] !== ' ' && chars[i + 1] === ' ';
  return chars.map((c, i) => {
    // CORRECCIÓN: el texto tal cual (espacios normales) + la coma solo donde
    // participa (puesta o esperada). Deriva del MISMO texto+marcas: no se guarda
    // una segunda copia "con espacios/comas" que podría desincronizarse.
    if (reveal) {
      if (!isGap(i)) return ch(c);
      if (!reveal.got.has(i) && !reveal.want.has(i)) return ch(c);
      return ch(c) + `<span class="tc-tap tc-gap is-revealed${stateCls(i)}">,</span>`;
    }
    // JUEGO (dibujo): el DETECTOR es el ÚNICO separador entre palabras — se OMITE
    // el espacio literal (antes: detector + espacio = doble hueco, muy separado).
    // El detector es angosto (styles) y <wbr> conserva el corte de línea.
    if (c === ' ') return '';                          // el hueco lo aporta el detector
    if (!isGap(i)) return ch(c);                       // letra dentro de la palabra
    return ch(c) + `<span class="tc-target tc-gap" data-pos="${i}" aria-label="hueco"></span><wbr>`;
  }).join('');
}

// Interactive round (VS / Equipos-auto / LIVE / Solo) — modo DIBUJO: el alumno
// dibuja la marca con lápiz/táctil sobre el texto. onSubmit(value:number[]) al
// pulsar "Listo" (mismas posiciones que el modo tocar → scoring intacto).
export function renderTextCorrectionRound(root, payload, { kind = 'tilde', onSubmit } = {}) {
  const text = payload?.text || '';
  // El botón "Calibrar pizarra" NO va aquí (en el juego): vive en la pantalla de
  // inicio (views/startScreen.js), que es donde van los ajustes previos. En modo
  // tarea (alumno) no hay pizarra que calibrar, así que no debe aparecer nunca
  // durante el ejercicio.
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
  // observeResize (rAF-debounced): fit muta font-size, que puede re-disparar al
  // observer en el mismo frame — norma del proyecto, nunca RO directo en players.
  const stopRo = observeResize(areaEl, fit);
  requestAnimationFrame(fit);
  return stopRo;
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
// advance. Final summary + saveResult. Puntúa POR ACIERTOS (nº de marcas buenas),
// no todo-o-nada por frase.
export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = {}) {
  const passages = (activity.content?.passages || []).filter(p => p.text);
  if (!passages.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene texto.</div>`);
    return;
  }
  const ppc = activity.scoring?.pointsPerCorrect || 1;
  // Puntuación POR ACIERTOS (no todo-o-nada por frase): cada marca correcta suma
  // ppc; las marcas de MÁS restan (suelo 0 por frase, así marcar todo no puntúa).
  // maxScore = total de marcas de la actividad (nº de tildes/comas a colocar).
  const totalMarks = passages.reduce((n, p) => n + (p.marks || []).filter(m => m.kind === kind).length, 0);
  const maxScore = activity.scoring?.maxScore || totalMarks * ppc || passages.length * ppc;
  const startedAt = clock.now();
  let idx = 0, score = 0, hits = 0, misses = 0, over = 0;
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
    const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
    const got = new Set((value || []).map(Number));
    let h = 0, o = 0;
    for (const pos of got) (want.has(pos) ? h++ : o++);
    const miss = want.size - h;
    const pts = Math.max(0, h - o) * ppc;
    score += pts; hits += h; misses += miss; over += o;
    const perfect = miss === 0 && o === 0;
    // Guarda el detalle por frase (aciertos/fallos/de-más + posiciones + puntos) —
    // materia prima de la analítica por palabra del docente (F3).
    passageResults.push({ p, got, want, hits: h, misses: miss, over: o, total: want.size, correct: perfect, points: pts });
    if (perfect) emitGame(GameEvents.ANSWER_CORRECT, { points: pts });
    else emitGame(GameEvents.ANSWER_WRONG, {});
    reveal(value, { hits: h, over: o, misses: miss, total: want.size, correct: perfect });
  }

  function reveal(value, r) {
    const p = passages[idx];
    const want = new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
    const got = new Set(value.map(Number));
    const last = idx === passages.length - 1;
    shell(`
      <div class="tc-round">
        <div class="tc-passage-area"><div class="tc-passage">${passageHtml(p.text, kind, { got, want })}</div></div>
        <div class="tc-done-wrap">
          <span class="tc-verdict ${r.correct ? 'ok' : 'bad'}">
            <i class="bi ${r.correct ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}"></i>
            ${r.hits}/${r.total} aciertos${r.over ? ` · ${r.over} de más` : ''}
          </span>
          <div class="mt-2"><button type="button" class="btn btn-primary btn-lg tc-next">
            ${last ? '<i class="bi bi-flag-fill"></i> Ver resultado' : 'Siguiente <i class="bi bi-arrow-right"></i>'}
          </button></div>
        </div>
      </div>`);
    // El texto de la corrección también LLENA el área (mismo tamaño grande).
    const areaEl = document.querySelector('.tc-passage-area');
    const passageEl = areaEl.querySelector('.tc-passage');
    const stopFit = fitPassage(areaEl, passageEl);
    document.querySelector('.tc-next').addEventListener('click', () => {
      stopFit();
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
    mount(rootSel, resultScreenHtml({ lead: `Aciertos: <b>${hits}</b> / ${totalMarks}`, stats: `${hits} aciertos · ${misses} sin marcar · ${over} de más · ${timeUsed}s`, score, maxScore }) + reviewHtml);
    trySaveResult(opts, { activityId: activity.id, scoreAuto: score, scoreFinal: score, maxScore, timeUsed });
    // Detalle por frase para la analítica de tareas (F3): {i, v: posiciones, c, p}.
    const answers = passageResults.map((r, i) => ({ i, v: [...r.got], c: r.correct, p: r.points || 0 }));
    if (opts.onFinish) opts.onFinish({ score, startedAt, mistakes: misses, answers });
  }

  ask();
}

// Heatmap de analítica (M5): pinta el pasaje con cada marca REQUERIDA coloreada
// por el % de la clase que la acertó (verde ≥80 · ámbar 50-79 · rojo <50), con el
// % en pequeño. `parts` = itemStat.parts de esa frase ({key:pos, pctMarked}).
// Reutiliza applyTilde para mostrar la vocal acentuada / la coma en su sitio.
export function textHeatmapHtml(text, kind, parts) {
  const byPos = new Map((parts || []).map(p => [Number(p.key), p]));
  const s = String(text || '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const p = byPos.get(i);
    if (!p) { out += escapeHtml(s[i]); continue; }
    const cls = heatClass(p.pctMarked);
    const pct = Math.round(p.pctMarked * 100);
    const glyph = kind === 'tilde' ? escapeHtml(applyTilde(s[i])) : escapeHtml(s[i]) + '<b class="tc-heat__coma">,</b>';
    out += `<span class="tc-heat tc-heat--${cls}" title="${pct}% de la clase acertó">${glyph}<sup class="tc-heat__pct">${pct}%</sup></span>`;
  }
  return out;
}
