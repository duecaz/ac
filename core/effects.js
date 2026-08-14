// Visual effects driven by game events: confetti at podium and a quick burst on
// a correct answer. Confeti PROPIO en canvas (sin CDN externo) → funciona
// siempre, también offline o con la red restringida. Cada efecto tiene cooldown
// para que re-emisiones rápidas del mismo evento no se apilen en un estrobo.
import { GameEvents, onGame } from './gameEvents.js';
import { clock } from './clock.js';
import { lsGet, lsSet } from './ls.js';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#eab308'];

// Interruptor global de efectos visuales (confeti). Se persiste igual que el
// silencio de sonidos, para que la pantalla de inicio pueda activar/desactivar.
// Vía ls.js (no wrappers locales): así un fallo de cuota emite `ww:storage-full`
// en vez de perderse en silencio.
let _fxMuted = lsGet('ww.fxMuted') === '1';
export function setEffectsMuted(m) { _fxMuted = !!m; lsSet('ww.fxMuted', _fxMuted ? '1' : '0'); }
export function isEffectsMuted() { return _fxMuted; }

// Confeti minimalista en canvas. opts: { particleCount, spread (grados),
// startVelocity, origin:{x,y} en 0..1, ticks (vida) }.
function confetti(opts = {}) {
  if (typeof document === 'undefined') return;
  const { particleCount = 30, spread = 50, startVelocity = 30, origin = { x: 0.5, y: 0.7 }, ticks = 90 } = opts;
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  // EN PANTALLA COMPLETA, EL CONFETI VA DENTRO. El navegador solo pinta el
  // elemento a pantalla completa y SUS HIJOS: un canvas colgado de <body> se
  // dibuja fuera de lo visible. Y «Iniciar» entra SIEMPRE en pantalla completa
  // (views/startScreen.js), así que en modo Individual la celebración del final
  // no se veía NUNCA — el efecto existía, se ejecutaba entero y no llegaba a
  // ningún píxel. Por eso «antes funcionaba»: dejó de verse el día que Iniciar
  // pasó a poner el juego a pantalla completa, sin tocar los efectos.
  const escena = document.fullscreenElement || document.webkitFullscreenElement || document.body;
  escena.appendChild(cv);
  const ctx = cv.getContext('2d');
  const cx = (origin.x ?? 0.5) * cv.width, cy = (origin.y ?? 0.7) * cv.height;
  const parts = Array.from({ length: particleCount }, () => {
    const ang = (-90 + (Math.random() - 0.5) * spread) * Math.PI / 180;
    const v = startVelocity * (0.5 + Math.random());
    return { x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
             c: COLORS[(Math.random() * COLORS.length) | 0], r: 3 + Math.random() * 4,
             rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: ticks };
  });
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive = true; p.life--; p.vy += 0.55; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 30));
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6); ctx.restore();
    }
    frame++;
    if (alive && frame < ticks + 40) requestAnimationFrame(tick); else cv.remove();
  })();
}

let _lastPodium = 0, _lastCorrect = 0;
const PODIUM_COOLDOWN = 5000, CORRECT_COOLDOWN = 800;

function podiumBurst() {
  if (_fxMuted) return;
  const now = clock.now();
  if (now - _lastPodium < PODIUM_COOLDOWN) return;
  _lastPodium = now;
  confetti({ particleCount: 160, spread: 120, startVelocity: 45, origin: { y: 0.6 }, ticks: 120 });
}

function correctBurst() {
  if (_fxMuted) return;
  const now = clock.now();
  if (now - _lastCorrect < CORRECT_COOLDOWN) return;
  _lastCorrect = now;
  confetti({ particleCount: 40, spread: 60, startVelocity: 32, origin: { y: 0.7 }, ticks: 80 });
}

onGame(GameEvents.PODIUM, podiumBurst);
onGame(GameEvents.ANSWER_CORRECT, correctBurst);

// Disparo manual para vistas que gestionan su propio feedback (p. ej. VS, que
// se sale del burst global de ANSWER_CORRECT y lo dispara solo si el docente
// activó "confeti por pregunta").
export function answerConfetti() { return correctBurst(); }
