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
import { isVowel, applyTilde, scoreMarksPerHit } from './textMarks.js';
import { GameEvents, emitGame } from './gameEvents.js';
import { runFreeformPlayer } from './soloPlayer.js';
import { mountTcDraw } from './textCorrectionDraw.js';
import { observeResize } from './observeResize.js';
import { fullscreenButtonHtml, attachFullscreenButton } from './fullscreen.js';
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
    <div class="d-flex align-items-center mb-2">
      <span class="badge bg-secondary">Frase 1 / ${passages.length}</span></div>
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
// Exportada: el preview de tarjeta (core/homePreview.js) reutiliza ESTE mismo
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
export function renderTextCorrectionRound(root, payload, { kind = 'tilde', onSubmit, chips = {} } = {}) {
  const text = payload?.text || '';
  // El botón "Calibrar pizarra" NO va aquí (en el juego): vive en la pantalla de
  // inicio (views/startScreen.js), que es donde van los ajustes previos. En modo
  // tarea (alumno) no hay pizarra que calibrar, así que no debe aparecer nunca
  // durante el ejercicio.
  // LÁPIZ / BORRADOR: UN interruptor, no dos botones. La detección por tamaño de
  // contacto (core/penDetector.js) acierta casi siempre —punta dibuja, palma
  // borra—, pero "casi siempre" con 33 críos delante no basta: en una pizarra sin
  // calibrar, o con un lápiz que no reporta el área de contacto, borrar era
  // imposible y el alumno se quedaba con una marca de más (que en Tildes/Comas
  // RESTA: el puntaje es neto). Este mando es el manual — el detector sigue
  // mandando mientras nadie lo toque.
  // FORMA (dueño, 2026-08-15): «lápiz con el borrador es un botón al estilo de
  // switch de apagar/prender luz». Dos pastillas separadas obligaban a leer cuál
  // estaba rellena; un interruptor SE VE de un vistazo a 3 m y dice a la vez en
  // qué está y qué pasa si lo tocas. Y es un solo blanco táctil en vez de dos.
  // NO añade toques a responder (§29): arranca en LÁPIZ, que es lo que el alumno
  // va a hacer; el borrador es para el que se equivoca.
  // MAQUETA (dueño, 2026-08-14): barra ARRIBA con el progreso y las
  // herramientas —como cualquier app de dibujo—, el texto arranca arriba con
  // aire a los costados, y el botón vive ABAJO. Antes las herramientas
  // flotaban en mitad de la pantalla, pegadas al texto, y todo quedaba
  // amontonado en la mitad superior. `chips` lo pasa el caller (HTML propio,
  // ya escapado): la ronda no sabe si corre en solo, carrera o duelo (§0).
  // El botón de PANTALLA COMPLETA va DENTRO de esta barra, no flotando en la
  // esquina del marco: cuando la ronda ya pinta una barra a todo el ancho, un
  // control suelto encima se lee como un segundo mando pegado al papel. La
  // esquina del marco sigue siendo del marco para todo lo demás — aquí la barra
  // la ocupa y por eso la ALOJA (CSS esconde la de la esquina si hay `.tc-bar`).
  // …pero SOLO cuando esta ronda es la pantalla entera (la que trae chips: solo,
  // carrera, tarea). En el duelo se montan DOS rondas, una por jugador: ahí un
  // botón de pantalla completa por panel serían dos mandos para el mismo marco,
  // y la esquina del marco —que es UNA— sigue siendo el sitio correcto.
  const propio = !!(chips.left || chips.right);
  root.innerHTML = `
    <div class="tc-round">
      <div class="tc-bar${propio ? ' tc-bar--fs' : ''}">
        ${chips.left ? `<span class="tc-chip">${chips.left}</span>` : ''}
        <button type="button" class="tc-switch" data-tool="pen" aria-pressed="false"
                title="Lápiz — toca para borrar" aria-label="Lápiz activo. Tocar para pasar al borrador">
          <i class="bi bi-pencil-fill tc-switch__ic tc-switch__ic--pen" aria-hidden="true"></i>
          <span class="tc-switch__track"><span class="tc-switch__knob"></span></span>
          <i class="bi bi-eraser-fill tc-switch__ic tc-switch__ic--er" data-tool="eraser" aria-hidden="true"></i>
        </button>
        ${chips.right ? `<span class="tc-chip tc-chip--right">${chips.right}</span>` : ''}
        ${propio ? fullscreenButtonHtml({ inline: true }) : ''}
      </div>
      <div class="tc-passage-area"><div class="tc-passage">${passageHtml(text, kind)}</div></div>
      <div class="tc-done-wrap"><button type="button" class="btn btn-success btn-lg tc-done" data-ww-submit><i class="bi bi-check2-circle"></i> Listo</button></div>
    </div>`;

  const areaEl = root.querySelector('.tc-passage-area');
  const passageEl = root.querySelector('.tc-passage');
  // El texto LLENA el área disponible (grande en pantalla completa). Se monta el
  // canvas, se ajusta el tamaño de letra al hueco, y se recalculan las zonas.
  const draw = mountTcDraw(passageEl, { targets: passageEl.querySelectorAll('.tc-target') });
  const stopFit = fitPassage(areaEl, passageEl);

  // El botón de pantalla completa expande el MARCO del juego (el del profe o el
  // del alumno); si la ronda corre sin marco, la página entera.
  const marco = root.closest('.ww-player-frame') || document.documentElement;
  const soltarFs = propio
    ? attachFullscreenButton(root.querySelector('.tc-bar'), { target: marco })
    : () => {};

  let done = false;
  const submit = () => {
    if (done) return;
    done = true;
    stopFit();
    soltarFs();
    draw.freeze();
    onSubmit?.(draw.getMarked());
  };
  root.querySelector('.tc-done').addEventListener('click', submit);
  // EL INTERRUPTOR: apagado = lápiz, encendido = borrador. Un solo control que
  // se conmuta, y lo que diga se lo lleva el canvas (`setEraser`).
  const sw = root.querySelector('.tc-switch');
  sw.addEventListener('click', () => {
    if (done) return;
    const borrar = !sw.classList.contains('is-on');
    sw.classList.toggle('is-on', borrar);
    sw.dataset.tool = borrar ? 'eraser' : 'pen';
    sw.setAttribute('aria-pressed', String(borrar));
    sw.title = borrar ? 'Borrador — toca para escribir' : 'Lápiz — toca para borrar';
    sw.setAttribute('aria-label', borrar
      ? 'Borrador activo. Tocar para volver al lápiz'
      : 'Lápiz activo. Tocar para pasar al borrador');
    draw.setEraser(borrar);
  });
  // Contrato opcional de renderRound: `{ flush }` entrega lo dibujado hasta ahora
  // (mismo efecto que pulsar "Listo"). Lo usa studentLive para RESCATAR el trazo
  // en curso cuando el profe avanza antes de que el alumno termine — capacidad
  // declarada por la plantilla, no un querySelector a clases internas.
  // `chromePropio`: esta ronda YA pinta su barra (progreso + herramientas), así
  // que la vista que le pasó `chips` no debe apilar otra encima — dos barras
  // era la captura del dueño. Quien no pase chips no nota nada.
  return { flush: submit, chromePropio: !!(chips.left || chips.right) };
}

