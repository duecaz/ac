// Colorear — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): una
// pantalla, sin reloj ni avance por ítems.
//
// SE PINTA A MANO ALZADA (decisión del dueño, 2026-09-17). Antes se TOCABA una
// zona y se rellenaba sola. Dos motivos para cambiarlo, y el segundo es el que
// de verdad manda:
//
//  · Lo que colorear entrena en inicial es EL TRAZO —dirección, control, no
//    salirse—; tocar una zona entrena apuntar, que es otra habilidad y mucho
//    más pobre. Con la pantalla táctil delante, pintar es el gesto que
//    corresponde a la ficha «Motricidad fina» que el norte §4c le dio a este
//    juego.
//  · Y quita el cuello de botella del contenido. Rellenar por zonas exige que
//    cada lámina traiga regiones cerradas etiquetadas, y eso costaba una hora
//    por dibujo a mano. El pincel no necesita zonas, así que entra cualquier
//    lámina dibujada por una persona — las 43 de OpenMoji, sin convertir nada.
//
// LA PINTURA VA DEBAJO DE LA LÁMINA, y ahí está todo el truco: un lienzo
// ocupando el mismo hueco, y el SVG ENCIMA. Como las láminas son `fill="none"`
// (línea pura sobre transparente), la tinta se ve por los huecos y el trazo
// negro NUNCA se tapa, por mucho que el niño pinte por encima. Sin capas habría
// que recortar la pintura al contorno, que es caro y además quita justo lo que
// se quiere entrenar: salirse de la raya tiene que ser posible para que no
// salirse signifique algo.
import { html, mount, raizDe } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { on } from '../../core/events.js';
import { cabeceraHtml } from '../../core/playerHud.js';
import { rutaDibujo, temaDe } from '../../core/bancoDibujos.js';
import { escenaDe, componerEscena } from '../../core/escenasDibujo.js';
import { observeResize } from '../../core/observeResize.js';
import { scoreColorearSubmission } from './scorer.js';
import { ensureContent } from './content.js';

// LA PALETA ES DATO, no CSS (§3, como las bolas de Pelotas): los colores que
// el niño toca viajan como valores JS y se pintan INLINE, así el trinquete de
// estilos (tests/styles.test.mjs) no ve un solo `#hex` en la hoja del juego.
const PALETA = [
  { nombre: 'rojo',     hex: '#e63946' },
  { nombre: 'naranja',  hex: '#f4a261' },
  { nombre: 'amarillo', hex: '#ffcb3d' },
  { nombre: 'verde',    hex: '#4caf50' },
  { nombre: 'turquesa', hex: '#2a9d8f' },
  { nombre: 'azul',     hex: '#3aa1c9' },
  { nombre: 'morado',   hex: '#8e44ad' },
  { nombre: 'rosa',     hex: '#ff6fa5' },
  { nombre: 'marrón',   hex: '#8a5a34' },
];

// EL PINCEL ES GORDO, a propósito: una mano de cinco años no hace filigrana, y
// un trazo fino convierte pintar en una tarea de precisión que frustra. Es una
// fracción del lado corto, así que se ve igual en un móvil y en la pizarra.
const GROSOR = 0.085;              // del lado corto del lienzo
const TOPE_LADO = 1280;            // ley de animaciones: lienzos con tope

/**
 * @typedef {import('../../kernel/contracts/activity.js').Activity} Activity
 * @typedef {import('../../kernel/contracts/activity.js').ColorearContent} ColorearContent
 * @typedef {import('../../kernel/contracts/template.js').PlayerOpts} PlayerOpts
 */

/**
 * @param {string|Element} rootSel
 * @param {Activity} activity
 * @param {PlayerOpts} [opts]
 * @returns {Promise<void>}
 */
