// Rompecabezas — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): una
// imagen del banco dividida en rejilla; se arrastra cada pieza a su hueco.
// SIN CANVAS (norte del handoff): la imagen se convierte UNA vez en `data:`
// URL (game/imagen.js) y cada pieza es un `<div>` con `background-image` de
// esa misma URL — solo cambian `background-position`/`background-size`.
import { html, mount, escapeHtml, raizDe } from '../../core/html.js';
import { capturarPuntero } from '../../core/events.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { azar, shuffle } from '../../core/azar.js';
import { rid } from '../../core/ids.js';
import { celdas, encaja, barajarPosiciones } from './game/rejilla.js';
import { contornos, CAJA, fondoPieza, cajaEncajada, rectNucleo } from './game/contornos.js';
import { imagenDe } from './cargar.js';
import { scorePuzzleSubmission } from './scorer.js';
import { PUZZLE_POR_DEFECTO } from './content.js';

/**
 * @typedef {import('./game/rejilla.js').Celda} Celda
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleContent} PuzzleContent
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleItem} PuzzleItem
 */

// LA PIEZA: una caja exterior (`.pu-piece`, la que se arrastra y se mide,
// con la sombra —`box-shadow` no sigue al recorte, `filter: drop-shadow` sí—)
// y dentro la FORMA (`.pu-piece__forma`), recortada por el `<clipPath>` de su
// contorno y con la imagen entera de fondo desplazada a su celda (la
// aritmética del fondo para la caja ampliada vive en `game/contornos.js`). La
// IMAGEN no va aquí: es la variable `--pu-img` del juego, escrita UNA vez
// (antes la misma data: URL de ~10 KB iba diez veces en línea, ghost y piezas).
/** @param {string} clipId @param {Celda} c @param {number} filas @param {number} columnas @returns {string} */
function piezaHtml(clipId, c, filas, columnas) {
  return `<div class="pu-piece" data-piece="${c.i}" style="aspect-ratio:${filas}/${columnas}">`
    + `<div class="pu-piece__forma" style="clip-path:url(#${clipId}-${c.i});${fondoPieza(c, filas, columnas).css}"></div></div>`;
}

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {import('../../kernel/contracts/template.js').PlayerOpts} [opts]
 * @returns {Promise<void>}
 */
