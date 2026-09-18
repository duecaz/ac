// Rompecabezas — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): una
// imagen del banco dividida en rejilla; se arrastra cada pieza a su hueco.
// SIN CANVAS (norte del handoff): la imagen se convierte UNA vez en `data:`
// URL (game/imagen.js) y cada pieza es un `<div>` con `background-image` de
// esa misma URL — solo cambian `background-position`/`background-size`.
import { html, mount, escapeHtml, raizDe } from '../../core/html.js';
import { capturarPuntero } from '../../core/events.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';
import { azar, shuffle } from '../../core/azar.js';
import { rid } from '../../core/ids.js';
import { celdas, encaja, barajarPosiciones } from './game/rejilla.js';
import { contornos, TAB, fondoPieza, cajaEncajada, rectNucleo } from './game/contornos.js';
import { svgParaPuzzle } from './game/imagen.js';
import { scorePuzzleSubmission } from './scorer.js';
// Los DOS bancos viven en el mismo módulo (§21b: un banco, un dueño) y se
// importan estáticos, igual que en Colorear. Nació dinámico («lo escribe otro
// agente en paralelo») y ese andamio sobrevivió al fichero que esperaba.
import { rutaDibujoPuzzle, rutaDibujo, temaDe } from '../../core/bancoDibujos.js';
import { escenaColorDe } from '../../core/escenasDibujo.js';
import { PUZZLE_POR_DEFECTO } from './content.js';

/**
 * La caja envolvente REAL de un SVG, medida por el navegador: se monta en un
 * contenedor oculto (oculto por `visibility`, no por `display:none` — sin
 * caja de layout `getBBox()` devuelve ceros), se lee `getBBox()` del `<svg>`
 * raíz —en unidades de usuario, es decir, en coordenadas del `viewBox`, con
 * las transformaciones de los hijos ya aplicadas (las láminas de OpenMoji
 * llevan un `scale(1.38889)`, que un parser del texto no vería)— y se quita.
 * Esto es lo ÚNICO que `game/imagen.js` no puede hacer: tiene que seguir
 * siendo puro para que Node pruebe el recorte. El texto es un asset propio del
 * sitio (`assets/juegos/dibujos/`), no contenido del usuario.
 * @param {string} texto
 * @returns {import('./game/imagen.js').Bbox|null}
 */
function cajaDeSvg(texto) {
  const cont = document.createElement('div');
  cont.style.cssText = 'position:absolute;visibility:hidden;width:100px;height:100px;overflow:hidden;';
  cont.innerHTML = texto;
  document.body.appendChild(cont);
  try {
    const svg = cont.querySelector('svg');
    const b = svg instanceof SVGGraphicsElement ? svg.getBBox() : null;
    // Una caja sin área (SVG vacío o sin pintar) no sirve para recortar:
    // mejor sin caja (viaja tal cual) que un viewBox de lado cero.
    return b && b.width > 0 && b.height > 0
      ? { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height }
      : null;
  } finally {
    cont.remove();
  }
}

/** @param {string} ruta @returns {Promise<string|null>} */
async function textoDe(ruta) {
  const res = await fetch(ruta);
  return res.ok ? res.text() : null;
}

/** @param {string} nombre @returns {Promise<string|null>} */
async function imagenDe(nombre) {
  // Primero el banco CON ZONAS (legado): su caja sale del texto. Si el nombre
  // no está ahí, la lámina coloreada de OpenMoji: sin zonas, la caja se mide
  // en el navegador. Si no está en ninguno (contenido viejo), no hay imagen y
  // el player ya pinta su aviso. En los dos casos la figura se compone sobre
  // el DECORADO de su tema (§8d del handoff: la imagen llena el marco, o las
  // esquinas del tablero son piezas en blanco).
  const escena = escenaColorDe(temaDe(nombre));
  const conZonas = rutaDibujoPuzzle(nombre);
  if (conZonas) {
    const texto = await textoDe(conZonas);
    return texto === null ? null : svgParaPuzzle(texto, { escena });
  }
  const lamina = rutaDibujo(nombre, 'color');
  if (!lamina) return null;
  const texto = await textoDe(lamina);
  return texto === null ? null : svgParaPuzzle(texto, { caja: cajaDeSvg(texto), escena });
}

