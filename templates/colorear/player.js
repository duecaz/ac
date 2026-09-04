// Colorear — player SOLO sobre el SHELL LIBRE (core/soloPlayer.js): una
// pantalla, sin reloj ni avance por ítems. El dibujo llega por `fetch` del
// banco compartido (assets/juegos/dibujos/) y se inyecta INLINE —un <img> no
// deja engancharse a sus zonas— para que tocar un <path>/forma con
// data-zona sea la mecánica entera.
import { html, mount } from '../../core/html.js';
import { runFreeformPlayer } from '../../core/soloPlayer.js';
import { GameEvents, emitGame } from '../../core/gameEvents.js';
import { on } from '../../core/events.js';
import { cabeceraHtml } from '../../core/playerHud.js';
import { rutaDibujo } from '../../core/bancoDibujos.js';
import { scoreColorearSubmission } from './scorer.js';
import { ensureContent } from './editor.js';

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
  { nombre: 'blanco',   hex: '#ffffff' },
];

export async function renderColorearPlayer(rootSel, activity, opts = {}) {
  ensureContent(activity);
  const item = activity.content.items[0];
  // El shell (§23) da el reloj (ninguno, declarado en meta.play.reloj), la
  // ficha de ocupación del escenario y el guardado/pantalla de fin estándar.
  const ctx = runFreeformPlayer(rootSel, activity, opts);

  mount(rootSel, html`
    <div class="ww-player co-play">
      ${cabeceraHtml({ fullscreen: true })}
      <div class="edu-sec edu-sec--dibujo" id="co-lienzo" aria-label="Dibujo para colorear"></div>
      <div class="edu-sec edu-sec--paleta" role="group" aria-label="Colores">
        ${PALETA.map((c, i) => `<button type="button" class="co-color${i === 0 ? ' co-color--on' : ''}"
            data-hex="${c.hex}" style="background:${c.hex}" aria-label="${c.nombre}"></button>`).join('')}
      </div>
      <div class="edu-send">
        <button type="button" class="btn btn-success btn-lg co-listo" data-ww-submit>
          <i class="bi bi-check2-circle"></i> Listo
        </button>
      </div>
    </div>`);

  const raiz = document.querySelector(rootSel);
  const lienzo = raiz?.querySelector('#co-lienzo');

  // El primer color nace ELEGIDO (co-color--on ya pintado arriba): el niño
  // puede tocar una zona sin haber tocado antes un color — nunca un tablero
  // muerto a la espera de un gesto que no sabe que hace falta.
  let colorElegido = PALETA[0].hex;
  const pintadas = new Set();   // zonas DISTINTAS tocadas (repintar no infla)

  on(rootSel, 'click', '.co-color', (_e, el) => {
    colorElegido = el.dataset.hex;
    raiz.querySelectorAll('.co-color').forEach(b => b.classList.toggle('co-color--on', b === el));
  });

  // Tocar otra zona con el mismo color la pinta; volver con otro color la
  // repinta (el enunciado del encargo) — `style.fill` no distingue las dos
  // cosas, así que basta con reescribirlo cada vez.
  on(rootSel, 'click', '[data-zona]', (_e, el) => {
    el.style.fill = colorElegido;
    pintadas.add(el.dataset.zona);
  });

  let total = 0;
  try {
    const ruta = rutaDibujo(item.dibujo) || rutaDibujo('casa');
    const res = await fetch(`./${ruta}`);
    const svgText = await res.text();
    if (!ctx.alive()) return;   // la ruta ya cambió mientras llegaba el fetch (§23)
    if (lienzo) lienzo.innerHTML = svgText;
    total = lienzo?.querySelectorAll('[data-zona]').length || 0;
  } catch {
    // Sin el SVG no hay zonas que pintar, pero la pantalla NO se queda muda:
    // "Listo" sigue ahí (R6, fallar en silencio está prohibido) y el fin se
    // reporta con total 0 — el scorer ya no divide por cero.
    total = 0;
  }

  emitGame(GameEvents.QUESTION_SHOWN, { idx: 0, total: 1, item });

  on(rootSel, 'click', '.co-listo', () => {
    const r = scoreColorearSubmission({ value: { pintadas: pintadas.size, total }, item, activity });
    if (r.correct) emitGame(GameEvents.ANSWER_CORRECT, { idx: 0, points: r.points });
    emitGame(GameEvents.PODIUM, { top: [{ name: 'Tú', score: r.points }] });
    ctx.finish({
      title: '¡Bien hecho!',
      icon: 'bi-palette-fill', iconColor: 'text-warning',
      lead: `Pintaste ${r.hits} de ${r.total || r.hits || 0}`,
      score: r.points, maxScore: 100,
    });
  });
}
