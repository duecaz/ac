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
import { on, capturarPuntero, soltarPuntero } from '../../core/events.js';
import { rutaDibujo, temaDe } from '../../core/bancoDibujos.js';
import { escenaDe, componerEscena } from '../../core/escenasDibujo.js';
import { observeResize } from '../../core/observeResize.js';
import { scoreColorearSubmission, LLENO } from './scorer.js';
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
      <div class="edu-sec edu-sec--dibujo" aria-label="Dibujo para colorear">
        <!-- LA HOJA. Las láminas son CUADRADAS (viewBox 0 0 100 100) y el hueco
             casi nunca lo es, así que sin una hoja propia el lienzo ocupaba toda
             la franja mientras el dibujo se centraba dentro: se podía pintar en
             un palmo de vacío a cada lado y el campo se veía descuadrado. La
             hoja es cuadrada, blanca y centrada, y la tinta y la línea van
             exactamente encima de ella. Blanca además porque la lámina es de
             trazo NEGRO sobre transparente: sobre un tema oscuro no se vería. -->
        <div class="co-hoja" id="co-lienzo">
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
  // UN solo lienzo de respaldo, reutilizado: se redimensiona en vez de crearse.
  const respaldo = document.createElement('canvas');
  function medir() {
    if (!lienzo || !cx || !hueco) return;
    const r = hueco.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
    const w = Math.min(Math.round(r.width * dpr), TOPE_LADO);
    const h = Math.min(Math.round(r.height * dpr), TOPE_LADO);
    if (!w || !h || (lienzo.width === w && lienzo.height === h)) return;
    // La copia solo si HAY algo que conservar: al montar y tras cargar la
    // lámina el lienzo está vacío, y copiarlo pedía varios MB de memoria por
    // cada tic del redimensionado (entrar a pantalla completa da una ráfaga).
    const conservar = trazos > 0 && lienzo.width > 0 && lienzo.height > 0;
    if (conservar) {
      respaldo.width = lienzo.width; respaldo.height = lienzo.height;
      respaldo.getContext('2d')?.drawImage(lienzo, 0, 0);
    }
    lienzo.width = w; lienzo.height = h;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    if (conservar) cx.drawImage(respaldo, 0, 0, w, h);
  }
  // El desuscriptor NO se tira: el observador retiene el hueco y el callback, y
  // el callback retiene el lienzo (varios MB de respaldo). Se suelta al
  // terminar, que es cuando el juego deja de existir.
  const pararMedida = hueco ? observeResize(hueco, medir) : () => {};
  medir();

  /** @param {PointerEvent} e @returns {{x:number,y:number}|null} */
  function punto(e) {
    if (!lienzo) return null;
    const r = lienzo.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: (e.clientX - r.left) / r.width * lienzo.width,
             y: (e.clientY - r.top) / r.height * lienzo.height };
  }

  // UN SOLO DEDO PINTA A LA VEZ, y el trazo es SUYO hasta que lo levanta.
  //
  // Antes el último punto era uno solo para todos los punteros: en una pizarra
  // táctil, apoyar la palma abría un segundo puntero y la siguiente línea se
  // trazaba desde la palma hasta el dedo — una raya de lado a lado que TACHA el
  // dibujo. Medido en el navegador (dos toques en 0.2,0.2 y 0.8,0.8 y un
  // movimiento del primero dejaban tinta en el centro y en la esquina opuesta).
  // Y al revés: levantar CUALQUIER puntero cortaba el trazo del que sí pintaba.
  // Es la misma regla que el tablero del tangram: un puntero activo, el resto
  // se ignora mientras dure.
  /** @type {{id: number, x: number, y: number}|null} */
  let trazo = null;
  /** @param {PointerEvent} e */
  function empezar(e) {
    if (!cx || !lienzo || trazo) return;
    const p = punto(e);
    if (!p) return;
    trazo = { id: e.pointerId, ...p };
    // La captura deja que el dedo se salga del lienzo y vuelva sin partir el
    // trazo (`core/events.js` es el dueño del try/catch y del motivo).
    capturarPuntero(lienzo, e.pointerId);
    trazos++;
    pintar(p, p);                    // un toque suelto deja su punto
    e.preventDefault();
  }
  /** @param {PointerEvent} e */
  function mover(e) {
    if (!trazo || trazo.id !== e.pointerId || !cx) return;
    const p = punto(e);
    if (!p) return;
    pintar(trazo, p);
    trazo = { id: e.pointerId, ...p };
    e.preventDefault();
  }
  /** Solo termina el trazo el dedo que lo empezó. `lostpointercapture` está
   *  porque la captura puede fallar (el propio `try` lo contempla): sin él, un
   *  dedo levantado fuera del lienzo dejaba el trazo vivo y se seguía pintando
   *  al volver a pasar por encima sin pulsar.
   *  @param {PointerEvent} e */
  const soltar = (e) => {
    if (!trazo || trazo.id !== e.pointerId) return;
    trazo = null;
    if (lienzo) soltarPuntero(lienzo, e.pointerId);   // o el lienzo se queda con un puntero muerto
  };

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
    lienzo.addEventListener('lostpointercapture', soltar);
  }

  // ── LA LÁMINA, DENTRO DE SU ESCENA ────────────────────────────────────────
  // La figura se ENCOGE y se APOYA en el suelo del decorado en vez de ocupar el
  // lienzo entero: si no, el campo o el aula quedarían detrás de ella y no se
  // verían. Dónde y cuánto lo decide `componerEscena` (core/escenasDibujo.js),
  // el mismo que usa el rompecabezas: una sola caja de figura para los dos.
  try {
    const ruta = rutaDibujo(item.dibujo) || rutaDibujo('gato');
    const res = await fetch(`${ruta}`);
    // Sin esto, el 404 en HTML de GitHub Pages entraba como lámina y la hoja
    // salía en blanco sin que el `catch` llegara a enterarse (R6).
    if (!res.ok) throw new Error(`no se pudo cargar la lámina (${res.status})`);
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
    pararMedida();
    const r = scoreColorearSubmission({ value: { pintado: cobertura(), trazos }, item, activity });
    if (r.correct) emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: r.points });
    ctx.finish({
      title: '¡Bien hecho!',
      icon: 'bi-palette-fill', iconColor: 'text-warning',
      lead: r.lead,
      // EL TECHO LO DA EL SCORER, «lo que daría hacerlo entero» (ley
      // `scoringSources`): estaba cableado a 100 y bastaba con que el profe
      // tocara «Puntos por acierto» para que el X / max de la pantalla y lo
      // registrado dejaran de ser el mismo número.
      score: r.points, maxScore: scoreColorearSubmission({ value: { pintado: LLENO, trazos: 1 }, item, activity }).points,
    });
  });

  /** CUÁNTO SE PINTÓ, de 0 a 1 — la fracción de la hoja con tinta. Se mide
   *  sobre una COPIA REDUCIDA (64×64) y no sobre el lienzo: lo caro no es el
   *  bucle, es el `getImageData`, que en 1280×1280 devuelve 1,6 M de píxeles
   *  (6,5 MB) de una tacada, y esto corre al pulsar «Listo», con la clase
   *  delante. Reducir con `drawImage` además PROMEDIA el alfa, así que el
   *  número sale más fiel que muestreando una de cada ocho filas. */
  const LADO_MEDIDA = 64;
  function cobertura() {
    if (!cx || !lienzo || !lienzo.width) return 0;
    try {
      const mini = document.createElement('canvas');
      mini.width = mini.height = LADO_MEDIDA;
      const mcx = mini.getContext('2d');
      if (!mcx) return 0;
      mcx.drawImage(lienzo, 0, 0, LADO_MEDIDA, LADO_MEDIDA);
      const d = mcx.getImageData(0, 0, LADO_MEDIDA, LADO_MEDIDA).data;
      let con = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 32) con++;
      return con / (LADO_MEDIDA * LADO_MEDIDA);
    } catch {
      // `getImageData` puede fallar si el lienzo quedó «sucio» por una imagen
      // de otro origen. Aquí no puede pasar (solo pintamos nosotros), y si
      // pasara, NO se puede inventar una nota: un fallo de lectura que devolvía
      // 0,3 —casi el techo— convertía una avería en «casi perfecto».
      return 0;
    }
  }
}
