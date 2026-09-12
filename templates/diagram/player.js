// Diagram player: arrastra cada ETIQUETA a su PIN sobre la imagen (Wordwall
// "Etiqueta el diagrama"). Emparejado libre (no califica hasta pulsar Enviar);
// las etiquetas se reparten izq/der alrededor de la imagen; los pines viven a
// (x,y) sobre ella. Reutiliza el motor de cuerdas core/connectRope.js.
import { html, mount, escapeHtml, raizDe } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GRADE_HOLD_MS } from '../../core/timings.js';
import { shuffle } from '../../core/azar.js';
import { scoreDiagramSubmission } from './scorer.js';
import { ROPES, OK_COL, NO_COL, mountRopeLayer, ropeHtml, ghostHtml, dotPos, puntuarEnlaces, crearArrastreDeCuerdas } from '../../core/connectRope.js';
import { observeResize } from '../../core/observeResize.js';
import { pinUsable } from '../../core/contentModels/diagram.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';
import { setExclusiveLink } from '../../core/linkState.js';

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').DiagramContent} DiagramContent
 * @typedef {import('../../kernel/contracts/activity.js').DiagramPin} DiagramPin
 * @typedef {{id: string, text: string, i: number}} Etiqueta
 * LA FICHA del arrastre: de dónde salió la cuerda. Las coordenadas las lleva la
 * máquina compartida (core/connectRope.js).
 * @typedef {{kind: 'label'|'pin', fromId: string}} Arrastre
 */

/** El id que la etiqueta o el pin llevan en `data-id`.
 * @param {Element} el @returns {string} */
