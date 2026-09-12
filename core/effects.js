// Visual effects driven by game events: confetti at podium and a quick burst on
// a correct answer. Confeti PROPIO en canvas (sin CDN externo) → funciona
// siempre, también offline o con la red restringida. Cada efecto tiene cooldown
// para que re-emisiones rápidas del mismo evento no se apilen en un estrobo.
import { GameEvents, onGame } from './gameEvents.js';
import { clock } from './clock.js';
import { lsGet, lsSet } from './ls.js';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#eab308'];

// Ancho MÁXIMO del lienzo del confeti, en píxeles de dibujo. Por encima de esto
// el efecto se pinta más pequeño y se estira: a esta distancia y con esta
// velocidad nadie distingue un papelito de 1280 px estirado de uno nativo, y el
// coste de pintar deja de depender del tamaño de la pizarra.
const TOPE_LIENZO = 1280;

// Interruptor global de efectos visuales (confeti). Se persiste igual que el
// silencio de sonidos, para que la pantalla de inicio pueda activar/desactivar.
// Vía ls.js (no wrappers locales): así un fallo de cuota emite `ww:storage-full`
// en vez de perderse en silencio.
let _fxMuted = lsGet('ww.fxMuted') === '1';
/** @param {boolean} m */
export function setEffectsMuted(m) { _fxMuted = !!m; lsSet('ww.fxMuted', _fxMuted ? '1' : '0'); }
export function isEffectsMuted() { return _fxMuted; }

// Ticks finales durante los que un papelito se desvanece. Fuera de esa cola el
// alfa es 1 y NO se toca: cambiar `globalAlpha` por papelito y por cuadro es un
// cambio de estado del contexto 2D que el navegador no puede agrupar.
const TICKS_DESVANECIDO = 30;

/** Un papelito. @typedef {{x: number, y: number, vx: number, vy: number,
 *   c: string, r: number, rot: number, vr: number, life: number, g: number}} Papel */

// ── EL LIENZO ES UNO, Y VIVE ENTRE RÁFAGAS ─────────────────────────────────
// Antes cada ráfaga creaba SU canvas con su propio bucle rAF. En el cierre del
// duelo coinciden tres (podio + racha + acierto) y eran tres lienzos a pantalla
// completa, tres borrados y tres bucles compitiendo por el mismo cuadro en la
// pizarra del aula. Ahora hay UNO: las ráfagas añaden papelitos a la misma
// lista, un solo bucle los mueve y el lienzo se retira en cuanto no queda
// ninguno vivo (no se deja puesto un canvas a pantalla completa tapando —aunque
// sea con `pointer-events:none`— el resto de la sesión).
/** @type {HTMLCanvasElement|null} */
let _cv = null;
/** @type {CanvasRenderingContext2D|null} */
let _ctx = null;
/** @type {Papel[]} */
let _papeles = [];
let _corriendo = false;
let _escala = 1;

/** El lienzo listo para pintar, colgado de donde AHORA se ve.
 *  @returns {{cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D}|null} */
function lienzo() {
  if (!_cv) {
    _cv = document.createElement('canvas');
    _cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
    _ctx = _cv.getContext('2d');
  }
  const cv = _cv, ctx = _ctx;
  // Sin contexto 2D no hay nada que pintar (un entorno sin canvas de verdad).
  // Best-effort DECLARADO: el confeti es adorno, no algo que el usuario pidió,
  // así que se retira el lienzo y se sigue sin molestar a nadie (R6).
  if (!ctx) { cv.remove(); return null; }
  // EL LIENZO NO CRECE CON LA PANTALLA. Iba a `window.innerWidth`, así que en una
  // pizarra 4K eran 8,3 MILLONES de píxeles que se borran y se recomponen 60
  // veces por segundo. Medido con la CPU frenada 12x: 128 ms por fotograma —OCHO
  // fps— mientras la clase mira el podio; en un portátil 1366 el MISMO código
  // daba 16,7 ms. El confeti no necesita resolución: se pinta en un lienzo con
  // TOPE y el navegador lo estira (el CSS ya lo pone a 100vw/100vh).
  // La FÍSICA se escala con la misma razón, así que se ve exactamente igual que
  // antes en cualquier pantalla — lo que baja es lo que cuesta pintarlo.
  const anchoCss = Math.max(1, window.innerWidth), altoCss = Math.max(1, window.innerHeight);
  _escala = Math.min(1, TOPE_LIENZO / anchoCss);
  const w = Math.round(anchoCss * _escala), h = Math.round(altoCss * _escala);
  // Asignar `width`/`height` BORRA el lienzo: solo se toca si de verdad cambió
  // (girar la tablet), no en cada ráfaga.
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  // EN PANTALLA COMPLETA, EL CONFETI VA DENTRO. El navegador solo pinta el
  // elemento a pantalla completa y SUS HIJOS: un canvas colgado de <body> se
  // dibuja fuera de lo visible. Y «Iniciar» entra SIEMPRE en pantalla completa
  // (views/antesala.js), así que en modo Individual la celebración del final
  // no se veía NUNCA — el efecto existía, se ejecutaba entero y no llegaba a
  // ningún píxel. Por eso «antes funcionaba»: dejó de verse el día que Iniciar
  // pasó a poner el juego a pantalla completa, sin tocar los efectos.
  // Se recomprueba en CADA ráfaga porque el lienzo sobrevive a las anteriores:
  // entre una y otra el juego pudo entrar o salir de pantalla completa.
  const doc = /** @type {Document & {webkitFullscreenElement?: Element|null}} */ (document);
  const escena = doc.fullscreenElement || doc.webkitFullscreenElement || document.body;
  if (cv.parentNode !== escena) escena.appendChild(cv);
  return { cv, ctx };
}

