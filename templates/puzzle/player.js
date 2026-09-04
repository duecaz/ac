// Rompecabezas — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): una
// imagen del banco dividida en rejilla; se arrastra cada pieza a su hueco.
// SIN CANVAS (norte del handoff): la imagen se convierte UNA vez en `data:`
// URL (game/imagen.js) y cada pieza es un `<div>` con `background-image` de
// esa misma URL — solo cambian `background-position`/`background-size`.
import { html, mount, escapeHtml } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { cabeceraHtml, hudSet } from '../../core/playerHud.js';
import { shuffle } from '../../core/azar.js';
import { celdas, encaja, barajarPosiciones } from './game/rejilla.js';
import { svgAColor, dataUrlDeSvg } from './game/imagen.js';
import { scorePuzzleSubmission } from './scorer.js';

// El banco (assets/juegos/dibujos) lo escribe otro agente en paralelo:
// import DINÁMICO para que registrar la plantilla nunca dependa de que el
// fichero exista ya, y para poder avisar CON MENSAJE si aún no está — nunca
// fallar en silencio (R6).
async function cargarBanco() {
  try { return await import('../../core/bancoDibujos.js'); }
  catch { return null; }
}

async function imagenDe(nombre) {
  const banco = await cargarBanco();
  const ruta = banco?.rutaDibujo?.(nombre);
  if (!ruta) return null;
  const res = await fetch(ruta);
  if (!res.ok) return null;
  return dataUrlDeSvg(svgAColor(await res.text()));
}

function estiloHueco(c, filas, columnas) {
  return `left:${(c.col * 100) / columnas}%;top:${(c.fila * 100) / filas}%;`
    + `width:${100 / columnas}%;height:${100 / filas}%;`;
}

// `url('...')` con comilla SIMPLE a propósito: la URL viaja dentro de un
// atributo `style="..."` delimitado con comillas DOBLES — una comilla doble
// literal ahí cortaría el atributo a mitad de camino. `encodeURIComponent`
// (game/imagen.js) ya escapa cualquier comilla simple que traiga la imagen.
function fondoPieza(dataUrl, c, filas, columnas) {
  return `background-image:url('${dataUrl}');`
    + `background-size:${columnas * 100}% ${filas * 100}%;`
    + `background-position:${c.bgPos};`;
}

export async function renderPuzzlePlayer(rootSel, activity, opts = {}) {
  const ctx = runFreeformPlayer(rootSel, activity, opts);
  const item = activity.content?.items?.[0] || { dibujo: 'casa', filas: 2, columnas: 2 };
  const filas = item.filas || 2, columnas = item.columnas || 2;
  const total = filas * columnas;
  const rejilla = celdas(filas, columnas);

  mount(rootSel, html`
    <div class="ww-player pu-play">
      ${cabeceraHtml({ pagina: `0 / ${total}` })}
      <div class="edu-sec edu-sec--tablero pu-arena">
        <div class="pu-board" data-pu-board></div>
      </div>
      <div class="edu-sec edu-sec--piezas pu-pieces" data-pu-pieces style="--pu-total:${total}"></div>
    </div>`);

  const root = document.querySelector(rootSel);
  if (!root) return;
  const arena   = root.querySelector('.pu-arena');
  const boardEl = root.querySelector('[data-pu-board]');
  const piecesEl = root.querySelector('[data-pu-pieces]');

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

  boardEl.innerHTML = `
    <div class="pu-ghost" style="background-image:url(&quot;${dataUrl}&quot;)"></div>
    ${rejilla.map(c => `<div class="pu-hueco" data-hueco="${c.i}" style="${estiloHueco(c, filas, columnas)}"></div>`).join('')}`;

  const orden = barajarPosiciones(total, shuffle);
  piecesEl.innerHTML = orden.map(i => {
    const c = rejilla[i];
    return `<div class="pu-piece" data-piece="${i}" style="aspect-ratio:${filas}/${columnas};${fondoPieza(dataUrl, c, filas, columnas)}"></div>`;
  }).join('');

  let encajadas = 0;
  const maxScore = scorePuzzleSubmission({ value: { encajadas: total, total }, item, activity }).points;

  function terminar() {
    const r = scorePuzzleSubmission({ value: { encajadas, total }, item, activity });
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: r.points }] });
    ctx.finish({
      title: '¡Completado!', icon: 'bi-trophy-fill', iconColor: 'text-warning',
      lead: `${total} de ${total} piezas`,
      score: r.points, maxScore,
    });
  }

  function cellRectPct(i) {
    const c = rejilla[i];
    return { x: (c.col * 100) / columnas, y: (c.fila * 100) / filas, w: 100 / columnas, h: 100 / filas };
  }

  // Estado de arrastre — pointer events + captura, delegado sobre la bandeja.
  const drag = { id: null, el: null, startX: 0, startY: 0 };

  function onDown(e) {
    const pieza = e.target.closest('.pu-piece');
    if (!pieza || pieza.classList.contains('pu-piece--fija')) return;
    if (drag.id != null) return;
    drag.id = e.pointerId; drag.el = pieza;
    drag.startX = e.clientX; drag.startY = e.clientY;
    pieza.classList.add('pu-piece--arrastrando');
    try { pieza.setPointerCapture?.(e.pointerId); } catch {}
  }

  function onMove(e) {
    if (drag.id !== e.pointerId || !drag.el) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }

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

    if (encaja(pieceRectPct, cellRectPct(i))) {
      const c = rejilla[i];
      pieza.style.transform = '';
      pieza.style.position = 'absolute';
      pieza.style.left = `${(c.col * 100) / columnas}%`;
      pieza.style.top = `${(c.fila * 100) / filas}%`;
      pieza.style.width = `${100 / columnas}%`;
      pieza.style.height = `${100 / filas}%`;
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
