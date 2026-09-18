// Tangram — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): un
// tablero SVG de una sola pantalla, sin botones (submit:'gesto' — encajar la
// última pieza ES terminar). Las piezas, sus gestos y su pintado son del
// TABLERO compartido con el editor (game/tablero.js); aquí solo se decide
// dónde nace cada pieza (la bandeja), el viewBox y qué pasa al soltar
// (comprobar «resuelto»). La silueta que se cubre ES la unión de las
// colocaciones que dejó el docente (`poligonosDe`), y su caja se DERIVA.
import { html, mount, raizDe, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { PIEZAS, ORDEN_PIEZAS } from './game/piezas.js';
import { transformarPieza, poligonosDe, bboxDe } from './game/geometria.js';
import { estaResuelto, MARGEN_CAJA } from './game/mascara.js';
import { montarTablero, siluetaHtml } from './game/tablero.js';
import { scoreTangramSubmission, PIEZAS_TOTAL } from './scorer.js';
import { ensureContent, contenidoTangram } from './content.js';

/**
 * @typedef {import('./game/geometria.js').Colocacion} Colocacion
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 */
/**
 * La caja que ocupa una pieza a su tamaño real, con el desfase de su polígono
 * local respecto al origen (`minx`/`miny`): es lo que hace falta para
 * repartirlas en la bandeja sin que se monten.
 * @typedef {Object} CajaPieza
 * @property {number} w
 * @property {number} h
 * @property {number} minx
 * @property {number} miny
 */
/** La misma caja, sabiendo de qué pieza es. @typedef {CajaPieza & {n: string}} CajaConNombre */

/** @param {string} nombre @param {number} rot @returns {CajaPieza} */
function cajaPieza(nombre, rot) {
  const b = bboxDe([transformarPieza(PIEZAS[nombre].puntos, { x: 0, y: 0, rot, flip: false })]);
  return { w: b.maxx - b.minx, h: b.maxy - b.miny, minx: b.minx, miny: b.miny };
}

/** Reparte las 7 piezas (a su TAMAÑO REAL, nunca escaladas) en filas de
 *  hasta `anchoObjetivo` de ancho, para que la bandeja no quede tan ancha
 *  que hunda la silueta a una franja del marco (una sola fila de las 7
 *  piezas mide ~3.7 unidades; casi ninguna silueta es tan ancha). Devuelve
 *  las filas (arrays de cajas) y las medidas totales del bloque.
 *  @param {number} gap @param {number} anchoObjetivo
 *  @returns {{filas: CajaConNombre[][], alturasFila: number[], ancho: number, alto: number}} */
function empaquetarPiezas(gap, anchoObjetivo) {
  const cajas = ORDEN_PIEZAS.map(n => ({ n, ...cajaPieza(n, 0) }));
  /** @type {CajaConNombre[][]} */
  const filas = [[]];
  let anchoFilaActual = -gap;
  for (const c of cajas) {
    if (anchoFilaActual + gap + c.w > anchoObjetivo && filas[filas.length - 1].length > 0) {
      filas.push([]);
      anchoFilaActual = -gap;
    }
    filas[filas.length - 1].push(c);
    anchoFilaActual += gap + c.w;
  }
  const ancho = Math.max(...filas.map(f => f.reduce((s, c) => s + c.w + gap, -gap)));
  const alturasFila = filas.map(f => Math.max(...f.map(c => c.h)));
  const alto = alturasFila.reduce((s, a) => s + a + gap, -gap);
  return { filas, alturasFila, ancho, alto };
}

/** Posiciones iniciales: las piezas repartidas en la bandeja ya empaquetada
 *  en filas, centradas en `centroX`, empezando en `y`.
 *  @param {CajaConNombre[][]} filas
 *  @param {number[]} alturasFila
 *  @param {number} ancho @param {number} gap @param {number} centroX @param {number} y
 *  @returns {Colocacion[]} */
function colocacionesIniciales(filas, alturasFila, ancho, gap, centroX, y) {
  /** @type {Colocacion[]} */
  const out = [];
  let yFila = y;
  filas.forEach((fila, i) => {
    const anchoFila = fila.reduce((s, c) => s + c.w + gap, -gap);
    let x = centroX - ancho / 2 + (ancho - anchoFila) / 2;
    for (const c of fila) {
      out.push({ pieza: c.n, x: x - c.minx, y: yFila - c.miny, rot: 0, flip: false });
      x += c.w + gap;
    }
    yFila += alturasFila[i] + gap;
  });
  return out;
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 * @returns {void}
 */
export function renderTangramPlayer(rootSel, activity, opts = {}) {
  ensureContent(activity);
  const item = contenidoTangram(activity).items[0];
  const siluetaPoligonos = poligonosDe(item.colocaciones);
  const bbox = bboxDe(siluetaPoligonos);

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  // El viewBox = silueta + bandeja de piezas + margen del 5% (medido: en un
  // marco 1000×750 la silueta debe ocupar ≥45% del alto — con las 7 piezas
  // en UNA fila la bandeja salía tan ancha que la silueta quedaba en una
  // franja del 30-38%; empaquetarlas en varias filas más angostas que la
  // propia fila-de-7 sube eso a ~47-51%, medido con tools en el handoff).
  // Las piezas son SIEMPRE su tamaño real (nunca se escalan para caber): si
  // la silueta es más angosta que la bandeja, manda el ancho de la bandeja.
  const wSilueta = bbox.maxx - bbox.minx;
  const h = bbox.maxy - bbox.miny;
  const gap = wSilueta * MARGEN_CAJA;
  // Ancho objetivo de CADA fila de la bandeja: algo más de la mitad de lo
  // que miden las 7 piezas puestas en una sola fila — así caen en 2 filas
  // en vez de una tira larga (medido: da la mejor fracción de alto en las
  // dos siluetas del catálogo, ver handoff).
  const anchoUnaFila = ORDEN_PIEZAS.reduce((s, n) => s + cajaPieza(n, 0).w, 0);
  // LA BANDEJA VA AL LADO en un hueco apaisado y DEBAJO en uno vertical. Con la
  // bandeja siempre debajo, en el marco 4:3 mandaba el ALTO (silueta + bandeja
  // apiladas) y el triángulo pequeño se quedaba en el 11,8 % del lado corto:
  // por debajo del 12 % que el norte §1(c) exige para inicial — lo cazó la
  // matriz al nacer esa red. Al lado, la caja del contenido se parece a la
  // del marco y las piezas salen ~1,5× más grandes. Se decide UNA vez, al
  // montar (la antesala ya pidió pantalla completa: el hueco es el definitivo).
  const hueco = raizDe(rootSel);
  const apaisado = (hueco?.clientWidth || 4) >= (hueco?.clientHeight || 3);
  const anchoObjetivoBandeja = apaisado ? anchoUnaFila * 0.42 : Math.max(wSilueta, anchoUnaFila * 0.56);
  const { filas, alturasFila, ancho: anchoBandeja, alto: altoBandeja } = empaquetarPiezas(gap, anchoObjetivoBandeja);
  const contentW = apaisado ? wSilueta + gap + anchoBandeja : Math.max(wSilueta, anchoBandeja);
  const contentH = apaisado ? Math.max(h, altoBandeja) : h + gap + altoBandeja;
  const margen = MARGEN_CAJA * Math.max(contentW, contentH);
  // Centro X de la bandeja y su Y inicial, según dónde va.
  const centroX = apaisado ? bbox.maxx + gap + anchoBandeja / 2 : (bbox.minx + bbox.maxx) / 2;
  const yBandeja = apaisado ? bbox.miny : bbox.maxy + gap;
  const vb = apaisado ? {
    x: bbox.minx - margen,
    y: bbox.miny - margen,
    w: contentW + margen * 2,
    h: contentH + margen * 2,
  } : {
    x: centroX - contentW / 2 - margen,
    y: bbox.miny - margen,
    w: contentW + margen * 2,
    h: contentH + margen * 2,
  };

  mount(rootSel, html`
    <div class="ww-player ta-play">
      <div class="edu-sec edu-sec--tablero ta-tablero">
        <svg class="ta-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet">
          <g class="ta-silueta">${siluetaHtml(siluetaPoligonos)}</g>
          <g class="ta-piezas"></g>
        </svg>
      </div>
    </div>`);

  const root = raizDe(rootSel);
  const svgOpt = /** @type {SVGSVGElement|null} */ (root?.querySelector('.ta-svg') ?? null);
  const capaOpt = root?.querySelector('.ta-piezas') ?? null;
  if (!svgOpt || !capaOpt) return;   // el marco no llegó a montarse: no hay tablero que cablear

  const colocaciones = colocacionesIniciales(filas, alturasFila, anchoBandeja, gap, centroX, yBandeja);
  let resuelto = false;

  const tablero = montarTablero(svgOpt, capaOpt, { colocaciones, onCambio: comprobarFin });

  function comprobarFin() {
    if (resuelto) return;
    const ok = estaResuelto(siluetaPoligonos, colocaciones, PIEZAS);
    if (!ok) return;
    resuelto = true;
    tablero.destruir();   // resuelta: las piezas ya no se mueven
    const r = scoreTangramSubmission({ value: { resuelto: true, colocadas: PIEZAS_TOTAL } });
    emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: r.points });
    ctx.finish({
      title: '¡Resuelto!', icon: 'bi-stars', iconColor: 'text-warning',
      lead: `Figura: <b>${escapeHtml(item.nombre)}</b>`,
      score: r.points, maxScore: r.points,
    });
  }

  emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });
}
