// Match player: arrastra una cuerda entre dos ítems para emparejarlos.
// EMPAREJADO LIBRE: conectar NO califica — el alumno une todos los pares (puede
// cambiar o quitar conexiones) y pulsa "Enviar"; recién ahí se corrige y puntúa.
// La zona de arrastre es TODA la tarjeta (no solo el punto), en cualquier lado.
import { html, mount, escapeHtml, raizDe } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GRADE_HOLD_MS } from '../../core/timings.js';
import { shuffle } from '../../core/azar.js';
import { scoreMatchSubmission } from './scorer.js';
import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, puntuarEnlaces, crearArrastreDeCuerdas } from '../../core/connectRope.js';
import { observeResize } from '../../core/observeResize.js';
import { pairComplete } from '../../core/contentModels/pairs.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';
import { setExclusiveLink } from '../../core/linkState.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').PairsContent} PairsContent
 */

/** UNA TARJETA del riel: lo que se pinta de un lado del par.
 * @typedef {Object} MatchCard
 * @property {string} id
 * @property {string} text
 * @property {string|null} image
 */

/** LA FICHA del arrastre en curso: de qué tarjeta salió la cuerda. Las
 *  coordenadas las lleva la máquina compartida (core/connectRope.js).
 * @typedef {Object} MatchDrag
 * @property {string} fromSide
 * @property {string} fromId
 */

/** La tarjeta que hay bajo el dedo, estrechada por FORMA (`closest`): bajo Node
 *  —las suites— no existe la clase Element y el arnés entrega objetos de mentira.
 * @param {Event} e @param {string} sel @returns {HTMLElement|null} */