/**
 * @typedef {import('./game/rejilla.js').Celda} Celda
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleContent} PuzzleContent
 * @typedef {import('../../kernel/contracts/activity.js').PuzzleItem} PuzzleItem
 */

/** @param {Celda} c @param {number} filas @param {number} columnas @returns {string} */
function estiloHueco(c, filas, columnas) {
  return `left:${(c.col * 100) / columnas}%;top:${(c.fila * 100) / filas}%;`
    + `width:${100 / columnas}%;height:${100 / filas}%;`;
}

// LA PIEZA: una caja exterior (`.pu-piece`, la que se arrastra y se mide,
// con la sombra —`box-shadow` no sigue al recorte, `filter: drop-shadow` sí—)
// y dentro la FORMA (`.pu-piece__forma`), recortada por el `<clipPath>` de su
// contorno y con la imagen entera de fondo desplazada a su celda (la
// aritmética del fondo para la caja ampliada vive en `game/contornos.js`).
// `url('...')` con comilla SIMPLE a propósito: la URL viaja dentro de un
// atributo `style="..."` delimitado con comillas DOBLES — una comilla doble
// literal ahí cortaría el atributo a mitad de camino. `encodeURIComponent`
// (game/imagen.js) ya escapa cualquier comilla simple que traiga la imagen.
/** @param {string} dataUrl @param {string} clipId @param {Celda} c @param {number} filas @param {number} columnas @returns {string} */
function piezaHtml(dataUrl, clipId, c, filas, columnas) {
  return `<div class="pu-piece" data-piece="${c.i}" style="aspect-ratio:${filas}/${columnas}">`
    + `<div class="pu-piece__forma" style="clip-path:url(#${clipId}-${c.i});`
    + `background-image:url('${dataUrl}');${fondoPieza(c, filas, columnas).css}"></div></div>`;
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
  // LA BANDEJA se DECLARA (el CSS no sabe contar piezas): hasta 6 piezas van
  // en UNA fila, con más, en DOS de ⌈n/2⌉. El CSS acota el tamaño de la pieza
  // para que esas filas quepan en la franja y a lo ancho (styles/puzzle.css):
  // si la bandeja se desbordase, el flex achataría el tablero (medido).
  const filasBandeja = total > 6 ? 2 : 1;
  const porFila = Math.ceil(total / filasBandeja);

  mount(rootSel, html`
    <div class="ww-player pu-play" style="--pu-filas:${filas};--pu-columnas:${columnas};--pu-caja:${1 + 2 * TAB};--pu-filas-bandeja:${filasBandeja};--pu-por-fila:${porFila}">
      ${cabeceraHtml({ pagina: `0 / ${total}` })}
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

  // Los CONTORNOS (lengüeta y hueco) se deciden con el azar del juego y viven
  // como `<clipPath>` en el tablero, con ids únicos POR MONTAJE (`rid`): el
  // escenario se remonta y dos rondas con el mismo `#pu-clip-0` chocarían.
  const clipId = rid('clip_');
  const formas = contornos(filas, columnas, azar.random);
  boardEl.innerHTML = `
    <svg width="0" height="0" aria-hidden="true" class="pu-clips"><defs>${formas.map(f =>
      `<clipPath id="${clipId}-${f.i}" clipPathUnits="objectBoundingBox"><path d="${f.d}"/></clipPath>`).join('')}</defs></svg>
    <div class="pu-ghost" style="background-image:url(&quot;${dataUrl}&quot;)"></div>
    ${rejilla.map(c => `<div class="pu-hueco" data-hueco="${c.i}" style="${estiloHueco(c, filas, columnas)}"></div>`).join('')}`;

  const orden = barajarPosiciones(total, shuffle);
  piecesEl.innerHTML = orden.map(i => piezaHtml(dataUrl, clipId, rejilla[i], filas, columnas)).join('');

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
      hudSet(root, 'pagina', `${encajadas} / ${total}`);
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
