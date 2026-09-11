// Registro de animaciones de PROGRESO para el modo SOLO (individual). Una
// animación es un "carril" por el que cruza una mascota a medida que el alumno
// acierta — alimentada SOLO por el bus de eventos del juego, así funciona con
// CUALQUIER plantilla (Operaciones, Quiz, Tildes, Sopa…) sin acoplarse a ninguna.
//
// Contrato de instancia (estable, independiente de la plantilla):
//   hop({ streak })   salto hacia adelante al acertar
//   slip()            tropiezo al fallar (sin avanzar)
//   finish()          llegar a la meta (celebración)
//   setProgress(frac) posición 0..1 (sincronización opcional)
//   destroy()
//
// Espejo de core/vsAnimations.js, pero para solo. Hoy hay una sola animación: la rana saltarina.
/** LA BOCA de una animación ya montada (el contrato de arriba).
 *  @typedef {{hop: (o?: {streak?: number}) => void, slip: () => void, finish: () => void,
 *    setProgress: (frac: number) => void, destroy: () => void}} InstanciaAnimacion */
/** Quien sabe montar una: lo que se registra.
 *  @typedef {{id: string, label: string, description?: string,
 *    create: (container: HTMLElement, o?: {total?: number, scene?: string}) => InstanciaAnimacion}} ProveedorAnimacion */

/** @type {Map<string, ProveedorAnimacion>} */
const _providers = new Map();

/** @param {ProveedorAnimacion} provider */
function registerSoloAnimation(provider) { _providers.set(provider.id, provider); }
/** @param {string} id @returns {ProveedorAnimacion|null} */
export function getSoloAnimation(id) { return _providers.get(id) || null; }

// Por defecto: ninguna (no altera las actividades existentes).

// ── Rana saltarina ───────────────────────────────────────────────────────────
/** @type {Record<string, {pad: string, css: string, label: string}>} */
const SCENES = {
  swamp:  { pad: '🪷', css: 'frog-swamp',   label: 'Charca'   },
  jungle: { pad: '🌿', css: 'frog-jungle',  label: 'Selva'    },
  space:  { pad: '🪐', css: 'frog-space',   label: 'Espacio'  },
  winter: { pad: '❄️',  css: 'frog-winter',  label: 'Invierno' },
  volcano:{ pad: '🌋', css: 'frog-volcano', label: 'Volcán'   },
};
/** Los escenarios que el EDITOR ofrece (`presentation.frogScene`): salen de la
 *  misma tabla que los pinta, así no hay una lista copiada en el formulario. */
export const FROG_SCENES = Object.entries(SCENES).map(([id, sc]) => ({ id, pad: sc.pad, label: sc.label }));
/** @param {number} s @returns {string} */
const streakLabel = (s) => s >= 15 ? '🔥🔥' : s >= 10 ? '🔥' : s >= 5 ? '⚡' : s >= 3 ? '✨' : '';

// Posiciones en PORCENTAJE: la pista ocupa TODO el ancho del box (sin scroll).
// La rana va del margen izq. (START%) a la meta (END%) en `pads` saltos, con los
// charcos repartidos uniformemente entre medias.
const START_PCT = 9, END_PCT = 91;

/**
 * @param {HTMLElement} container
 * @param {{total?: number, scene?: string}} [o]
 * @returns {InstanciaAnimacion}
 */