export async function renderColorearPlayer(rootSel, activity, opts = {}) {
  ensureContent(activity);
  const item = /** @type {ColorearContent} */ (activity.content).items[0];
  // El shell (§23) da el reloj (ninguno, declarado en meta.play.reloj), la
  // ficha de ocupación del escenario y el guardado/pantalla de fin estándar.
  const ctx = runFreeformPlayer(rootSel, activity, opts);

  mount(rootSel, html`
    <div class="ww-player co-play">
      ${cabeceraHtml({ fullscreen: true })}
      <div class="edu-sec edu-sec--dibujo" aria-label="Dibujo para colorear">
        <!-- LA HOJA. Las láminas son CUADRADAS (viewBox 0 0 100 100) y el hueco
             casi nunca lo es, así que sin una hoja propia el lienzo ocupaba toda
             la franja mientras el dibujo se centraba dentro: se podía pintar en
             un palmo de vacío a cada lado y el campo se veía descuadrado. La
             hoja es cuadrada, blanca y centrada, y la tinta y la línea van
             exactamente encima de ella. Blanca además porque la lámina es de
             trazo NEGRO sobre transparente: sobre un tema oscuro no se vería. -->
        <div class="co-hoja" id="co-lienzo" data-tema="${temaDe(item.dibujo) || ''}">
          <canvas id="co-tinta"></canvas>
          <div id="co-linea"></div>
        </div>
      </div>
      <div class="edu-sec edu-sec--paleta" role="group" aria-label="Colores">
        ${PALETA.map((c, i) => `<button type="button" class="co-color${i === 0 ? ' co-color--on' : ''}"
            data-hex="${c.hex}" style="background:${c.hex}" aria-label="${c.nombre}"></button>`).join('')}
        <button type="button" class="co-color co-color--goma" data-borra="1" aria-label="Borrar">
          <i class="bi bi-eraser-fill"></i>
        </button>
      </div>
      <div class="edu-send">
        <button type="button" class="btn btn-success btn-lg co-listo" data-ww-submit>
          <i class="bi bi-check2-circle"></i> Listo
        </button>
      </div>
    </div>`);

  const raiz = raizDe(rootSel);
  const hueco = /** @type {HTMLElement|null} */ (raiz?.querySelector('#co-lienzo'));
  const linea = raiz?.querySelector('#co-linea');
  const lienzo = /** @type {HTMLCanvasElement|null} */ (raiz?.querySelector('#co-tinta'));
  const cx = lienzo?.getContext('2d') || null;

  // El primer color nace ELEGIDO: el niño puede pintar sin haber tocado antes un
  // color — nunca un tablero muerto a la espera de un gesto que no sabe que hace
  // falta.
  let color = PALETA[0].hex;
  let borrando = false;

  on(rootSel, 'click', '.co-color', (_e, el) => {
    borrando = !!el.dataset.borra;
    if (el.dataset.hex) color = el.dataset.hex;
    raiz?.querySelectorAll('.co-color').forEach(b => b.classList.toggle('co-color--on', b === el));
  });

  // ── EL LIENZO ─────────────────────────────────────────────────────────────
  // Se redimensiona con el hueco y CONSERVA lo pintado (el `drawImage` de la
  // copia): en el aula se entra a pantalla completa a media faena y perder el
  // dibujo por eso sería imperdonable. Con tope de lado y de DPR, como manda la
  // ley de animaciones.
  let trazos = 0;
  function medir() {
    if (!lienzo || !cx || !hueco) return;
    const r = hueco.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    const w = Math.min(Math.round(r.width * dpr), TOPE_LADO);
    const h = Math.min(Math.round(r.height * dpr), TOPE_LADO);
    if (!w || !h || (lienzo.width === w && lienzo.height === h)) return;
    const previo = lienzo.width && lienzo.height ? document.createElement('canvas') : null;
    if (previo) {
      previo.width = lienzo.width; previo.height = lienzo.height;
      previo.getContext('2d')?.drawImage(lienzo, 0, 0);
    }
    lienzo.width = w; lienzo.height = h;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    if (previo) cx.drawImage(previo, 0, 0, w, h);
  }
  if (hueco) observeResize(hueco, medir);
  medir();

  /** @param {PointerEvent} e @returns {{x:number,y:number}|null} */
  function punto(e) {
    if (!lienzo) return null;
    const r = lienzo.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: (e.clientX - r.left) / r.width * lienzo.width,
             y: (e.clientY - r.top) / r.height * lienzo.height };
  }

  /** @type {{x:number,y:number}|null} */
  let ultimo = null;
  /** @param {PointerEvent} e */
  function empezar(e) {
    if (!cx || !lienzo) return;
    ultimo = punto(e);
    if (!ultimo) return;
    // `setPointerCapture`: el dedo puede salirse del lienzo y volver sin que el
    // trazo se parta en dos.
    try { lienzo.setPointerCapture(e.pointerId); } catch { /* algún navegador sin captura: se sigue pintando igual */ }
    trazos++;
    pintar(ultimo, ultimo);          // un toque suelto deja su punto
    e.preventDefault();
  }
  /** @param {PointerEvent} e */
  function mover(e) {
    if (!ultimo || !cx) return;
    const p = punto(e);
    if (!p) return;
    pintar(ultimo, p);
    ultimo = p;
    e.preventDefault();
  }
  const soltar = () => { ultimo = null; };

  /** @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
  function pintar(a, b) {
    if (!cx || !lienzo) return;
    cx.globalCompositeOperation = borrando ? 'destination-out' : 'source-over';
    cx.strokeStyle = color;
    cx.lineWidth = Math.min(lienzo.width, lienzo.height) * GROSOR;
    cx.beginPath();
    cx.moveTo(a.x, a.y);
    cx.lineTo(b.x, b.y);
    cx.stroke();
  }

  if (lienzo) {
    lienzo.addEventListener('pointerdown', empezar);
    lienzo.addEventListener('pointermove', mover);
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);
  }

  // ── LA LÁMINA, DENTRO DE SU ESCENA ────────────────────────────────────────
  // La figura se ENCOGE y se APOYA en el suelo del decorado en vez de ocupar el
  // lienzo entero: si no, el campo o el aula quedarían detrás de ella y no se
  // verían. Dónde y cuánto lo decide `componerEscena` (core/escenasDibujo.js),
  // el mismo que usa el rompecabezas: una sola caja de figura para los dos.
  try {
    const ruta = rutaDibujo(item.dibujo) || rutaDibujo('gato');
    const res = await fetch(`./${ruta}`);
    const svgText = await res.text();
    if (!ctx.alive()) return;   // la ruta ya cambió mientras llegaba el fetch (§23)
    // El SVG traído se mete DENTRO de uno propio, junto al decorado: así los dos
    // comparten lienzo y el niño pinta debajo de todo por igual. Sin tema no
    // hay decorado: la lámina va sola, sin encoger (la hoja limpia de siempre).
    const escena = escenaDe(temaDe(item.dibujo));
    if (linea) linea.innerHTML = escena ? componerEscena(svgText, escena) : svgText;
    medir();
  } catch {
    // Sin la lámina no hay nada que colorear, pero la pantalla NO se queda muda:
    // "Listo" sigue ahí (R6, fallar en silencio está prohibido) y el fin se
    // reporta con lo que haya pintado.
  }

  emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });

  on(rootSel, 'click', '.co-listo', () => {
    const r = scoreColorearSubmission({ value: { pintado: cobertura(), trazos }, item, activity });
    if (r.correct) emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: r.points });
    ctx.finish({
      title: '¡Bien hecho!',
      icon: 'bi-palette-fill', iconColor: 'text-warning',
      lead: r.lead,
      score: r.points, maxScore: 100,
    });
  });

  /** CUÁNTO SE PINTÓ, de 0 a 1 — la fracción del lienzo con tinta. Se mide
   *  MUESTREANDO (una de cada ocho filas y columnas): leer el lienzo entero a
   *  1280×1280 son 6,5 millones de píxeles y esto corre al pulsar «Listo», con
   *  la clase mirando. Con 1 de cada 64 el número no se mueve y cuesta nada. */
  function cobertura() {
    if (!cx || !lienzo || !lienzo.width) return 0;
    try {
      const d = cx.getImageData(0, 0, lienzo.width, lienzo.height).data;
      let con = 0, total = 0;
      for (let y = 0; y < lienzo.height; y += 8) {
        for (let x = 0; x < lienzo.width; x += 8) {
          total++;
          if (d[(y * lienzo.width + x) * 4 + 3] > 32) con++;
        }
      }
      return total ? con / total : 0;
    } catch {
      // `getImageData` puede fallar si el lienzo quedó "sucio" por una imagen de
      // otro origen. Aquí no puede pasar (solo pintamos nosotros), pero si
      // pasara, lo honrado es puntuar por los trazos y no fingir un 0.
      return trazos ? 0.3 : 0;
    }
  }
}
