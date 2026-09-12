// VS animation registry — the "stage" between the two duel panels is pluggable.
//
// An animation is a PROVIDER: { id, label, description, kind, create(container,
// opts) }. create() returns an INSTANCE that the duel drives through a tiny,
// stable contract so the animation itself is independent of the game logic:
//
//   instance.setProgress(lead)   lead ∈ [-1, 1]   (+1 = left fully winning)
//   instance.yank(side)          'left' | 'right' (quick reaction on a score)
//   instance.win(side)           optional end pose
//   instance.destroy()           tear down (cancel rAF, destroy lottie, …)
//
// Built-in: a hand-made SVG tug-of-war (no downloads). External animations made
// in another tool are added as Lottie (.json): see lottieProvider(). A Lottie
// file must be authored on a single timeline where:
//   frame 0        = LEFT player has won (left side dominating)
//   frame total/2  = tie
//   frame total-1  = RIGHT player has won (right side dominating)
// The engine scrubs to the frame matching the live score lead automatically.

import { VERSION } from './constants.js';
import { observeResize } from './observeResize.js';

/**
 * LA INSTANCIA que el duelo conduce. Contrato mínimo y estable: la animación no
 * sabe nada del juego.
 * @typedef {Object} AnimacionVs
 * @property {(lead: number) => void} setProgress
 * @property {(side: 'left'|'right') => void} yank
 * @property {(side: 'left'|'right') => void} win
 * @property {() => void} destroy
 */

/**
 * EL PROVEEDOR registrado (lo que se ofrece en Presentación).
 * @typedef {Object} ProveedorVs
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string} kind
 * @property {string} [src]
 * @property {boolean} [needsSrc]
 * @property {(container: HTMLElement, opts?: {src?: string}) => AnimacionVs} create
 */

/**
 * Lo que este módulo usa de `lottie-web` (librería externa, cargada por
 * `<script>`): se declara la superficie que se toca, no la librería entera.
 * @typedef {Object} LottieAnim
 * @property {number} totalFrames
 * @property {(frame: number, isFrame?: boolean) => void} goToAndStop
 * @property {(ev: string, fn: () => void) => void} addEventListener
 * @property {(width?: number, height?: number) => void} resize
 * @property {() => void} destroy
 */
/**
 * Ajustes del renderer `canvas`: el lienzo es NUESTRO (se pasa su contexto), y
 * con él el tope de tamaño. Sin `container`, lottie usa ese contexto en vez de
 * crearse un lienzo del tamaño de la pantalla (ver `configAnimation`).
 * @typedef {{context?: CanvasRenderingContext2D, clearCanvas?: boolean,
 *   preserveAspectRatio?: string}} LottieRendererSettings
 */
/**
 * @typedef {{loadAnimation: (o: {container?: Element, renderer: string,
 *   loop: boolean, autoplay: boolean, path?: string,
 *   rendererSettings?: LottieRendererSettings}) => LottieAnim}} LottieLib
 */

/** @type {Map<string, ProveedorVs>} */
const _providers = new Map();

// Animación por defecto en TODOS los VS: "Cuerda (personajes)" (Lottie). Si el id
// guardado ya no existe, getVsAnimation cae al SVG 'svg-tug' (sin descargas) como
// red de seguridad.
export const DEFAULT_VS_ANIMATION = 'lottie-cuerda';

/** @param {ProveedorVs} provider */
function registerVsAnimation(provider) { _providers.set(provider.id, provider); }
/** @returns {ProveedorVs[]} */
export function listVsAnimations() { return [..._providers.values()]; }
/** @param {string|null|undefined} id @returns {ProveedorVs|undefined} */
export function getVsAnimation(id) { return _providers.get(id || '') || _providers.get('svg-tug'); }

// ── Built-in SVG tug-of-war ──────────────────────────────────────────────
const TUG = { LHX: 260, LHY: 155, RHX: 740, RHY: 155, KY: 155, SAG: 24, CX: 500, MAXOFF: 155 };