// EL BUCLE, UNO SOLO. Dibuja con `setTransform` en vez de
// `save/translate/rotate/restore`: eran CUATRO operaciones de pila por papelito
// y por cuadro (hasta 160 papelitos en el podio = 640 llamadas por cuadro) para
// lo que una matriz de rotación resuelve en una. Y el alfa solo se toca en la
// cola del desvanecido, no en los 90 ticks de vuelo.
function bucle() {
  const cv = _cv, ctx = _ctx;
  if (!cv || !ctx) { _corriendo = false; return; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  let alfa = 1;
  ctx.globalAlpha = 1;
  /** @type {Papel[]} */
  const vivos = [];
  for (const p of _papeles) {
    p.life--;
    if (p.life <= 0) continue;
    p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    const a = p.life < TICKS_DESVANECIDO ? p.life / TICKS_DESVANECIDO : 1;
    if (a !== alfa) { ctx.globalAlpha = a; alfa = a; }
    const cos = Math.cos(p.rot), sin = Math.sin(p.rot);
    ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
    vivos.push(p);
  }
  _papeles = vivos;
  if (vivos.length) { requestAnimationFrame(bucle); return; }
  // Ni un papelito vivo: se recoge la mesa. El elemento se GUARDA (no se
  // reconstruye en la siguiente ráfaga), pero sale del DOM.
  _corriendo = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  cv.remove();
}

// Confeti minimalista en canvas. opts: { particleCount, spread (grados),
// startVelocity, origin:{x,y} en 0..1, ticks (vida) }.
/**
 * @param {{particleCount?: number, spread?: number, startVelocity?: number,
 *   origin?: {x?: number, y?: number}, ticks?: number}} [opts]
 */
function confetti(opts = {}) {
  if (typeof document === 'undefined') return;
  const { particleCount = 30, spread = 50, startVelocity = 30, origin = { x: 0.5, y: 0.7 }, ticks = 90 } = opts;
  // LOS MISMOS PAPELITOS EN TODAS LAS PANTALLAS. Antes se soltaba la MITAD si
  // el aparato parecía de gama baja (`isLowEndDevice()`): dos celebraciones
  // distintas según quién mirase, y encima la puerta no se abría justo donde
  // hacía falta (la pizarra del aula lleva 8 núcleos y 8 GB). La decisión del
  // dueño es una sola animación por sitio; lo que hace barato el confeti es el
  // TOPE del lienzo, no contar papelitos.
  const l = lienzo();
  if (!l) return;
  const { cv } = l;
  const escala = _escala;
  const cx = (origin.x ?? 0.5) * cv.width, cy = (origin.y ?? 0.7) * cv.height;
  const gravedad = 0.55 * escala;
  for (let i = 0; i < particleCount; i++) {
    const ang = (-90 + (Math.random() - 0.5) * spread) * Math.PI / 180;
    const v = startVelocity * (0.5 + Math.random()) * escala;
    _papeles.push({ x: cx, y: cy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v,
      c: COLORS[(Math.random() * COLORS.length) | 0], r: (3 + Math.random() * 4) * escala,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, life: ticks, g: gravedad });
  }
  if (!_corriendo) { _corriendo = true; requestAnimationFrame(bucle); }
}

// UMBRALES_RACHA — crónica (hallazgo B4, auditoría 2026-07): `GameEvents.STREAK`
// lo emitían 3 plantillas (globos, quiz, wordsearch) con `{ count }` y NADIE lo
// escuchaba — el 🔥 que se ve en pantalla lo pinta cada plantilla por su cuenta,
// pero el bus no producía sonido/efecto pese a que la doc lo prometía. Decisión
// del dueño (2026-09-02): conectar con una ráfaga de confeti MÁS CORTA que la
// del podio, al cruzar 3 y 5 aciertos seguidos. Único sitio donde vive el umbral.
const UMBRALES_RACHA = [3, 5];

let _lastPodium = 0, _lastCorrect = 0, _lastStreak = 0;
const PODIUM_COOLDOWN = 5000, CORRECT_COOLDOWN = 800, STREAK_COOLDOWN = 800;

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

// Ráfaga de racha: más corta que el podio (80 partículas vs 160, ticks 70 vs
// 120), y SOLO al cruzar un umbral — no en cada acierto dentro de la racha
// (con count 3,4,5,6… saldría un confeti por pregunta y dejaría de leerse como
// hito). No hay sonido propio de racha en el pack (`core/sounds.js` no declara
// uno): es efecto visual puro, el 🔥 ya lo lleva cada plantilla en su HUD.
/** @param {{count?: number}} [o] */
function streakBurst({ count } = {}) {
  if (_fxMuted) return;
  if (typeof count !== 'number' || !UMBRALES_RACHA.includes(count)) return;
  const now = clock.now();
  if (now - _lastStreak < STREAK_COOLDOWN) return;
  _lastStreak = now;
  confetti({ particleCount: 80, spread: 70, startVelocity: 36, origin: { y: 0.65 }, ticks: 70 });
}

onGame(GameEvents.PODIUM, podiumBurst);
onGame(GameEvents.ANSWER_CORRECT, correctBurst);
onGame(GameEvents.STREAK, streakBurst);

// Disparo manual para vistas que gestionan su propio feedback (p. ej. VS, que
// se sale del burst global de ANSWER_CORRECT y lo dispara solo si el docente
// activó "confeti por pregunta").
export function answerConfetti() { return correctBurst(); }