export async function renderPuzzlePlayer(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const contenido = /** @type {Partial<PuzzleContent>} */ (activity.content ?? {});
  /** @type {PuzzleItem} */
  const def = PUZZLE_POR_DEFECTO();
  const item = contenido.items?.[0] || def;
  const filas = item.filas || def.filas, columnas = item.columnas || def.columnas;
  const total = filas * columnas;
  const rejilla = celdas(filas, columnas);
  // CÓMO SE REPARTE LA BANDEJA — lo declara el player porque el CSS no sabe
  // contar piezas, y de ahí sale el lado del tablero (styles/puzzle.css): las
  // piezas van a tamaño 1:1 con su hueco y el tablero ocupa lo que quede.
  // Dos repartos, porque la forma del hueco manda y esa la sabe el CSS:
  //   · APAISADO: filas largas (hasta 5), que es donde sobra ancho.
  //   · VERTICAL: lo más cuadrado posible (⌈√n⌉ por fila) — con el reparto de
  //     apaisado, en un móvil el tablero se quedaba en 146 px.
  const filasBandeja = total > 6 ? 2 : 1;
  const porFila = Math.ceil(total / filasBandeja);
  const porFilaV = Math.ceil(Math.sqrt(total));
  const filasBandejaV = Math.ceil(total / porFilaV);

  mount(rootSel, html`
    <div class="ww-player pu-play" style="--pu-columnas:${columnas};--pu-caja:${CAJA};--pu-filas-bandeja:${filasBandeja};--pu-por-fila:${porFila};--pu-filas-bandeja-v:${filasBandejaV};--pu-por-fila-v:${porFilaV}">
      <div class="edu-sec edu-sec--tablero pu-arena">
        <div class="pu-board" data-pu-board></div>
        <div class="edu-sec edu-sec--piezas pu-pieces" data-pu-pieces></div>
      </div>
    </div>`);

  const root = raizDe(rootSel);
  if (!root) return;
  const arenaOpt   = /** @type {HTMLElement|null} */ (root.querySelector('.pu-arena'));
  const boardOpt   = /** @type {HTMLElement|null} */ (root.querySelector('[data-pu-board]'));
  // EL TAMAÑO LO DECIDE EL CSS, ANTES DE PINTAR (styles/puzzle.css): tablero y
  // bandeja viven dentro del MISMO contenedor de tamaño (`.pu-arena`) y las
  // piezas derivan del lado del tablero por unidades de contenedor. Hubo dos
  // versiones con JS (medir el tablero; medir el hueco) y las dos repintaban
  // al menos una vez tras aparecer — la matriz lo caza («se RECALCULA»), y en
  // pantalla completa (1515×1023) la primera, con las piezas medidas contra el
  // ANCHO de la página, daba piezas de 430 px (captura del dueño, v1.51.668).
  const piecesOpt  = /** @type {HTMLElement|null} */ (root.querySelector('[data-pu-pieces]'));
  if (!arenaOpt || !boardOpt || !piecesOpt) return;   // el marco no llegó a montarse
  const arena = arenaOpt, boardEl = boardOpt, piecesEl = piecesOpt;

  /** @type {string|null} */
  let dataUrl = null;
  try { dataUrl = await imagenDe(item.dibujo); } catch { dataUrl = null; }
  if (!ctx.alive()) return;   // el escenario ya es de otro modo/ruta (§23)

  if (!dataUrl) {
    // Fallar CON MENSAJE, no en silencio (R6): el banco de dibujos aún no
    // está disponible (u otro fallo de red) — se dice, no se oculta.
    arena.innerHTML = `<p class="pu-error"><i class="bi bi-exclamation-triangle"></i>
      No se pudo cargar el dibujo «${escapeHtml(item.dibujo)}». Comprueba tu conexión o
      vuelve a intentarlo en un momento.</p>`;
    piecesEl.remove();
    return;
  }

  emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });
  // `encodeURIComponent` (game/imagen.js) ya escapó las comillas: la URL entra
  // en la variable tal cual y el fantasma y las piezas la leen del CSS.
  /** @type {HTMLElement|null} */ (root.querySelector('.pu-play'))?.style.setProperty('--pu-img', `url("${dataUrl}")`);

  // Los CONTORNOS (lengüeta y hueco) se deciden con el azar del juego y viven
  // como `<clipPath>` en el tablero, con ids únicos POR MONTAJE (`rid`): el
  // escenario se remonta y dos rondas con el mismo `#pu-clip-0` chocarían.
  const clipId = rid('clip_');
  const formas = contornos(filas, columnas, azar.random);
  boardEl.innerHTML = `
    <svg width="0" height="0" aria-hidden="true" class="pu-clips"><defs>${formas.map(f =>
      `<clipPath id="${clipId}-${f.i}" clipPathUnits="objectBoundingBox"><path d="${f.d}"/></clipPath>`).join('')}</defs></svg>
    <div class="pu-ghost"></div>`;

  const orden = barajarPosiciones(total, shuffle);
  piecesEl.innerHTML = orden.map(i => piezaHtml(clipId, rejilla[i], filas, columnas)).join('');

  let encajadas = 0;
  const maxScore = scorePuzzleSubmission({ value: { encajadas: total, total }, item, activity }).points;

  function terminar() {
    const r = scorePuzzleSubmission({ value: { encajadas, total }, item, activity });
    ctx.finish({
      title: '¡Completado!', icon: 'bi-trophy-fill', iconColor: 'text-warning',
      lead: `${total} de ${total} piezas`,
      score: r.points, maxScore,
    });
  }

  /** @param {number} i @returns {import('./game/rejilla.js').Rect} */
  function cellRectPct(i) {
    const c = rejilla[i];
    return { x: (c.col * 100) / columnas, y: (c.fila * 100) / filas, w: 100 / columnas, h: 100 / filas };
  }

  // Estado de arrastre — pointer events + captura, delegado sobre la bandeja.
  /** @type {{id: number|null, el: HTMLElement|null, startX: number, startY: number}} */
  const drag = { id: null, el: null, startX: 0, startY: 0 };

  /** @param {PointerEvent} e @returns {void} */
  function onDown(e) {
    const destino = /** @type {Element|null} */ (e.target);
    const pieza = /** @type {HTMLElement|null} */ (destino?.closest('.pu-piece') ?? null);
    if (!pieza || pieza.classList.contains('pu-piece--fija')) return;
    if (drag.id != null) return;
    drag.id = e.pointerId; drag.el = pieza;
    drag.startX = e.clientX; drag.startY = e.clientY;
    pieza.classList.add('pu-piece--arrastrando');
    capturarPuntero(pieza, e.pointerId);
  }

  /** @param {PointerEvent} e @returns {void} */
  function onMove(e) {
    if (drag.id !== e.pointerId || !drag.el) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }

  /** @param {PointerEvent} e @returns {void} */
  function onUp(e) {
    if (drag.id !== e.pointerId || !drag.el) return;
    const pieza = drag.el;
    drag.id = null; drag.el = null;
    pieza.classList.remove('pu-piece--arrastrando');

    const i = Number(pieza.dataset.piece);
    const boardRect = boardEl.getBoundingClientRect();
    const pieceRect = pieza.getBoundingClientRect();
    const pieceRectPct = boardRect.width > 0 && boardRect.height > 0 ? {
      x: ((pieceRect.left - boardRect.left) / boardRect.width) * 100,
      y: ((pieceRect.top - boardRect.top) / boardRect.height) * 100,
      w: (pieceRect.width / boardRect.width) * 100,
      h: (pieceRect.height / boardRect.height) * 100,
    } : { x: -999, y: -999, w: 0, h: 0 };

    // Se juzga el NÚCLEO de la pieza (su caja menos el margen de las
    // lengüetas), no la caja ampliada: con ella el solape con la propia celda
    // no llega al 50 % y no encajaría ni soltada en su sitio.
    if (encaja(rectNucleo(pieceRectPct), cellRectPct(i))) {
      const caja = cajaEncajada(rejilla[i], filas, columnas);
      pieza.style.transform = '';
      pieza.style.position = 'absolute';
      pieza.style.left = `${caja.left}%`;
      pieza.style.top = `${caja.top}%`;
      pieza.style.width = `${caja.width}%`;
      pieza.style.height = `${caja.height}%`;
      pieza.classList.add('pu-piece--fija');
      boardEl.appendChild(pieza);   // ya no se puede mover: queda fija en su hueco
      encajadas++;
      emitGame(GameEvents.ANSWER_CORRECT, { idx: i, points: 0 });
      if (encajadas >= total) terminar();
    } else {
      // No encaja: vuelve suave a donde estaba (transición del propio CSS).
      pieza.classList.add('pu-piece--volviendo');
      pieza.style.transform = 'translate(0, 0)';
      pieza.addEventListener('transitionend', function limpiar() {
        pieza.classList.remove('pu-piece--volviendo');
        pieza.style.transform = '';
        pieza.removeEventListener('transitionend', limpiar);
      }, { once: true });
    }
  }

  /** @param {PointerEvent} e @returns {void} */
  function onCancel(e) {
    if (drag.id !== e.pointerId || !drag.el) return;
    const pieza = drag.el;
    drag.id = null; drag.el = null;
    pieza.classList.remove('pu-piece--arrastrando');
    pieza.style.transform = '';
  }

  piecesEl.addEventListener('pointerdown', onDown);
  piecesEl.addEventListener('pointermove', onMove);
  piecesEl.addEventListener('pointerup', onUp);
  piecesEl.addEventListener('pointercancel', onCancel);
  piecesEl.addEventListener('lostpointercapture', onCancel);
}
