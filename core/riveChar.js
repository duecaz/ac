// Lazy-loads the Rive runtime and drives a character canvas.
// Fails silently if the CDN is unreachable — the activity works without it.
const RIVE_CDN = 'https://cdn.jsdelivr.net/npm/@rive-app/canvas@2/rive.js';

let _loadPromise = null;
async function ensureRive() {
  if (window.Rive) return window.Rive;
  if (!_loadPromise) {
    _loadPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = RIVE_CDN;
      s.onload = () => resolve(window.Rive);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return _loadPromise;
}

/**
 * Mount a Rive character on a <canvas> element.
 * @param {HTMLCanvasElement} canvasEl
 * @param {string} animName  - initial animation to play ('Run', 'Jump', …)
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
      onLoadError: () => resolve(null),
    });
  });
}

/**
 * Switch the running character to the Jump animation.
 * @param {object} r  - Rive instance returned by mountRiveChar
 */
export function playJump(r) {
  if (!r) return;
  try { r.stop('Run'); } catch {}
  try { r.play('Jump'); } catch {}
}
