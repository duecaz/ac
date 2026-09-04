// Tangram — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): un
// tablero SVG de una sola pantalla, sin botones (submit:'gesto' — encajar la
// última pieza ES terminar). Gestos de UN dedo con Pointer Events:
//   - arrastrar mueve la pieza;
//   - TOCAR (sin arrastrar) la gira 45°;
//   - DOBLE TOQUE la voltea (solo se ve distinto en el paralelogramo).
// El doble toque se detecta por TIEMPO entre dos toques de la MISMA pieza con
// `performance.now()` en el propio handler: es el único reloj del proyecto
// pensado para medir "cuánto pasó desde el evento anterior" dentro de un
// gesto (core/deadlineTicker.js resuelve "cuánto falta hasta un instante", no
// esto), así que aquí no aplica ningún primitivo de core/reloj — se anota
// para que quede claro que no es un `setInterval` a pelo (§23 no lo prohíbe:
// prohíbe temporizadores RECURRENTES sin guard, esto es una resta puntual).
import { html, mount } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { cabeceraHtml } from '../../core/playerHud.js';
import { PIEZAS, ORDEN_PIEZAS } from './game/piezas.js';
import { SILUETAS, ORDEN_SILUETAS } from './game/siluetas.js';
import { transformarPieza, imantar } from './game/geometria.js';
import { estaResuelto, MARGEN_CAJA } from './game/mascara.js';
import { scoreTangramSubmission, PIEZAS_TOTAL } from './scorer.js';
import { ensureContent } from './editor.js';

const TOQUE_MAX_MS = 300;      // por debajo de esto, sin desplazamiento, es un TOQUE
const TOQUE_MAX_DIST = 0.06;   // en fracción del lado del tablero — no del cuadrado unidad fijo
const DOBLE_TOQUE_MS = 400;    // ventana entre dos toques de la MISMA pieza

function cajaPieza(nombre, rot) {
  const poly = transformarPieza(PIEZAS[nombre].puntos, { x: 0, y: 0, rot, flip: false });
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), minx: Math.min(...xs), miny: Math.min(...ys) };
}

/** Reparte las 7 piezas (a su TAMAÑO REAL, nunca escaladas) en filas de
 *  hasta `anchoObjetivo` de ancho, para que la bandeja no quede tan ancha
 *  que hunda la silueta a una franja del marco (una sola fila de las 7
 *  piezas mide ~3.7 unidades; casi ninguna silueta es tan ancha). Devuelve
 *  las filas (arrays de cajas) y las medidas totales del bloque. */
function empaquetarPiezas(gap, anchoObjetivo) {
  const cajas = ORDEN_PIEZAS.map(n => ({ n, ...cajaPieza(n, 0) }));
  const filas = [[]];
  let anchoFilaActual = -gap;
  for (const c of cajas) {
    if (anchoFilaActual + gap + c.w > anchoObjetivo && filas.at(-1).length > 0) {
      filas.push([]);
      anchoFilaActual = -gap;
    }
    filas.at(-1).push(c);
    anchoFilaActual += gap + c.w;
  }
  const ancho = Math.max(...filas.map(f => f.reduce((s, c) => s + c.w + gap, -gap)));
  const alturasFila = filas.map(f => Math.max(...f.map(c => c.h)));
  const alto = alturasFila.reduce((s, a) => s + a + gap, -gap);
  return { filas, alturasFila, ancho, alto };
}

/** Posiciones iniciales: las piezas repartidas en la bandeja ya empaquetada
 *  en filas, centradas en `centroX`, empezando en `y`. */
function colocacionesIniciales(filas, alturasFila, ancho, gap, centroX, y) {
  const out = {};
  let yFila = y;
  filas.forEach((fila, i) => {
    const anchoFila = fila.reduce((s, c) => s + c.w + gap, -gap);
    let x = centroX - ancho / 2 + (ancho - anchoFila) / 2;
    for (const c of fila) {
      out[c.n] = { pieza: c.n, x: x - c.minx, y: yFila - c.miny, rot: 0, flip: false };
      x += c.w + gap;
    }
    yFila += alturasFila[i] + gap;
  });
  return out;
}