// Ajusta el tamaño de letra para que el texto LLENE el área (sin desbordar): el
// texto se ve grande en pantalla completa y se reajusta al cambiar de tamaño
// (fullscreen, rotación). Búsqueda binaria del font-size que cabe en ancho y alto.
// Devuelve una función para detener el observador (al congelar / cambiar de frase).
function fitPassage(areaEl, passageEl) {
  const fit = () => {
    const availW = areaEl.clientWidth, availH = areaEl.clientHeight;
    if (!availW || !availH) return;
    // MEDIDA TIPOGRÁFICA, no relleno. Dos correcciones del dueño con captura:
    // el tope a secas (220px) partía el texto del móvil en líneas de dos
    // palabras gigantes, y availW/12 seguía siendo enorme en PANTALLA COMPLETA
    // (el marco a 1900px daba 158px: tres líneas de borde a borde). Con
    // availW/18 la línea conserva ~30 letras — la maqueta de referencia ronda
    // las 40 por línea — y el piso de 26px mantiene el móvil marcable a dedo.
    let lo = 16, hi = Math.max(26, Math.min(200, availW / 18)), best = 16;
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
  // ANTI-TEMBLOR (dueño, con captura): al entrar en pantalla completa el marco
  // se agranda durante varios frames y cada uno re-ajustaba la letra — las
  // palabras se reordenaban en cascada, «como si temblara». El re-ajuste espera
  // a que el tamaño se ASIENTE (dos medidas iguales con 150 ms entre ellas) y
  // reflowea UNA vez. El primer ajuste sigue siendo inmediato: al abrir la
  // ronda no hay transición que esperar.
  let esperando = null, ultimo = '';
  const asentado = () => {
    esperando = null;
    const ahora = areaEl.clientWidth + 'x' + areaEl.clientHeight;
    if (ahora !== ultimo) { ultimo = ahora; esperando = setTimeout(asentado, 150); return; }
    fit();
  };
  const stopRo = observeResize(areaEl, () => {
    ultimo = areaEl.clientWidth + 'x' + areaEl.clientHeight;
    if (esperando) clearTimeout(esperando);
    esperando = setTimeout(asentado, 150);
  });
  requestAnimationFrame(fit);
  return () => { if (esperando) clearTimeout(esperando); stopRo(); };
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
// advance. Puntúa NETO por marca (scoreMarksPerHit, la fuente única).
//
// C2 de la consolidación: corre sobre el SHELL libre (core/soloPlayer.js) — el
// shell pone timeUsed, la pantalla estándar (+ apéndice de revisión), el guardado
// (trySaveResult según persistPolicy) y la REANUDACIÓN F5, que este runner no
// tenía cuando era el "3er shell" con su copia manual de todo eso.
export function runTextCorrectionSolo(rootSel, activity, opts = {}, { kind, title } = {}) {
  const passages = (activity.content?.passages || []).filter(p => p.text);
  if (!passages.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene texto.</div>`);
    return;
  }
  const ppc = activity.scoring?.pointsPerCorrect || 1;
  // maxScore = total de marcas de la actividad (nº de tildes/comas a colocar).
  const totalMarks = passages.reduce((n, p) => n + (p.marks || []).filter(m => m.kind === kind).length, 0);
  const maxScore = activity.scoring?.maxScore || totalMarks * ppc || passages.length * ppc;

  const ctx = runFreeformPlayer(rootSel, activity, opts);
  let idx = 0, score = 0, hits = 0, misses = 0, over = 0;
  const passageResults = [];

  // Reanudar (F5): el snapshot guarda contadores + el detalle por frase en forma
  // serializable; `got`/`want` (Sets para la corrección visual) se reconstruyen.
  const wantOf = (p) => new Set((p.marks || []).filter(m => m.kind === kind).map(m => m.pos));
  const saved = ctx.loadProgress();
  if (saved && Number.isInteger(saved.idx) && saved.idx > 0 && saved.idx < passages.length
      && Array.isArray(saved.results)) {
    idx = saved.idx; score = saved.score || 0;
    hits = saved.hits || 0; misses = saved.misses || 0; over = saved.over || 0;
    for (const r of saved.results) {
      const p = passages[r.i];
      if (!p) continue;
      passageResults.push({ p, got: new Set(r.got), want: wantOf(p), hits: r.hits, misses: r.misses, over: r.over, total: r.total, correct: r.correct, points: r.points });
    }
  }
  const snapshot = () => ({
    idx, score, hits, misses, over,
    results: passageResults.map((r, i) => ({ i, got: [...r.got], hits: r.hits, misses: r.misses, over: r.over, total: r.total, correct: r.correct, points: r.points })),
  });

  // `conFrase`: el chip «N / M» absoluto solo en las pantallas SIN barra (la
  // corrección); en la ronda el progreso viaja en la barra y duplicarlo estorba.
  const shell = (bodyHtml, { conFrase = true } = {}) => mount(rootSel, html`
    <div class="tc-solo">
      ${conFrase ? `<span class="tc-frase">${idx + 1} / ${passages.length}</span>` : ''}
      <div id="tc-body" class="tc-body">${bodyHtml}</div>
    </div>`);

  function ask() {
    shell('', { conFrase: false });
    const body = document.getElementById('tc-body');
    renderTextCorrectionRound(body, passages[idx], {
      kind, onSubmit: grade,
      chips: { left: `${idx + 1} / ${passages.length}` },
    });
  }

  function grade(value) {
    const p = passages[idx];
    // MISMO scorer que VS/Equipos/Live/Tarea (fuente única): no reimplementamos
    // el conteo aquí. `want/got` solo alimentan la corrección visual y la analítica.
    const want = wantOf(p);
    const got = new Set((value || []).map(Number));
    const r = scoreMarksPerHit(value, p, [kind], activity);
    const miss = r.total - r.hits;
    score += r.points; hits += r.hits; misses += miss; over += r.over;
    // Guarda el detalle por frase (aciertos/fallos/de-más + posiciones + puntos) —
    // materia prima de la analítica por palabra del docente (F3).
    passageResults.push({ p, got, want, hits: r.hits, misses: miss, over: r.over, total: r.total, correct: r.perfect, points: r.points });
    if (r.perfect) emitGame(GameEvents.ANSWER_CORRECT, { points: r.points });
    else emitGame(GameEvents.ANSWER_WRONG, {});
    reveal(value, { hits: r.hits, over: r.over, misses: miss, total: r.total, correct: r.perfect });
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
      else { idx++; ctx.saveProgress(snapshot()); ask(); }
    });
  }

  function finish() {
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score }] });
    const wrongResults = passageResults.filter(r => !r.correct);
    const reviewHtml = wrongResults.length ? `
      <div class="tc-review mt-4 text-start" style="max-width:900px;margin:0 auto;padding:0 1rem">
        <h5 class="mb-3"><i class="bi bi-search"></i> Revisión de errores</h5>
        ${wrongResults.map((r) => `
          <div class="tc-review-item mb-4">
            <div class="tc-passage tc-review-passage">${passageHtml(r.p.text, kind, { got: r.got, want: r.want })}</div>
          </div>`).join('')}
      </div>` : '';
    // El shell pinta la pantalla estándar (+ la revisión como apéndice), guarda el
    // resultado según persistPolicy y entrega `answers` a onFinish (analítica F3).
    ctx.finish({
      score, maxScore,
      lead: `Aciertos: <b>${hits}</b> / ${totalMarks}`,
      stats: ({ timeUsed }) => `${hits} aciertos · ${misses} sin marcar · ${over} de más · ${timeUsed}s`,
      after: reviewHtml,
      answers: passageResults.map((r, i) => ({ i, v: [...r.got], c: r.correct, p: r.points || 0 })),
    });
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