const idDe = (el) => /** @type {HTMLElement} */ (el).dataset.id ?? '';

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 */
export async function renderDiagramPlayer(rootSel, activity, opts = {}) {
  const contenido = /** @type {DiagramContent} */ (activity.content);
  const pins = (contenido?.pins || []).filter(pinUsable);
  const image = contenido?.image || null;
  if (!image || !pins.length) {
    mount(rootSel, html`<div class="alert alert-warning m-4">Esta actividad no tiene imagen o pines.</div>`);
    return;
  }

  // El techo es, POR DEFINICIÓN, lo que da el propio scorer si aciertas todo.
  const pinById = new Map(pins.map(p => [p.id, p]));
  const maxScore = activity.scoring?.maxScore
    || pins.reduce((s, p) => s + scoreDiagramSubmission({ value: p.id, item: p, activity }).points, 0);
  const doShuffle = activity.rules?.randomize !== false;

  // Etiquetas repartidas en dos rieles (start/end). Cada una lleva su índice
  // GLOBAL para el color (cíclico por --ww-shape-*), estable pase al riel que pase.
  const labels = (doShuffle ? shuffle([...pins]) : [...pins]).map((p, i) => ({ id: p.id, text: p.label, i }));
  const half = Math.ceil(labels.length / 2);
  const leftLabels = labels.slice(0, half), rightLabels = labels.slice(half);

  const ctx = runFreeformPlayer(rootSel, activity, opts);
  /** @type {(() => void)|null} */
  let stopRo = null;   // disposer del observeResize del field (se suelta al terminar, §23)

  /** @type {{links: Map<string, string>, graded: boolean}} */
  const state = { links: new Map(), graded: false };  // links: labelId → pinId
  /** @type {{actual: () => import('../../core/connectRope.js').Arrastre<Arrastre>|null}|null} */
  let arrastre = null;

  mount(rootSel, buildLayout(leftLabels, rightLabels, pins, image, activity, pins.length));

  // El marco puede no estar (la ruta cambió mientras se montaba, §23): se
  // comprueba UNA vez y desde aquí abajo las piezas ya no son nulas.
  const raiz = raizDe(rootSel);
  const campo = raiz?.querySelector('.ww-field');
  const lienzo = raiz?.querySelector('.ww-lines-svg');
  if (!raiz || !campo || !lienzo) return;
  const root  = /** @type {HTMLElement} */ (raiz);
  const arena = /** @type {HTMLElement} */ (campo);
  const svg   = /** @type {SVGSVGElement} */ (lienzo);

  const submitBtn  = /** @type {HTMLButtonElement|null} */ (root.querySelector('.dg-submit'));
  const cuerdas = mountRopeLayer(svg);
  if (!cuerdas.layer) return;
  const layer = /** @type {Element} */ (cuerdas.layer);

  const updateProgress = () => hudSet(root, 'pagina', `${state.links.size} / ${pins.length}`);
  const updateSubmit   = () => { if (submitBtn) submitBtn.disabled = state.graded || state.links.size < pins.length; };

  function updateSvg() {
    let d = '', i = 0;
    for (const [labelId, pinId] of state.links) {
      const ld = root.querySelector(`.ww-dot[data-id="${labelId}"]`);
      const pd = root.querySelector(`.dg-pin[data-id="${pinId}"]`);
      if (ld && pd) {
        const col = state.graded ? (labelId === pinId ? OK_COL : NO_COL) : ROPES[i % ROPES.length];
        d += ropeHtml(dotPos(ld, svg), dotPos(pd, svg), col);
      }
      i++;
    }
    const tendiendo = arrastre?.actual();
    if (tendiendo) { const { x1, y1, cx, cy } = tendiendo; d += ghostHtml(x1, y1, cx, cy); }
    layer.innerHTML = d;
  }

  // Un enlace por etiqueta Y por pin: al conectar, se sueltan los previos que usen
  // ese mismo labelId o ese mismo pinId (reconexión libre, como Emparejar).
  /** @param {string} labelId @param {string} pinId */
  function setLink(labelId, pinId) {
    setExclusiveLink(state.links, labelId, pinId);
    refresh();
  }
  /** @param {string} labelId */
  function removeByLabel(labelId) { state.links.delete(labelId); refresh(); }
  /** @param {string} pinId */
  function removeByPin(pinId) { for (const [l, p] of [...state.links]) if (p === pinId) state.links.delete(l); refresh(); }
  function refresh() {
    const linkedLabels = new Set(state.links.keys());
    const linkedPins = new Set(state.links.values());
    root.querySelectorAll('.dg-label').forEach(c => c.classList.toggle('dg-linked', linkedLabels.has(idDe(c))));
    root.querySelectorAll('.dg-pin').forEach(c => c.classList.toggle('dg-linked', linkedPins.has(idDe(c))));
    updateSvg(); updateProgress(); updateSubmit();
  }

  // Destino al soltar: el elemento del TIPO OPUESTO más cercano en 2D, dentro de
  // un radio máximo (soltar lejos = desconectar). Robusto y directo.
  /**
   * @param {string} sel
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} maxDist
   * @returns {Element|null}
   */
  function nearest(sel, clientX, clientY, maxDist) {
    /** @type {Element|null} */
    let best = null;
    let bestD = Infinity;
    root.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.right) / 2 - clientX, dy = (r.top + r.bottom) / 2 - clientY;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = el; }
    });
    return (best && Math.sqrt(bestD) <= maxDist) ? best : null;
  }

  // La máquina del gesto es la compartida (core/connectRope.js, la misma que
  // Emparejar): ancla, fantasma y captura del puntero. Aquí queda solo lo del
  // Diagrama: se agarra una ETIQUETA o un PIN, y el destino es el más cercano
  // del tipo contrario dentro de un radio (soltar lejos = desconectar).
  arrastre = crearArrastreDeCuerdas({
    arena, svg,
    activo: () => !state.graded,
    origen: (e) => {
      const tocado = /** @type {HTMLElement|null} */ (e.target);
      const label = tocado?.closest?.('.dg-label') ?? null;
      const pin   = tocado?.closest?.('.dg-pin') ?? null;
      const from  = label || pin;
      const dotEl = label ? label.querySelector('.ww-dot') : pin;
      if (!from || !dotEl) return null;
      return { ancla: dotEl, datos: { kind: label ? 'label' : 'pin', fromId: idDe(from) } };
    },
    elegirDestino: (x, y, d) => {
      const radius = Math.max(48, arena.getBoundingClientRect().width * 0.12);
      return nearest(d.kind === 'label' ? '.dg-pin' : '.dg-label', x, y, radius);
    },
    alSoltar: (hit, d) => {
      if (d.kind === 'label') { if (hit) setLink(d.fromId, idDe(hit)); else removeByLabel(d.fromId); }
      else                    { if (hit) setLink(idDe(hit), d.fromId); else removeByPin(d.fromId); }
    },
    alPintar: updateSvg,
  });

  // CALIFICAR con lo que haya. El botón solo deja pulsar con todo enlazado,
  // pero el RELOJ no espera a nadie: al agotarse se corrige lo hecho, que es lo
  // honesto — ni se pierde el trabajo ni se deja al alumno mirando una pantalla
  // que ya no responde.
  function calificar() {
    if (state.graded) return;
    state.graded = true;
    // Cada etiqueta enlazada se puntúa con el MISMO scorer de la plantilla:
    // el modo Individual no lleva aritmética propia (era doble contabilidad).
    const { correct, score, wrong } = puntuarEnlaces(state.links,
      (l, p) => scoreDiagramSubmission({ value: p, item: pinById.get(l), activity }));
    root.querySelectorAll('.dg-label, .dg-pin').forEach(c => {
      const id = idDe(c);
      const ok = c.classList.contains('dg-label')
        ? state.links.get(id) === id
        : [...state.links].some(([l, p]) => p === id && l === id);
      c.classList.remove('dg-linked');
      c.classList.add(ok ? 'dg-correct' : 'dg-wrong');
    });
    updateSvg();
    if (submitBtn) submitBtn.disabled = true;
    stopRo?.();   // la pantalla de resultado desmonta el field: suelta el observer
    setTimeout(() => ctx.finish({
      title: correct === pins.length ? '¡Perfecto!' : 'Resultado',
      lead:  `${correct} de ${pins.length} correctas`,
      stats: ({ timeUsed }) => `${wrong} error${wrong !== 1 ? 'es' : ''} · ${timeUsed}s`,
      score, maxScore,
    }), GRADE_HOLD_MS);
  }
  submitBtn?.addEventListener('click', () => {
    if (state.links.size < pins.length) return;   // el botón exige tenerlo todo
    calificar();
  });
  // Se acabó el tiempo (core/reloj.js, si la actividad tiene límite).
  ctx.alAgotarse(calificar);

  // EL TAMAÑO NO LO CALCULA JS. Aquí vivía `fitImageBox()`: leía el escenario,
  // multiplicaba por la proporción natural de la foto y escribía `width`/`height`
  // en píxeles sobre la caja… DESPUÉS de que la actividad ya estuviera pintada.
  // Medido: la imagen pasaba por TRES tamaños al abrir (581 → 580 → 590) y el
  // ojo lo ve como un salto — nace con un tamaño y se recalcula. Y no podía ser
  // de otra forma: quien escribe medidas después de pintar siempre llega tarde,
  // y su ResizeObserver se re-dispara a sí mismo (por eso la guarda y el rAF).
  // El tamaño es LAYOUT, y el layout lo hace el NAVEGADOR antes de pintar: la
  // imagen se contiene sola con `max-width/max-height` y la caja se ciñe a ella
  // (styles/diagram.css), así que los pines en % siguen cayendo exactos.
  // A JS le queda lo único que CSS no sabe decir: las coordenadas de las
  // CUERDAS. Eso no cambia tamaños —solo dibuja líneas—, así que no salta.
  const imgEl = /** @type {HTMLImageElement|null} */ (root.querySelector('.dg-img'));
  // Se observa el FIELD (no el stage): al cruzar el aspecto 1:1 los rieles saltan
  // de columnas a filas → las etiquetas se mueven aunque el stage no cambie de
  // tamaño; hay que redibujar las cuerdas.
  stopRo = observeResize(arena, updateSvg);
  requestAnimationFrame(updateSvg);
  // Contenido de antes de `imageW/imageH`: se le pone la forma UNA vez, cuando
  // la imagen carga. Es un ajuste por actividad vieja, no un cálculo por
  // fotograma — y las nuevas no pasan por aquí.
  const boxEl = /** @type {HTMLElement|null} */ (root.querySelector('.dg-img-box'));
  const ponerForma = () => {
    if (!imgEl || !boxEl || boxEl.style.getPropertyValue('--dg-ar')) return;
    const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight;
    if (!(nw > 0 && nh > 0)) return;
    boxEl.style.setProperty('--dg-ar', `${nw}/${nh}`);
    boxEl.style.setProperty('--dg-arn', String(nw / nh));
  };
  if (imgEl?.complete) ponerForma();
  if (imgEl && !imgEl.complete) imgEl.addEventListener('load', () => { ponerForma(); updateSvg(); });

  updateProgress(); updateSubmit();
}

