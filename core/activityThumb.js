// Miniatura fiel 16:10 de una actividad. En vez de dibujar una imagen a mano,
// renderiza estáticamente la PRIMERA pantalla del juego reutilizando las mismas
// clases CSS de los players, dentro de un escenario fijo (1280×800) escalado al
// ancho de la tarjeta con un transform. Sin timers ni listeners → markup puro,
// seguro para montar muchas en la rejilla del home.
//
// El markup de cada actividad NO vive aquí: cada plantilla declara su
// `static previewHtml(act)` (contrato en templates/base.js, verificado por
// tests/templateContract.test.mjs). Este módulo solo aporta el CHASIS (CSS del
// escenario, escalado, montaje) y despacha al registro — así es imposible crear
// una actividad sin preview u olvidar añadirla a un switch central, y el preview
// no puede desincronizarse del juego (sale de la misma plantilla).
import { getTemplate } from './registry.js';
import { applySkin } from './skins.js';
import { applyBackground } from './backgrounds.js';
import { STAGE_W, STAGE_H, emptyHtml } from './previewKit.js';

const SHAPE_ICONS = ['bi-triangle-fill', 'bi-diamond-fill', 'bi-circle-fill', 'bi-square-fill'];

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  // El escenario replica el layout real de .ww-player-frame (fondo de tarjeta,
  // padding, flex-fill, container-query) pero con valores FIJOS — sin media
  // queries — porque todo el escenario va escalado por transform.
  const css = `
    .ww-thumb{position:relative;width:100%;aspect-ratio:16/10;overflow:hidden;
      border-radius:.375rem .375rem 0 0;pointer-events:none;background:#e9ecef;}
    .ww-thumb-stage{position:absolute;top:0;left:0;transform-origin:top left;
      width:${STAGE_W}px;height:${STAGE_H}px;overflow:hidden;
      background:var(--ww-card-bg,#fff);color:var(--ww-fg,#212529);
      container-type:size;}
    .ww-thumb-pad{position:absolute;inset:0;padding:1.75rem;overflow:hidden;}
    .ww-thumb-pad > .ww-player,.ww-thumb-pad > .ww-match,
    .ww-thumb-pad > .ww-memory,.ww-thumb-pad > .tc-solo{
      display:flex;flex-direction:column;height:100%;gap:1.4cqh;}
    .ww-thumb-pad .ww-q{flex:0 0 auto;margin:0;line-height:1.15;
      font-size:clamp(1rem,5cqmin,2.4rem);}
    .ww-thumb-pad .ww-q-media{flex:1 1 auto;min-height:0;display:flex;
      align-items:center;justify-content:center;}
    .ww-thumb-pad .ww-q-media img{max-height:100%;max-width:100%;
      object-fit:contain;border-radius:8px;}
    .ww-thumb-pad .ww-options{flex:0 0 auto;gap:1.2cqh;}
    .ww-thumb-pad .ww-kahoot-grid .btn{font-size:clamp(.9rem,3.4cqmin,1.9rem);
      padding:clamp(.45rem,2.2cqh,1.6rem);min-height:0;white-space:normal;}
    .ww-thumb-pad .tc-passage{font-size:clamp(1rem,4cqmin,2rem);line-height:1.7;}
    .ww-thumb-pad .ww-memo-grid,.ww-thumb-pad .row{flex:1 1 auto;min-height:0;}`;
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
}

// SHAPE_ICONS lo re-exporta previewKit; se mantiene aquí sólo por compatibilidad
// con cualquier importador antiguo (no hay ninguno hoy).
export { SHAPE_ICONS };

// Despacha al preview de la plantilla; respaldo = solo el título.
function buildHtml(act) {
  const T = getTemplate(act.template);
  if (typeof T?.previewHtml === 'function') {
    try { return T.previewHtml(act); } catch { /* contenido raro → respaldo */ }
  }
  return emptyHtml(act);
}

// ── Escalado: un único listener de resize reescala todas las miniaturas. ─────
const _mounted = new Set();
let _bound = false;
function rescaleAll() {
  for (const c of [..._mounted]) {
    if (!document.contains(c)) { _mounted.delete(c); continue; }
    const stage = c.firstElementChild;
    if (!stage) continue;
    const w = c.clientWidth;
    if (w) stage.style.transform = `scale(${w / STAGE_W})`;
  }
}
function ensureBound() {
  if (_bound) return;
  _bound = true;
  if (typeof window !== 'undefined') window.addEventListener('resize', rescaleAll);
}

// Monta una miniatura fiel 16:10 de `activity` dentro de `container`.
export function mountThumb(container, activity) {
  if (!container) return;
  injectStyles();
  container.classList.add('ww-thumb');
  container.innerHTML = '';
  const stage = document.createElement('div');
  // ww-player-frame para que el CSS scoped de skin/fondo pinte el escenario; las
  // reglas del frame que rompen el layout piden un ancestro .ww-play-page que no
  // tenemos, así que quedan inertes.
  stage.className = 'ww-thumb-stage ww-player-frame';
  stage.innerHTML = `<div class="ww-thumb-pad">${buildHtml(activity)}</div>`;
  container.appendChild(stage);
  // Skin + fondo con scope — solo este escenario, nunca la página entera.
  try { applySkin(activity.presentation?.skin || 'default', stage); } catch { /* skin opcional */ }
  try { applyBackground(activity.presentation?.background || 'none', stage, activity.presentation?.backgroundImage); } catch { /* fondo opcional */ }
  _mounted.add(container);
  ensureBound();
  requestAnimationFrame(rescaleAll);
}