function createFrog(container, { total = 1, scene = 'swamp' } = {}) {
  const sc = SCENES[scene] || SCENES.swamp;
  const pads = Math.max(1, total);           // un charco por pregunta; meta = total
  const step = (END_PCT - START_PCT) / pads; // % entre paradas
  /** @param {number} k @returns {number} */
  const pct  = (k) => START_PCT + k * step;  // % de la parada k (0..pads)
  // OJO: NO tocar container.className — el contenedor es el carril (.ww-solo-anim)
  // cuyo alto lo fija styles/player.css. La animación va en un hijo .frog-anim.
  const padHtml = Array.from({ length: pads }, (_, i) =>
    `<div class="frog-pad" style="left:${pct(i)}%">${sc.pad}</div>`).join('');
  container.innerHTML = `
    <div class="frog-anim">
      <div class="frog-track">
        <div class="frog-world">
          ${padHtml}
          <div class="frog-flag frog-flag-finish" style="left:${pct(pads)}%">🏁</div>
          <div class="frog-mascot" style="left:${pct(0)}%">
            <div class="frog-badge"></div>
            <div class="frog-char">🐸</div>
            <div class="frog-shadow"></div>
          </div>
        </div>
      </div>
    </div>`;

  const track  = /** @type {HTMLElement|null} */ (container.querySelector('.frog-track'));
  const mascot = /** @type {HTMLElement|null} */ (container.querySelector('.frog-mascot'));
  const char   = /** @type {HTMLElement|null} */ (container.querySelector('.frog-char'));
  const badge  = /** @type {HTMLElement|null} */ (container.querySelector('.frog-badge'));
  let pos = 0;

  /** @param {number} toPad @param {number} streak */
  function jumpTo(toPad, streak) {
    // Arco escalado al alto REAL del carril, para que el salto no se recorte
    // contra el borde del marco (el carril es discreto, ≤25%).
    const h    = track?.clientHeight || 90;
    const arcH = Math.min(12 + streak * 2, Math.max(10, h * 0.34));
    const dur  = Math.min(420 + streak * 40, 1000);
    if (mascot) { mascot.style.transition = `left ${dur}ms cubic-bezier(.25,.46,.45,.94)`; mascot.style.left = `${pct(toPad)}%`; }
    if (char) {
      char.animate([
        { transform: 'scaleX(0.88) scaleY(1.12) translateY(0)',          offset: 0 },
        { transform: `scaleX(0.94) scaleY(1.06) translateY(-${arcH}px)`, offset: 0.45 },
        { transform: 'scaleX(1.14) scaleY(0.84) translateY(0)',          offset: 0.88 },
        { transform: 'scaleX(1) scaleY(1) translateY(0)',                offset: 1 },
      ], { duration: dur, easing: 'ease-out' });
      char.classList.toggle('frog-golden', streak >= 10);
    }
    // partículas de salpicadura
    const colors = ['#fbbf24', '#f97316', '#10b981', '#3b82f6'];
    const n = Math.min(6 + Math.floor(streak / 2) * 2, 14);
    for (let i = 0; i < n; i++) {
      const p = document.createElement('span');
      p.className = 'frog-particle';
      p.style.cssText = `left:${40 + Math.random() * 60}%;top:${20 + Math.random() * 50}%;`
        + `--dx:${(Math.random() - 0.5) * 80}px;--dy:${-(20 + Math.random() * 50)}px;`
        + `background:${colors[Math.floor(Math.random() * colors.length)]};`
        + `width:${5 + Math.random() * 6}px;height:${5 + Math.random() * 6}px;`;
      track?.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
  }

  return {
    hop({ streak = 0 } = {}) {
      pos = Math.min(pos + 1, pads);
      if (badge) badge.textContent = streakLabel(streak);
      jumpTo(pos, streak);
    },
    slip() {
      if (!char) return;
      char.animate([
        { transform: 'rotate(0) translateY(0)',        offset: 0 },
        { transform: 'rotate(-20deg) translateY(4px)', offset: 0.3 },
        { transform: 'rotate(15deg) translateY(2px)',  offset: 0.6 },
        { transform: 'rotate(0) translateY(0)',        offset: 1 },
      ], { duration: 700, easing: 'ease-in-out' });
    },
    finish() {
      // Llega a la meta (aunque haya fallado alguna): salto de celebración.
      pos = pads;
      char?.classList.add('frog-golden');
      jumpTo(pos, 12);
    },
    /** @param {number} frac */
    setProgress(frac) {
      pos = Math.max(0, Math.min(pads, Math.round((frac || 0) * pads)));
      if (mascot) { mascot.style.transition = 'left .4s ease'; mascot.style.left = `${pct(pos)}%`; }
    },
    destroy() { container.innerHTML = ''; },
  };
}

registerSoloAnimation({
  id: 'frog',
  label: 'Rana saltarina',
  description: 'Una rana cruza saltando charcos a medida que el alumno acierta.',
  create: createFrog,
});