const FIGURE = `
  <ellipse class="tug-shadow" cx="-6" cy="3" rx="46" ry="8"/>
  <line class="tug-limb" x1="-8" y1="-64" x2="-46" y2="0"/>
  <line class="tug-limb" x1="-8" y1="-64" x2="20" y2="0"/>
  <line class="tug-torso" x1="-8" y1="-64" x2="-26" y2="-112"/>
  <line class="tug-limb" x1="-12" y1="-80" x2="110" y2="-95"/>
  <line class="tug-limb" x1="-26" y1="-112" x2="110" y2="-95"/>
  <circle class="tug-head" cx="-32" cy="-130" r="16"/>
  <circle class="tug-eye" cx="-39" cy="-132" r="2.6"/>
  <circle class="tug-hand" cx="110" cy="-95" r="9"/>`;

/** @param {number} kx */
function ropeD(kx) {
  const { LHX, LHY, RHX, RHY, KY, SAG } = TUG;
  return `M${LHX},${LHY} Q${(LHX + kx) / 2},${KY + SAG} ${kx},${KY} Q${(kx + RHX) / 2},${KY + SAG} ${RHX},${RHY}`;
}

function sceneSvg() {
  return `
    <svg class="vs-tug-svg" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <line class="tug-ground" x1="40" y1="250" x2="960" y2="250"/>
      <g class="tug-zone">
        <rect class="tug-pit" x="466" y="243" width="68" height="13" rx="5"/>
        <line class="tug-centerline" x1="500" y1="118" x2="500" y2="246"/>
        <path class="tug-mark" d="M348,250 L348,224 L372,234 L348,244"/>
        <path class="tug-mark" d="M652,250 L652,224 L628,234 L652,244"/>
      </g>
      <g transform="translate(150,250)"><g class="tug-fig tug-fig-left">${FIGURE}</g></g>
      <g transform="translate(850,250) scale(-1,1)"><g class="tug-fig tug-fig-right">${FIGURE}</g></g>
      <g class="tug-dynamic">
        <path class="tug-rope" d="${ropeD(TUG.CX)}"/>
        <g class="tug-knot" transform="translate(${TUG.CX},${TUG.KY})">
          <line class="tug-pole" x1="0" y1="2" x2="0" y2="-46"/>
          <path class="tug-flag" d="M0,-46 L30,-39 L0,-31 Z"/>
          <circle class="tug-knotball" cx="0" cy="0" r="11"/>
        </g>
      </g>
      <g class="tug-dust tug-dust-left"><circle cx="120" cy="247" r="5"/><circle cx="138" cy="245" r="7"/><circle cx="104" cy="244" r="4"/></g>
      <g class="tug-dust tug-dust-right"><circle cx="880" cy="247" r="5"/><circle cx="862" cy="245" r="7"/><circle cx="896" cy="244" r="4"/></g>
    </svg>`;
}

/**
 * @param {HTMLElement} container
 * @returns {AnimacionVs}
 */