function bajoElDedo(e, sel) {
  const t = /** @type {{closest?: (s: string) => Element|null}|null} */ (e.target);
  return t && typeof t.closest === 'function' ? /** @type {HTMLElement|null} */ (t.closest(sel)) : null;
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export async function renderMatchPlayer(rootSel, activity, opts = {}) {
  // La regla la pone el modelo (core/contentModels/pairs.js), no esta copia:
  // es la misma con la que el editor decide si la actividad está lista.
  const raw = (/** @type {PairsContent} */ (activity.content)?.pairs || []).filter(pairComplete);
  if (!raw.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene pares.</div>`);
    return;
  }

  // El techo es, POR DEFINICIÓN, lo que da el propio scorer si aciertas todo —
  // así no hay una segunda fórmula que pueda desincronizarse.
  const byId = new Map(raw.map(p => [p.id, p]));
  const maxScore = activity.scoring?.maxScore
    || raw.reduce((s, p) => s + scoreMatchSubmission({ value: p.right, item: p, activity }).points, 0);
  const doShuffle = activity.rules?.randomize !== false;
  /** @template T @param {T[]} a @returns {T[]} */
  const quizaBarajar = (a) => (doShuffle ? shuffle(a) : a);

  const lefts  = quizaBarajar(raw.map(p => ({ id: p.id, text: p.left  || '', image: p.leftImage  || p.image || null })));
  const rights = quizaBarajar(raw.map(p => ({ id: p.id, text: p.right || '', image: p.rightImage || null })));

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  /** @type {(() => void)|null} */
  let stopRo = null;   // disposer del observeResize del field (se suelta al terminar)
  /** La cuerda a medio tender la lleva la máquina compartida (se crea abajo).
   * @type {{actual: () => import('../../core/connectRope.js').Arrastre<MatchDrag>|null}|null} */
  let arrastre = null;
  const state = {
    /** @type {Map<string, string>} */
    links:    new Map(),  // leftId → rightId (emparejados por el alumno; cambiables)
    graded:   false,      // true tras pulsar Enviar
  };

  mount(rootSel, buildLayout(lefts, rights, activity, raw.length));

  // `rootSel` puede llegar como Element (así lo declara el contrato): con
  // `document.querySelector(rootSel)` a secas, ese caso se quedaba sin raíz.
  const raiz = raizDe(rootSel);
  const campo = /** @type {HTMLElement|null} */ (raiz?.querySelector('.ww-field'));
  const lienzo = /** @type {SVGElement|null} */ (raiz?.querySelector('.ww-lines-svg'));
  const submitBtn = /** @type {HTMLButtonElement|null} */ (raiz?.querySelector('.ww-match-submit'));

  // Lo que acaba de montar este mismo player: si no está, el marco no es el que
  // se montó (ruta cambiada a mitad) y no hay nada que cablear.
  if (!raiz || !campo || !lienzo) return;
  // Capa de cuerdas — motor compartido core/connectRope.js.
  const capa = mountRopeLayer(lienzo).layer;
  if (!capa) return;
  // Re-atados ya estrechados: las funciones de abajo se crean aquí y corren
  // DESPUÉS, así que no heredan el `if` de arriba.
  const root = raiz, arena = campo, svg = lienzo, layer = capa;
  /** @param {string} sel @returns {NodeListOf<HTMLElement>} */
  const todas = (sel) => /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(sel));

  function updateProgress() {
    hudSet(root, 'pagina', `${state.links.size} / ${raw.length}`);
  }
  function updateSubmit() {
    if (submitBtn) submitBtn.disabled = state.graded || state.links.size < raw.length;
  }

  function updateSvg() {
    let d = '';
    let i = 0;
    for (const [leftId, rightId] of state.links) {
      const ld = root.querySelector(`.ww-dot[data-id="${leftId}"][data-side="L"]`);
      const rd = root.querySelector(`.ww-dot[data-id="${rightId}"][data-side="R"]`);
      if (!ld || !rd) { i++; continue; }
      const p1 = dotPos(ld, svg), p2 = dotPos(rd, svg);
      const col = state.graded ? (leftId === rightId ? OK_COL : NO_COL) : ROPES[i % ROPES.length];
      d += ropeHtml(p1, p2, col);
      i++;
    }
    const tendiendo = arrastre?.actual();
    if (tendiendo) {
      const { x1, y1, cx, cy } = tendiendo;
      d += ghostHtml(x1, y1, cx, cy);
    }
    layer.innerHTML = d;
  }

  // Conecta (o reconecta) un par. Cada tarjeta participa en UNA sola cuerda:
  // se elimina cualquier enlace previo que use ese mismo left o ese mismo right.
  /** @param {string} leftId @param {string} rightId */
  function setLink(leftId, rightId) {
    setExclusiveLink(state.links, leftId, rightId);
    refreshCards();
    updateSvg(); updateProgress(); updateSubmit();
  }
  /** @param {string} side @param {string} id */
  function removeByCard(side, id) {
    if (side === 'L') state.links.delete(id);
    else for (const [l, r] of [...state.links]) if (r === id) state.links.delete(l);
    refreshCards();
    updateSvg(); updateProgress(); updateSubmit();
  }
  // Marca visualmente qué tarjetas están conectadas (sin decir si es correcto).
  function refreshCards() {
    const linkedL = new Set(state.links.keys());
    const linkedR = new Set(state.links.values());
    todas('.ww-card').forEach(c => {
      const id = c.dataset.id ?? '';
      const on = c.dataset.side === 'L' ? linkedL.has(id) : linkedR.has(id);
      c.classList.toggle('ww-card-linked', on);
    });
  }

  // Tarjeta destino al soltar — AGNÓSTICO a la orientación (columnas o filas) y a
  // prueba de geometría. La regla anterior "si el destino queda más cerca del
  // origen que del punto, cancela" era el bug del vertical: con un corredor alto,
  // medio arrastre legítimo cae más cerca del origen y se perdía la conexión.
  // Ahora, en cambio:
  //  1) si soltó DENTRO de una tarjeta del lado opuesto (o su punto), conecta con ESA;
  //  2) si soltó de vuelta sobre su PROPIA tarjeta (toque sin arrastrar / deshacer),
  //     devuelve null → desconecta;
  //  3) en cualquier otro sitio (hueco/corredor), la tarjeta opuesta MÁS cercana por
  //     centro — hay pocas y son grandes, así que "la más cercana" es siempre la
  //     intención. Un arrastre hacia el otro grupo NUNCA se queda sin conectar.
  /** @param {number} x @param {number} y @param {string} fromSide @param {string} fromId
   *  @returns {HTMLElement|null} */
  function targetCard(x, y, fromSide, fromId) {
    const side = fromSide === 'L' ? 'R' : 'L';
    const cards = [...todas(`.ww-card[data-side="${side}"]`)];
    /** @param {DOMRect} r @param {number} m */
    const inRect = (r, m) => x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
    // 1a) ¿soltó sobre el PUNTO conector de una tarjeta opuesta? → esa tarjeta.
    for (const c of cards) {
      const dot = c.querySelector('.ww-dot');
      if (dot && inRect(dot.getBoundingClientRect(), 14)) return c;
    }
    // 1b) ¿soltó DENTRO de una tarjeta opuesta (margen pequeño)? → esa.
    for (const c of cards) if (inRect(c.getBoundingClientRect(), 8)) return c;
    // 2) ¿soltó de vuelta sobre su PROPIA tarjeta? → cancelar (toque sin arrastre / deshacer).
    const origin = root.querySelector(`.ww-card[data-side="${fromSide}"][data-id="${fromId}"]`);
    if (origin && inRect(origin.getBoundingClientRect(), 8)) return null;
    // 3) hueco/corredor: la tarjeta opuesta más cercana por centro (siempre hay una).
    /** @param {Element} el @returns {[number, number]} */
    const cen = el => { const r = el.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; };
    /** @type {HTMLElement|null} */
    let best = null;
    let bestD = Infinity;
    for (const c of cards) { const [cx, cy] = cen(c); const d = (cx - x) ** 2 + (cy - y) ** 2; if (d < bestD) { bestD = d; best = c; } }
    return best;
  }

  // ── Arrastre desde TODA la tarjeta (cualquier lado → el opuesto) ────────────
  // La máquina del gesto es la compartida (core/connectRope.js, la misma que el
  // Diagrama): captura del puntero incluida, así que todos los pointermove/up van
  // a la arena aunque el dedo cruce el corredor o salga de la tarjeta y el
  // navegador NO roba el gesto como scroll (clave en tablets/pizarra);
  // touch-action:none lo refuerza desde CSS. Aquí solo queda lo de Emparejar:
  // se agarra una TARJETA y se suelta sobre la tarjeta del lado opuesto.
  arrastre = crearArrastreDeCuerdas({
    arena, svg,
    activo: () => !state.graded,
    origen: (e) => {
      if (bajoElDedo(e, '.ww-match-submit')) return null;
      const card = bajoElDedo(e, '.ww-card');
      const dot = card?.querySelector('.ww-dot');
      const fromSide = card?.dataset.side, fromId = card?.dataset.id;
      if (!dot || !fromSide || !fromId) return null;
      return { ancla: dot, datos: { fromSide, fromId } };
    },
    elegirDestino: (x, y, d) => targetCard(x, y, d.fromSide, d.fromId),
    alSoltar: (hit, d) => {
      const hitId = /** @type {HTMLElement|null} */ (hit)?.dataset.id;
      if (hitId) {
        const leftId  = d.fromSide === 'L' ? d.fromId : hitId;
        const rightId = d.fromSide === 'L' ? hitId : d.fromId;
        setLink(leftId, rightId);
      } else {
        removeByCard(d.fromSide, d.fromId);   // soltar en su propia tarjeta: desconectar
      }
    },
    alPintar: updateSvg,
  });

  // ── Enviar → corregir y puntuar ─────────────────────────────────────────────
  // CALIFICAR con lo que haya: el botón exige tenerlo todo, pero el reloj no
  // espera. Al agotarse se corrige lo hecho (core/reloj.js).
  function calificar() {
    if (state.graded) return;
    state.graded = true;
    // Cada cuerda se puntúa con el MISMO scorer que usan VS y Equipos: el modo
    // Individual no puede tener su propia aritmética (era la doble contabilidad).
    const { correct, score, wrong } = puntuarEnlaces(state.links,
      (l, r) => scoreMatchSubmission({ value: byId.get(r)?.right ?? '', item: byId.get(l), activity }));
    // Pintar cuerdas + tarjetas según corrección.
    todas('.ww-card').forEach(c => {
      const id = c.dataset.id ?? '', side = c.dataset.side;
      const linkOk = side === 'L'
        ? state.links.get(id) === id
        : [...state.links].some(([l, r]) => r === id && l === id);
      c.classList.remove('ww-card-linked');
      c.classList.add(linkOk ? 'ww-card-correct' : 'ww-card-wrong');
    });
    updateSvg();
    if (submitBtn) submitBtn.disabled = true;
    stopRo?.();   // la pantalla de resultado desmonta el field: suelta el observer
    setTimeout(() => ctx.finish({
      title: correct === raw.length ? '¡Perfecto!' : 'Resultado',
      lead:  `${correct} de ${raw.length} correctas`,
      stats: ({ timeUsed }) => `${wrong} error${wrong !== 1 ? 'es' : ''} · ${timeUsed}s`,
      score, maxScore,
    }), GRADE_HOLD_MS);
  }
  submitBtn?.addEventListener('click', () => {
    if (state.links.size < raw.length) return;   // el botón exige tenerlo todo
    calificar();
  });
  ctx.alAgotarse(calificar);

  // ── Maquetación: SIEMPRE dos columnas laterales (preguntas | respuestas) ─────
  // En ambas orientaciones los rieles son columnas y las cuerdas cruzan el pasillo
  // central en horizontal → nunca pisan otra tarjeta. Cambia el CÁLCULO de tamaño:
  //  · Ancho (landscape): muchas tarjetas caben por alto → se dimensionan por alto,
  //    con tope de ancho ~38% del field (deja pasillo).
  //  · Alto (portrait): pocas tarjetas, ancho por columna ~mitad del field y alto
  //    para apilar las N; con tope legible (nada de tarjetas altísimas casi vacías;
  //    el resto del alto lo reparte space-evenly). El tamaño se calcula del FIELD
  //    (no del riel, que se ciñe a las tarjetas → evita la dependencia circular).
  function fitLayout() {
    const field = root.querySelector('.ww-field');
    if (!field) return;
    const N = Math.max(lefts.length, rights.length);
    const GAP = 8;
    const fw = field.clientWidth, fh = field.clientHeight;
    if (!fw || !fh) return;
    const portrait = fh > fw;
    let cardW, cardH;
    if (!portrait) {
      cardH = Math.max(44, Math.floor(Math.min((fh - (N - 1) * GAP) / N, (fw * 0.38) * 10 / 16)));
      cardW = Math.round(cardH * 16 / 10);
    } else {
      // Dos columnas: ancho por columna ≈ mitad del field menos el pasillo central.
      cardW = Math.max(88, Math.floor((fw - 44) / 2));
      // Alto: que las N quepan apiladas, pero sin pasar de ~0.92·ancho (legible).
      cardH = Math.max(64, Math.floor(Math.min((fh - (N - 1) * GAP) / N, cardW * 0.92)));
    }
    todas('.ww-card').forEach(c => {
      c.style.flex = '0 0 auto'; c.style.width = cardW + 'px'; c.style.height = cardH + 'px';
    });
    updateSvg();                                       // recolocar cuerdas
  }
  requestAnimationFrame(fitLayout);
  // rAF-debounced (observeResize): fitLayout MUTA el tamaño de las tarjetas; un RO
  // directo dispararía el aviso "ResizeObserver loop…" al salir de fullscreen. Se
  // observa el field (al reflujo/redimensión → recalcular tamaños y cuerdas).
  // El disposer se guarda y se suelta al terminar (§23): un RO sobre el DOM ya
  // desmontado no dispara, pero retiene el nodo — fuga de referencia.
  stopRo = observeResize(arena, fitLayout);

  updateProgress();
  updateSubmit();
}

// ── HTML builders ─────────────────────────────────────────────────────────────

/**
 * @param {MatchCard[]} lefts
 * @param {MatchCard[]} rights
 * @param {Activity} activity
 * @param {number} total
 */
function buildLayout(lefts, rights, activity, total) {
  // Andamio de regiones (styles/scaffold.css): dos rieles (start/end) con un
  // corredor central (ww-stage vacío) que las cuerdas cruzan. Emparejar mantiene los
  // rieles como DOS COLUMNAS laterales en ambas orientaciones (ver match.css portrait):
  // así las cuerdas cruzan el pasillo en horizontal y no se solapan con las tarjetas.
  // Sin `p-2` por lo mismo que el Diagrama: una utilidad de Bootstrap lleva
  // `!important` y gana a la reserva que pide el HUD (el relleno vive ahora en
  // styles/match.css). Aquí no había choque medido —el reloj de Emparejar cabe
  // sobre el hueco de las cuerdas—, pero dejarlo sería dejar la misma trampa
  // armada para la siguiente pieza que suba.
  return `<div class="ww-scaffold ww-match">
  ${cabeceraHtml({ pagina: `0 / ${total}` })}
  <div class="edu-sec edu-sec--campo ww-field ww-match-field">
    <div class="ww-rail ww-match-col" data-rail="start">${lefts.map(c => cardHtml(c, 'L')).join('')}</div>
    <div class="ww-stage ww-match-gap"></div>
    <div class="ww-rail ww-match-col" data-rail="end">${rights.map(c => cardHtml(c, 'R')).join('')}</div>
    <svg class="ww-lines-svg" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <div class="ww-bar ww-bar-actions edu-send">
    <button type="button" class="btn btn-success ww-match-submit" disabled>
      <i class="bi bi-check2-circle"></i> Enviar
    </button>
  </div>
</div>`;
}

/** @param {MatchCard} c @param {'L'|'R'} side */
function cardHtml(c, side) {
  const hasImg = !!c.image;
  const img = hasImg ? `<img src="${c.image}" alt="" loading="lazy">` : '';
  const lbl = c.text ? `<span class="ww-card-label">${escapeHtml(c.text)}</span>` : '';
  return `<div class="ww-card${hasImg ? ' ww-card-img' : ''}" data-id="${escapeHtml(c.id)}" data-side="${side}">
  <span class="ww-dot" data-id="${escapeHtml(c.id)}" data-side="${side}"></span>
  ${img}${lbl}
</div>`;
}


