// Lazy-loads the Rive runtime and drives a character canvas.
// Fails silently if the CDN is unreachable — the activity works without it.
// @rive-app/canvas UMD exposes window.rive (lowercase), constructor at window.rive.Rive.
const RIVE_CDN = 'https://unpkg.com/@rive-app/canvas/rive.js';

let _loadPromise = null;

function getRiveCtor() {
  // Handle both export patterns: window.rive.Rive (UMD) and window.Rive (some builds).
  return (window.rive && window.rive.Rive) || window.Rive || null;
}

async function ensureRive() {
  const existing = getRiveCtor();
  if (existing) return existing;
  if (!_loadPromise) {
    _loadPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = RIVE_CDN;
      s.onload = () => resolve(getRiveCtor());
      s.onerror = () => { console.warn('[riveChar] CDN load failed'); resolve(null); };
      document.head.appendChild(s);
    });
  }
  return _loadPromise;
}

/**
 * Mount a Rive character on a <canvas> element.
 * @param {HTMLCanvasElement} canvasEl
 * @param {string} animName  - initial animation ('Run', 'Jump', …)
 * @returns {Promise<object|null>}  Rive instance, or null if Rive unavailable
 */
export async function mountRiveChar(canvasEl, animName = 'Run') {
  const RiveCtor = await ensureRive();
  if (!RiveCtor || !canvasEl) return null;
  return new Promise((resolve) => {
    const r = new RiveCtor({
      src: 'animations/footballtime.riv',
      canvas: canvasEl,
      animations: animName,
      autoplay: true,
      onLoad: () => { r.resizeDrawingSurfaceToCanvas(); resolve(r); },
      onLoadError: () => { console.warn('[riveChar] .riv load failed'); resolve(null); },
    });
  });
}

/**
 * Switch the character from Run to Jump.
 * @param {object} r  Rive instance from mountRiveChar
 */
export function playJump(r) {
  if (!r) return;
  try { r.stop('Run'); } catch {}
  try { r.play('Jump'); } catch {}
}