function createSvgTug(container) {
  const scene = document.createElement('div');
  scene.className = 'vs-tug-scene';
  scene.innerHTML = sceneSvg();
  container.appendChild(scene);
  const rope = scene.querySelector('.tug-rope');
  const knot = scene.querySelector('.tug-knot');
  let knotX = TUG.CX, raf = 0, pullTimer = 0;

  /** @param {number} kx */
  const draw = kx => {
    if (rope) rope.setAttribute('d', ropeD(kx));
    if (knot) knot.setAttribute('transform', `translate(${kx},${TUG.KY})`);
  };
  /** @param {number} target */
  const tweenTo = target => {
    cancelAnimationFrame(raf);
    const from = knotX, t0 = performance.now(), dur = 600;
    /** @param {number} t */
    const ease = t => 1 - Math.pow(1 - t, 3);
    /** @param {number} now */
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      knotX = from + (target - from) * ease(k);
      draw(knotX);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  return {
    /** @param {number} lead */
    setProgress(lead) {
      const p = Math.max(-1, Math.min(1, lead));
      tweenTo(TUG.CX - p * TUG.MAXOFF);          // left ahead (p>0) → knot pulled left
      scene.classList.toggle('lead-left', p > 0.03);
      scene.classList.toggle('lead-right', p < -0.03);
    },
    /** @param {'left'|'right'} side */
    yank(side) {
      const cls = side === 'left' ? 'pull-left' : 'pull-right';
      scene.classList.remove('pull-left', 'pull-right');
      void scene.offsetWidth;                    // restart the keyframes
      scene.classList.add(cls);
      clearTimeout(pullTimer);
      pullTimer = setTimeout(() => scene.classList.remove(cls), 550);
    },
    /** @param {'left'|'right'} side */
    win(side) { this.setProgress(side === 'left' ? 1 : -1); },
    destroy() { cancelAnimationFrame(raf); clearTimeout(pullTimer); scene.remove(); }
  };
}

registerVsAnimation({
  id: 'svg-tug',
  label: 'Tira y afloja',
  description: 'Dos personajes tiran de la cuerda. Vectorial, sin descargas.',
  kind: 'builtin',
  create(container) { return createSvgTug(container); }
});

// ── Lottie provider (.json made in another tool) ─────────────────────────
// El build va COPIADO en el repo (nunca un CDN): el aula puede estar sin
// internet y el arnés mediría otra pantalla (ver vendor/README.md). La versión
// va en el NOMBRE del fichero, como en `vendor/`, para que ningún navegador ni
// Cloudflare pueda servir el anterior desde caché.
//
// Es el build **canvas**: `lottie_light.min.js` solo traía el renderer SVG, y
// con él cada cuadro del reposo reescribía 153 trazados en el DOM y el
// navegador los rasterizaba al tamaño REAL de la pizarra (3840×2160 a DPR 3).
// El canvas pinta los mismos trazados en un lienzo con TOPE (ver `medirLienzo`)
// y el estirado lo hace el compositor, gratis.
const LOTTIE_LOCAL = './assets/js/lottie_light_canvas-5.13.0.min.js';
/** @type {Promise<LottieLib>|null} */
let _lottiePromise = null;

/** @returns {Promise<LottieLib>} */
function loadLottie() {
  const w = /** @type {Window & {lottie?: LottieLib}} */ (window);
  if (w.lottie) return Promise.resolve(w.lottie);
  if (_lottiePromise) return _lottiePromise;
  _lottiePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LOTTIE_LOCAL;
    s.onload = () => { if (w.lottie) resolve(w.lottie); else reject(new Error('lottie-web cargó sin publicarse')); };
    s.onerror = () => reject(new Error('No se pudo cargar lottie-web'));
    document.head.appendChild(s);
  });
  return _lottiePromise;
}

// EL LIENZO TIENE TOPE — el mismo principio que el confeti (`TOPE_LIENZO` de
// core/effects.js, medido: 128 ms/cuadro a 4K nativo → 31 ms con tope). Lo que
// cuesta pintar deja de depender del tamaño de la pizarra: se pinta a lo sumo
// 1280 px de ancho y el CSS lo estira al 100 % (el compositor no repinta).
// Y nunca por encima de 1,5× el tamaño CSS: a DPR 3 la cuerda se ve igual y
// cuesta cuatro veces menos.
const TOPE_LIENZO = 1280;
const TOPE_DPR = 1.5;

/**
 * Ajusta el tamaño de DIBUJO del lienzo al hueco actual. Devuelve true si
 * cambió (para no pedirle a lottie un `resize()` que no hace falta).
 * @param {HTMLElement} container
 * @param {HTMLCanvasElement} cv
 * @returns {boolean}
 */
function medirLienzo(container, cv) {
  const r = container.getBoundingClientRect();
  const anchoCss = Math.max(1, Math.round(r.width)), altoCss = Math.max(1, Math.round(r.height));
  const escala = Math.min(Math.min(window.devicePixelRatio || 1, TOPE_DPR), TOPE_LIENZO / anchoCss);
  const w = Math.max(1, Math.round(anchoCss * escala)), h = Math.max(1, Math.round(altoCss * escala));
  if (cv.width === w && cv.height === h) return false;
  cv.width = w; cv.height = h;
  return true;
}

/**
 * @param {HTMLElement} container
 * @param {string|null|undefined} src
 * @returns {AnimacionVs}
 */