// ── HTML ──────────────────────────────────────────────────────────────────────
/** @param {Etiqueta} c */
function labelHtml(c) {
  // Color cíclico por índice global (--ww-shape-*): variedad vistosa tipo
  // Wordwall, y el skin lo recolorea. El .ww-dot (conector compartido con
  // Emparejar) lo posiciona diagram.css según el riel Y la orientación.
  // La TINTA viaja con el fondo (--ww-shape-N-fg): la forma 3 es amarilla y el
  // blanco fijo daba 2.4:1 sobre ella — «Cabeza» no se leía a 3 m (§29). Globos
  // y la pregunta en vivo ya emparejaban fondo+tinta así; esta era la que faltaba.
  const n = (c.i % 4) + 1;
  return `<div class="dg-label" data-id="${escapeHtml(c.id)}" style="--dg-color:var(--ww-shape-${n});--dg-fg:var(--ww-shape-${n}-fg, #fff)">
    <span class="dg-label-text">${escapeHtml(c.text)}</span>
    <span class="ww-dot" data-id="${escapeHtml(c.id)}"></span>
  </div>`;
}
/** @param {DiagramPin} p */
function pinHtml(p) {
  return `<span class="dg-pin" data-id="${escapeHtml(p.id)}" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%"></span>`;
}
// LA CAJA NACE CON LA FORMA DE LA FOTO (imageW/imageH, que el editor apunta al
// elegirla). Con la proporción escrita en el HTML, el navegador la encaja de una
// vez —crece hasta llenar el hueco y no lo desborda— y los pines en % caen
// exactos sin que nadie mida nada DESPUÉS de pintar. Sin el dato (actividades de
// antes) sale sin proporción y el player se la pone al cargar la imagen, una
// sola vez.
/**
 * @param {Etiqueta[]} leftLabels
 * @param {Etiqueta[]} rightLabels
 * @param {DiagramPin[]} pins
 * @param {string} image
 * @param {Activity} activity
 * @param {number} total
 */
