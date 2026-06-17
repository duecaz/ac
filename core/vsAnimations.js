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

const _providers = new Map();

export function registerVsAnimation(provider) { _providers.set(provider.id, provider); }
export function listVsAnimations() { return [..._providers.values()]; }
export function getVsAnimation(id) { return _providers.get(id) || _providers.get('svg-tug'); }

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

function createSvgTug(container) {
  const scene = document.createElement('div');
  scene.className = 'vs-tug-scene';
  scene.innerHTML = sceneSvg();
  container.appendChild(scene);
  const rope = scene.querySelector('.tug-rope');
  const knot = scene.querySelector('.tug-knot');
  let knotX = TUG.CX, raf = 0, pullTimer = 0;

  const draw = kx => {
    if (rope) rope.setAttribute('d', ropeD(kx));
    if (knot) knot.setAttribute('transform', `translate(${kx},${TUG.KY})`);
  };
  const tweenTo = target => {
    cancelAnimationFrame(raf);
    const from = knotX, t0 = performance.now(), dur = 600, ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      knotX = from + (target - from) * ease(k);
      draw(knotX);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  return {
    setProgress(lead) {
      const p = Math.max(-1, Math.min(1, lead));
      tweenTo(TUG.CX - p * TUG.MAXOFF);          // left ahead (p>0) → knot pulled left
      scene.classList.toggle('lead-left', p > 0.03);
      scene.classList.toggle('lead-right', p < -0.03);
    },
    yank(side) {
      const cls = side === 'left' ? 'pull-left' : 'pull-right';
      scene.classList.remove('pull-left', 'pull-right');
      void scene.offsetWidth;                    // restart the keyframes
      scene.classList.add(cls);
      clearTimeout(pullTimer);
      pullTimer = setTimeout(() => scene.classList.remove(cls), 550);
    },
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
// lottie_light.min.js is bundled locally so the animation works without
// internet access and is not blocked by CDN restrictions.
const LOTTIE_LOCAL = './assets/js/lottie_light.min.js';
let _lottiePromise = null;

export function loadLottie() {
  if (window.lottie) return Promise.resolve(window.lottie);
  if (_lottiePromise) return _lottiePromise;
  _lottiePromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LOTTIE_LOCAL;
    s.onload = () => resolve(window.lottie);
    s.onerror = () => reject(new Error('No se pudo cargar lottie-web'));
    document.head.appendChild(s);
  });
  return _lottiePromise;
}

function createLottie(container, src) {
  let anim = null, total = 0, lead = 0, destroyed = false, restore = 0;
  let idleRaf = 0, idlePhase = 0;
  if (!src) {
    container.innerHTML = '<div class="vs-anim-fallback">Pega la URL de tu animación Lottie (.json) en Presentación.</div>';
    return { setProgress() {}, yank() {}, win() {}, destroy() {} };
  }
  // frame 0 = left winning, frame total-1 = right winning → invert lead.
  const frameFor = l => (1 - Math.max(-1, Math.min(1, l))) / 2 * Math.max(0, total - 1);

  // Sinusoidal idle: oscillate ±swing frames around the current lead frame so
  // the characters are always gently swaying, even when the score hasn't changed.
  // setProgress/win re-call idle() to re-center; yank cancels it briefly.
  function idle() {
    cancelAnimationFrame(idleRaf);
    idlePhase = 0;                              // reset so resume always starts from center
    if (!anim || !total || destroyed) return;
    const center = frameFor(lead);
    const swing = total / 3;   // ±30 frames for 90-frame anim (2/6 of total)
    const speed = 0.036;       // radians/frame → full cycle ≈ 2.9 s at 60 fps
    const step = () => {
      if (document.hidden) { idleRaf = requestAnimationFrame(step); return; } // pause when tab invisible
      idlePhase += speed;
      anim.goToAndStop(Math.max(0, Math.min(total - 1, center + Math.sin(idlePhase) * swing)), true);
      if (!destroyed) idleRaf = requestAnimationFrame(step);
    };
    idleRaf = requestAnimationFrame(step);
  }

  loadLottie().then(lottie => {
    if (destroyed) return;
    anim = lottie.loadAnimation({ container, renderer: 'svg', loop: false, autoplay: false, path: src });
    anim.addEventListener('DOMLoaded', () => { total = anim.totalFrames; idle(); });
    anim.addEventListener('data_failed', () => { container.innerHTML = '<div class="vs-anim-fallback">No se pudo cargar la animación Lottie.</div>'; });
  }).catch(() => { container.innerHTML = '<div class="vs-anim-fallback">No se pudo cargar lottie-web (¿sin conexión?).</div>'; });

  return {
    setProgress(l) { lead = l; idle(); },
    yank(side) {
      if (!anim || !total) return;
      cancelAnimationFrame(idleRaf);
      clearTimeout(restore);
      const dir = side === 'left' ? -1 : 1;
      const over = Math.max(0, Math.min(total - 1, frameFor(lead) + dir * total * 0.06));
      anim.goToAndStop(over, true);
      restore = setTimeout(() => { if (!destroyed) idle(); }, 160);
    },
    win(side) { lead = side === 'left' ? 1 : -1; idle(); },
    destroy() { destroyed = true; cancelAnimationFrame(idleRaf); clearTimeout(restore); if (anim) anim.destroy(); container.innerHTML = ''; }
  };
}

// Shared helper: loads Lottie into a list of .vsanim-preview containers and
// seeks each to its center (tie) frame — a static thumbnail, no animation.
// Returns the created anim instances so the caller can destroy them later.
// Generation-safe: caller checks whether its gen is still current before using
// the returned array (see playerView.initAnimPreviews / editorModes.wireModesTab).
export async function startPreviewAnims(containerEls) {
  const anims = [];
  if (!containerEls.length) return anims;
  const lottie = await loadLottie();
  for (const el of containerEls) {
    const anim = lottie.loadAnimation({ container: el, renderer: 'svg', loop: false, autoplay: false, path: el.dataset.src });
    anim.addEventListener('DOMLoaded', () => anim.goToAndStop(Math.round(anim.totalFrames / 2), true));
    anims.push(anim);
  }
  return anims;
}

// Factory for a bundled/known Lottie file (fixed src).
export function lottieProvider({ id, label, description, src }) {
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
registerVsAnimation(lottieProvider({
  id:          'lottie-cuerda',
  label:       'Cuerda (personajes)',
  description: 'Tira y afloja ilustrado con dos personajes.',
  src:         './assets/animations/cuerda.json',
}));

// ── Custom animations added from the Admin panel (localStorage) ───────────
import { loadCustomAnims, blobSrc } from './vsAnimStore.js';

export function initCustomAnims() {
  for (const entry of loadCustomAnims()) {
    if (_providers.has(entry.id)) continue; // already registered (hot reload guard)
    registerVsAnimation(lottieProvider({ id: entry.id, label: entry.label, description: entry.description, src: blobSrc(entry) }));
  }
}