function createLottie(container, src) {
  /** @type {LottieAnim|null} */
  let anim = null;
  let total = 0, lead = 0, destroyed = false;
  /** @type {ReturnType<typeof setTimeout>|0} */
  let restore = 0;
  let idleRaf = 0, idlePhase = 0;
  /** @type {(() => void)|null} */
  let unobserve = null;
  // El .json llega por `fetch`: hasta DOMLoaded el renderer no tiene contexto.
  let cargada = false;
  if (!src) {
    container.innerHTML = '<div class="vs-anim-fallback">Pega la URL de tu animación Lottie (.json) en Presentación.</div>';
    return { setProgress() {}, yank() {}, win() {}, destroy() {} };
  }
  // frame 0 = left winning, frame total-1 = right winning → invert lead.
  /** @param {number} l */
  const frameFor = l => (1 - Math.max(-1, Math.min(1, l))) / 2 * Math.max(0, total - 1);

  // Sinusoidal idle: oscillate ±swing frames around the current lead frame so
  // the characters are always gently swaying, even when the score hasn't changed.
  // setProgress/win re-call idle() to re-center; yank cancels it briefly.
  //
  // RENDIMIENTO: cada cuadro hace goToAndStop() = recalcular los 153 trazados y
  // pintarlos. Con el renderer `canvas` eso ya no toca el DOM ni rasteriza a la
  // resolución de la pizarra (el lienzo tiene tope), pero sigue siendo trabajo
  // del HILO PRINCIPAL, que es el que teclea en el duelo.
  //
  // EL REPOSO ES ESTÁTICO, EN TODAS LAS PANTALLAS. Medido (2026-09-12, 1280×720 a
  // DPR 3 con la CPU frenada 12×): el balanceo de reposo re-pintaba 135 trazados
  // por cuadro y era la única carga CONTINUA del duelo — en lienzo sin GPU salía
  // aún peor que en SVG (30 ms frente a 16 ms por cuadro). La decisión del dueño
  // es una sola animación igual en todas las pantallas, sin «modo ligero»: la
  // cuerda se queda quieta en el cuadro que marca el líder y solo se mueve al
  // responder (`setProgress`/`yank`), que son tirones cortos. Lo que se pierde
  // es un vaivén decorativo; lo que se gana es un hilo principal libre mientras
  // la clase teclea.
  function idle() {
    cancelAnimationFrame(idleRaf);
    idlePhase = 0;
    if (!anim || !total || destroyed) return;
    anim.goToAndStop(frameFor(lead), true);
  }

  // EL LIENZO ES NUESTRO: se crea aquí y se le pasa el CONTEXTO a lottie (sin
  // `container`, que es lo que hace que lottie se cree uno propio del tamaño de
  // la pantalla × devicePixelRatio). Así el tope de `medirLienzo` manda.
  const cv = document.createElement('canvas');
  cv.className = 'vs-lottie-canvas';
  cv.setAttribute('aria-hidden', 'true');
  cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
  container.appendChild(cv);
  medirLienzo(container, cv);
  const ctx = cv.getContext('2d');
  // Un entorno sin canvas de verdad: la animación es adorno del duelo, así que
  // se dice y se sigue jugando (R6: el motivo, escrito).
  if (!ctx) {
    container.innerHTML = '<div class="vs-anim-fallback">Este navegador no puede dibujar la animación.</div>';
    return { setProgress() {}, yank() {}, win() {}, destroy() {} };
  }

  loadLottie().then(lottie => {
    if (destroyed) return;
    const a = lottie.loadAnimation({
      renderer: 'canvas', loop: false, autoplay: false, path: src,
      rendererSettings: { context: ctx, clearCanvas: true, preserveAspectRatio: 'xMidYMid meet' },
    });
    anim = a;
    // `resize()` solo vale DESPUÉS de DOMLoaded: hasta que el .json no llega,
    // el renderer no tiene contexto y pedirle un resize revienta.
    a.addEventListener('DOMLoaded', () => { total = a.totalFrames; cargada = true; if (medirLienzo(container, cv)) a.resize(); idle(); });
    a.addEventListener('data_failed', () => { container.innerHTML = '<div class="vs-anim-fallback">No se pudo cargar la animación Lottie.</div>'; });
  }).catch(() => { container.innerHTML = '<div class="vs-anim-fallback">No se pudo cargar lottie-web (¿sin conexión?).</div>'; });

  // AL CAMBIAR EL HUECO se re-mide el lienzo y se le dice a lottie que rehaga su
  // transformación (si no, la cuerda se estira). Vía `observeResize` (rAF), que
  // es la única forma permitida en los players.
  unobserve = observeResize(container, () => {
    if (destroyed || !cv.isConnected) return;
    if (medirLienzo(container, cv) && cargada) anim?.resize();
  });

  return {
    /** @param {number} l */
    setProgress(l) { lead = l; idle(); },
    /** @param {'left'|'right'} side */
    yank(side) {
      if (!anim || !total) return;
      cancelAnimationFrame(idleRaf);
      clearTimeout(restore);
      const dir = side === 'left' ? -1 : 1;
      const over = Math.max(0, Math.min(total - 1, frameFor(lead) + dir * total * 0.06));
      anim.goToAndStop(over, true);
      restore = setTimeout(() => { if (!destroyed) idle(); }, 160);
    },
    /** @param {'left'|'right'} side */
    win(side) { lead = side === 'left' ? 1 : -1; idle(); },
    destroy() { destroyed = true; cancelAnimationFrame(idleRaf); clearTimeout(restore); unobserve?.(); unobserve = null; if (anim) anim.destroy(); container.innerHTML = ''; }
  };
}