export function renderTangramPlayer(rootSel, activity, opts = {}) {
  ensureContent(activity);
  const item = activity.content.items[0];
  const figura = SILUETAS[item.figura] ? item.figura : ORDEN_SILUETAS[0];
  const silueta = SILUETAS[figura];

  const ctx = runFreeformPlayer(rootSel, activity, opts);

  // El viewBox = silueta + bandeja de piezas + margen del 5% (medido: en un
  // marco 1000×750 la silueta debe ocupar ≥45% del alto — con las 7 piezas
  // en UNA fila la bandeja salía tan ancha que la silueta quedaba en una
  // franja del 30-38%; empaquetarlas en varias filas más angostas que la
  // propia fila-de-7 sube eso a ~47-51%, medido con tools en el handoff).
  // Las piezas son SIEMPRE su tamaño real (nunca se escalan para caber): si
  // la silueta es más angosta que la bandeja, manda el ancho de la bandeja.
  const wSilueta = silueta.bbox.maxx - silueta.bbox.minx;
  const h = silueta.bbox.maxy - silueta.bbox.miny;
  const gap = wSilueta * MARGEN_CAJA;
  // Ancho objetivo de CADA fila de la bandeja: algo más de la mitad de lo
  // que miden las 7 piezas puestas en una sola fila — así caen en 2 filas
  // en vez de una tira larga (medido: da la mejor fracción de alto en las
  // dos siluetas del catálogo, ver handoff).
  const anchoUnaFila = ORDEN_PIEZAS.reduce((s, n) => s + cajaPieza(n, 0).w, 0);
  const anchoObjetivoBandeja = Math.max(wSilueta, anchoUnaFila * 0.56);
  const { filas, alturasFila, ancho: anchoBandeja, alto: altoBandeja } = empaquetarPiezas(gap, anchoObjetivoBandeja);
  const contentW = Math.max(wSilueta, anchoBandeja);
  const contentH = h + gap + altoBandeja;
  const margen = MARGEN_CAJA * Math.max(contentW, contentH);
  const centroX = (silueta.bbox.minx + silueta.bbox.maxx) / 2;
  const vb = {
    x: centroX - contentW / 2 - margen,
    y: silueta.bbox.miny - margen,
    w: contentW + margen * 2,
    h: contentH + margen * 2,
  };

  mount(rootSel, html`
    <div class="ww-player ta-play">
      ${cabeceraHtml({ fullscreen: true })}
      <div class="edu-sec edu-sec--tablero ta-tablero">
        <svg class="ta-svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="xMidYMid meet">
          <g class="ta-silueta">
            ${silueta.poligonos.map(p => `<polygon points="${p.map(([x, y]) => `${x},${y}`).join(' ')}" />`).join('')}
          </g>
          <g class="ta-piezas"></g>
        </svg>
      </div>
    </div>`);

  const root = document.querySelector(rootSel);
  const svg = root.querySelector('.ta-svg');
  const capa = root.querySelector('.ta-piezas');

  const colocaciones = colocacionesIniciales(filas, alturasFila, anchoBandeja, gap, centroX, silueta.bbox.maxy + gap);
  let orden = [...ORDEN_PIEZAS];   // orden de pintado = quién está "encima"
  let resuelto = false;

  function puntoSvg(clientX, clientY) {
    const p = svg.createSVGPoint();
    p.x = clientX; p.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const t = p.matrixTransform(m.inverse());
    return { x: t.x, y: t.y };
  }

  function pintar() {
    capa.innerHTML = orden.map(n => {
      const pieza = PIEZAS[n];
      const c = colocaciones[n];
      const escala = c.flip ? 'scale(1,-1)' : '';
      const pts = pieza.puntos.map(([x, y]) => `${x},${y}`).join(' ');
      return `<g class="ta-pieza" data-pieza="${n}" transform="translate(${c.x},${c.y}) rotate(${c.rot}) ${escala}">`
        + `<polygon points="${pts}" fill="${pieza.color}" />`
        + `</g>`;
    }).join('');
  }
  pintar();

  function traerAlFrente(n) {
    orden = orden.filter(x => x !== n);
    orden.push(n);
  }

  function comprobarFin() {
    if (resuelto) return;
    const lista = ORDEN_PIEZAS.map(n => ({ pieza: n, ...colocaciones[n] }));
    const ok = estaResuelto(silueta.poligonos, lista, PIEZAS);
    if (!ok) return;
    resuelto = true;
    const r = scoreTangramSubmission({ value: { resuelto: true, colocadas: PIEZAS_TOTAL } });
    emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: r.points });
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: r.points }] });
    ctx.finish({
      title: '¡Resuelto!', icon: 'bi-stars', iconColor: 'text-warning',
      lead: `Figura: <b>${silueta.nombre}</b>`,
      score: r.points, maxScore: r.points,
    });
  }

  // --- Gestos: un puntero activo a la vez (pizarra/tablet, un dedo). ---
  const gesto = { activo: null, piezaId: null, inicioX: 0, inicioY: 0, origX: 0, origY: 0, t0: 0, movido: false };
  let ultimoToque = { piezaId: null, t: 0 };

  function onDown(e) {
    const g = e.target.closest('.ta-pieza');
    if (!g || gesto.activo != null) return;
    const n = g.dataset.pieza;
    const p = puntoSvg(e.clientX, e.clientY);
    gesto.activo = e.pointerId;
    gesto.piezaId = n;
    gesto.inicioX = p.x; gesto.inicioY = p.y;
    gesto.origX = colocaciones[n].x; gesto.origY = colocaciones[n].y;
    gesto.t0 = performance.now();
    gesto.movido = false;
    traerAlFrente(n);
    pintar();
    try { svg.setPointerCapture(e.pointerId); } catch {}
  }

  function onMove(e) {
    if (gesto.activo !== e.pointerId || !gesto.piezaId) return;
    const p = puntoSvg(e.clientX, e.clientY);
    const dx = p.x - gesto.inicioX, dy = p.y - gesto.inicioY;
    const umbral = contentW * TOQUE_MAX_DIST;
    if (!gesto.movido && Math.hypot(dx, dy) < umbral) return;
    gesto.movido = true;
    const c = colocaciones[gesto.piezaId];
    c.x = gesto.origX + dx;
    c.y = gesto.origY + dy;
    pintar();
    if (e.cancelable) e.preventDefault();
  }

  function onUp(e) {
    if (gesto.activo !== e.pointerId || !gesto.piezaId) { gesto.activo = null; return; }
    const n = gesto.piezaId;
    const duracion = performance.now() - gesto.t0;
    if (gesto.movido) {
      // ARRASTRE: imán de posición Y rotación al soltar (§ enunciado).
      colocaciones[n] = imantar(colocaciones[n]);
    } else if (duracion <= TOQUE_MAX_MS) {
      // TOQUE: gira 45°. Si es el SEGUNDO toque de esta pieza dentro de la
      // ventana de doble-toque, además voltea (la comprobación de "resuelto"
      // sigue siendo UNA sola, después de aplicar ambos cambios).
      const c = colocaciones[n];
      c.rot = (c.rot + 45) % 360;
      const ahora = performance.now();
      if (ultimoToque.piezaId === n && (ahora - ultimoToque.t) <= DOBLE_TOQUE_MS) {
        c.flip = !c.flip;
        ultimoToque = { piezaId: null, t: 0 };   // consumido: un tercer toque rápido no encadena
      } else {
        ultimoToque = { piezaId: n, t: ahora };
      }
    }
    gesto.activo = null;
    gesto.piezaId = null;
    pintar();
    comprobarFin();
  }

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', () => { gesto.activo = null; gesto.piezaId = null; });

  emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });
}