function buildLayout(leftLabels, rightLabels, pins, image, activity, total) {
  const c = /** @type {DiagramContent} */ (activity.content);
  const w = Number(c?.imageW) || 0, h = Number(c?.imageH) || 0;
  // Dos formas del MISMO dato porque CSS las necesita distintas: la proporción
  // para `aspect-ratio` y el número para multiplicar el alto del hueco.
  const ar = w > 0 && h > 0 ? `--dg-ar:${w}/${h};--dg-arn:${(w / h).toFixed(4)}` : '';
  // Andamio de regiones (styles/scaffold.css): rieles start/end que refluyen de
  // columnas laterales (ancho) a filas arriba/abajo (alto), con el escenario en medio.
  // SIN `p-2`: las utilidades de Bootstrap llevan `!important`, así que ese
  // relleno ganaba a CUALQUIER regla del juego — incluida la reserva que el HUD
  // pide cuando el reloj centrado está a la vista, y por eso el chip volvía a
  // caer sobre «Nariz»/«Ojo» en vertical (medido). El relleno vive ahora en
  // styles/diagram.css, donde se puede razonar con él.
  return `<div class="ww-scaffold dg-play">
  ${cabeceraHtml({ pagina: `0 / ${total}` })}
  <div class="edu-sec edu-sec--campo ww-field dg-field">
    <div class="ww-rail dg-rail" data-rail="start">${leftLabels.map(labelHtml).join('')}</div>
    <div class="ww-stage dg-stage">
      <div class="dg-img-box"${ar ? ` style="${ar}"` : ''}>
        <img class="dg-img" src="${escapeHtml(image)}" alt="" draggable="false">
        ${pins.map(pinHtml).join('')}
      </div>
    </div>
    <div class="ww-rail dg-rail" data-rail="end">${rightLabels.map(labelHtml).join('')}</div>
    <svg class="ww-lines-svg" xmlns="http://www.w3.org/2000/svg"></svg>
  </div>
  <div class="ww-bar ww-bar-actions edu-send">
    <button type="button" class="btn btn-success dg-submit" disabled>
      <i class="bi bi-check2-circle"></i> Enviar respuestas
    </button>
  </div>
</div>`;
}