// Shared helper: loads Lottie into a list of .vsanim-preview containers and
// seeks each to its center (tie) frame — a static thumbnail, no animation.
// Returns the created anim instances so the caller can destroy them later.
// Generation-safe: caller checks whether its gen is still current before using
// the returned array (see editorModes.wireModesTab).
/**
 * @param {HTMLElement[]} containerEls
 * @returns {Promise<LottieAnim[]>}
 */
export async function startPreviewAnims(containerEls) {
  /** @type {LottieAnim[]} */
  const anims = [];
  if (!containerEls.length) return anims;
  const lottie = await loadLottie();
  for (const el of containerEls) {
    // La miniatura sí pasa `container`: es un cuadro ESTÁTICO (no hay bucle que
    // pagar) y así lottie se encarga del lienzo y de estirarlo al hueco.
    const anim = lottie.loadAnimation({ container: el, renderer: 'canvas', loop: false, autoplay: false, path: el.dataset.src });
    anim.addEventListener('DOMLoaded', () => anim.goToAndStop(Math.round(anim.totalFrames / 2), true));
    anims.push(anim);
  }
  return anims;
}

// Factory for a bundled/known Lottie file (fixed src).
/**
 * @param {{id: string, label: string, description: string, src: string}} o
 * @returns {ProveedorVs}
 */
function lottieProvider({ id, label, description, src }) {
  return { id, label, description, kind: 'lottie', src, create(container) { return createLottie(container, src); } };
}

// Teacher-supplied Lottie: the src comes from the activity (presentation
// .vsAnimationSrc), passed as opts.src at create() time.
registerVsAnimation({
  id: 'lottie-url',
  label: 'Lottie (.json) propia',
  description: 'Tu animación hecha en otro programa (pega su URL .json en Presentación).',
  kind: 'lottie',
  needsSrc: true,
  create(container, opts) { return createLottie(container, opts && opts.src); }
});

// ── Bundled animations ────────────────────────────────────────────────────
// `?v=VERSION` en la propia URL — como llevan las hojas de estilo
// (tools/stamp-assets.mjs) — porque este .json NO pasaba por ese sellado y
// quedó cacheado en el navegador y en Cloudflare para siempre: el dueño editó
// el archivo, borró cookies y Service Worker desde el admin, y la animación
// vieja seguía saliendo — porque el SW ya está desregistrado a propósito
// (§ dev-local) y el que cachea es el HTTP normal, que solo mira la URL.
// Puesta aquí (en vez de en el HTML) porque este archivo lo pide `lottie-web`
// por `fetch`, no por una etiqueta `<link>` que el sellador pueda tocar.
registerVsAnimation(lottieProvider({
  id:          'lottie-cuerda',
  label:       'Cuerda (personajes)',
  description: 'Tira y afloja ilustrado con dos personajes.',
  src:         `./assets/animations/cuerda.json?v=${VERSION}`,
}));

// ── Custom animations added from the Admin panel (localStorage) ───────────
import { loadCustomAnims, blobSrc } from './vsAnimStore.js';

export function initCustomAnims() {
  for (const entry of loadCustomAnims()) {
    if (_providers.has(entry.id)) continue; // already registered (hot reload guard)
    registerVsAnimation(lottieProvider({ id: entry.id, label: entry.label, description: entry.description || '', src: blobSrc(entry) }));
  }
}
