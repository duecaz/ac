// Skin system. Each skin is a manifest of CSS variables, optional stylesheet,
// and metadata. Skins register themselves via registerSkin() — no object needs
// to be edited here to add a new skin. Built-in skins are registered at the
// bottom of this file; external skins call registerSkin() from their own module.
//
// ── TOKEN CONTRACT ────────────────────────────────────────────────────────────
// These are the CSS vars activity stylesheets read. Skins override them.
// All activity CSS defines fallback defaults so a skin only needs to set
// what it actually changes.
//
// EL CONTRATO COMPLETO Y AL DÍA está en `docs/tokens.md` — GENERADO por
// `node tools/tokens.mjs`, con quién declara y quién consume CADA token. Lo que
// sigue es un resumen de orientación, escrito a mano y por tanto sujeto a
// quedarse viejo (lo estuvo: tenía valores por defecto que ya no eran los del
// código). Ante una discrepancia, manda el índice generado.
//
// GLOBAL
//   --ww-bg            page / player background
//   --ww-bg-soft       secondary / soft background
//   --ww-fg            primary text
//   --ww-card-bg       card / panel fill
//   --ww-card-border   card / panel border
//   --ww-accent        brand accent (buttons, links)
//   --ww-shape-1..4    answer option colours (maps to quiz/live)
//   --ww-success       correct answer green
//   --ww-danger        wrong answer red
//   --ww-warning       warning / time-running-out amber
//
// KEYPAD  (math activity) - la fuente es styles/math.css; esto es el indice.
//
//   LA MEDIDA MADRE. El enunciado, el visor y la cifra de una tecla son EL MISMO
//   tamano y salen de UN token. Cambiando `--math-cifra` se reescala toda la
//   calculadora de una vez: es la palanca que un tema quiere el 90 % de las veces.
//   El MODO (VS, Equipos) declara su valor; el TEMA gana por especificidad.
//   `tools/matrix-smoke.mjs` mide los tres RENDERIZADOS y exige que coincidan, asi
//   que un tema que use las escotillas absolutas debe moverlas LAS TRES JUNTAS.
//   --math-cifra       lo que mide una cifra      default: max(1rem, 11cqmin)
//   --math-font        tipografia de la calculadora  default: inherit (la del marco)
//
// LA OPCIÓN DE RESPUESTA (styles/opcion.css) — la pastilla que el alumno pulsa,
// igual en los cinco modos. El tema pide el relieve; no escribe dentro.
//   --opt-border        borde                default: 2px card (solo) / 1px transparente (ronda)
//   --opt-radius        redondeo             default: max(10px, 1.6cqmin)
//   --opt-weight        grosor de la letra   default: 600
//   --opt-shadow        sombra en reposo     default: ninguna
//   --opt-transition    transicion           default: la del modo
//   --opt-hover         transform al pasar   default: translateY(-2px)
//   --opt-hover-filter  filtro al pasar      default: ninguno
//   --opt-shadow-hover  sombra al pasar      default: 0 4px 12px rgba(0,0,0,.1)
//   --opt-press         transform al pulsar  default: como el hover
//   --opt-shadow-active sombra al pulsar     default: como la de reposo
//   --ww-shape-1..4     fondo de cada forma (acepta color O degradado)
//
//   EL ROTULO DEL TEMA sobre el enunciado (arcade pone «SOLVE!»). Sin el primero,
//   el pseudo-elemento no existe y no ocupa un pixel:
//   --math-q-rotulo          texto (`content`)      default: none (no se pinta)
//   --math-q-rotulo-color    su tinta               default: inherit
//   --math-q-rotulo-shadow   su sombra              default: none
//   --math-q-rotulo-size     su tamano              default: .5em
//   --math-head-min    alto de la banda cabecera  default: auto (lo declara el modo)
//   --math-tope        tope de ancho del bloque   default: 75cqh (Individual: 52cqh)
//   --key-size         key font-size              default: var(--math-cifra)
//   --display-size     answer display font-size   default: var(--math-cifra)
//   --math-q-size      question font-size         default: var(--math-cifra)
//
//   --key-bg           key fill                  default: #fff
//   --key-fg           key text                  default: #212529
//   --key-border       key border shorthand       default: 2px solid #ced4da
//   --key-radius       key corner radius          default: .5rem
//   --key-weight       key font-weight            default: 700
//   --key-pad          key padding shorthand      default: 0
//   --key-shadow       key box-shadow             default: none
//   --key-cols         keypad grid columns        default: 3
//   --key-rows         keypad grid rows           default: 4
//   --key-gap          keypad grid gap            default: clamp(.3rem,1.4cqmin,.7rem)
//   --key-ok-bg        submit key fill            default: --ww-success
//   --key-ok-fg        submit key text            default: #fff
//   --key-fn-bg        backspace key fill         default: #f1f3f5
//   --display-bg       answer display fill        default: #fff
//   --display-fg       answer display text        default: #212529
//   --display-border   answer display border      default: 3px solid #dee2e6
//   --display-radius   answer display radius      default: .6rem
//   --display-pad      answer display padding     default: .1rem 1rem
//   --math-q-weight    question font-weight       default: 800
//   --math-q-color     question text color        default: inherit
//   --math-gap         round flex gap             default: clamp(.4rem,2cqmin,1.1rem)
//
// VS LAYOUT (set by vsView on each panel; skins read in skin.css overrides)
//   --panel-bg         device panel fill
//   --panel-glow       device panel box-shadow glow
//   --panel-radius     device panel corner radius
//   --bar-bg           scorebar background
//   --bar-team-l       left team accent colour
//   --bar-team-r       right team accent colour
//   --badge-bg         VS badge fill
// ─────────────────────────────────────────────────────────────────────────────

import { VERSION } from './constants.js';

const _registry = new Map();

/** Register a skin. Can be called from any module — no core file needs editing.
 *  def must have: name (string), label (string), cssVars (object).
 *  Optional: description, bgImage, fontFamily, vsLayout, stylesheet, cssVars.
 */
export function registerSkin(def) {
  if (!def?.name) throw new Error('registerSkin: missing name');
  _registry.set(def.name, def);
}

/** Return a skin by name, falling back to 'default'. */
export function getSkin(name) {
  return _registry.get(name) || _registry.get('default');
}

export function listSkins() { return [..._registry.values()]; }

// Apply skin globally (page-wide) when target=null, or scoped to a single
// element (e.g. the player frame) when target is an Element.
export function applySkin(name, target = null) {
  const skin = getSkin(name);
  const validName = _registry.has(name) ? name : 'default';
  const cls = `skin-${validName}`;
  const allCls = [..._registry.keys()].map(k => `skin-${k}`);
  const el = target || document.documentElement;
  for (const [k, v] of Object.entries(skin.cssVars || {})) el.style.setProperty(k, v);
  if (target) {
    target.classList.remove(...allCls);
    target.classList.add(cls);
    target.style.fontFamily = skin.fontFamily || '';
  } else {
    document.body.classList.remove(...allCls);
    document.body.classList.add(cls);
    document.body.style.background = '';
    document.body.style.fontFamily = skin.fontFamily || '';
  }
  // Load optional skin-specific stylesheet declared in the manifest.
  // Each skin is responsible for its own CSS — core never needs updating.
  if (skin.stylesheet) {
    const id = `skin-css-${validName}`;
    // Cache-bust por versión: sin ?v= el Service Worker sirve el CSS viejo tras
    // actualizar un skin (igual que los drivers en adapters/index.js).
    const href = `${skin.stylesheet}?v=${VERSION}`;
    const existing = document.getElementById(id);
    if (!existing) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet'; link.href = href;
      document.head.appendChild(link);
    } else if (existing.getAttribute('href') !== href) {
      existing.setAttribute('href', href); // versión nueva → recargar la hoja
    }
  }
}

// Render a tiny preview tile for a skin (used by the editor).
export function skinPreviewHtml(name) {
  const s = getSkin(name);
  const v = s.cssVars;
  return `<div class="ww-skin-preview" style="background:${s.bgImage || v['--ww-bg']};color:${v['--ww-fg']};border:2px solid ${v['--ww-card-border']}">
    <div class="d-flex gap-1">
      <span style="background:${v['--ww-shape-1']}"></span>
      <span style="background:${v['--ww-shape-2']}"></span>
      <span style="background:${v['--ww-shape-3']}"></span>
      <span style="background:${v['--ww-shape-4']}"></span>
    </div>
    <small>${s.label}</small>
  </div>`;
}

// ── Built-in skins ────────────────────────────────────────────────────────────
// To add a new skin without touching this file: create themes/<name>/index.js
// and call registerSkin() there, then import it from themes/index.js.

registerSkin({
  name: 'default',
  label: 'Por defecto',
  description: 'Estilo limpio neutro.',
  cssVars: {
    '--ww-bg': '#ffffff',
    '--ww-bg-soft': '#f9fafb',
    '--ww-fg': '#1f2937',
    '--ww-card-bg': '#ffffff',
    '--ww-card-fg': '#1f2937',   // text INSIDE cards — contrasts with card-bg
    '--ww-card-border': '#dee2e6',
    '--ww-accent': '#6366f1',
    '--ww-accent-ink': '#ffffff',  // TINTA sobre el acento (4.5:1 medido) — el par nació del Lápiz ilegible en arcade
    '--ww-shape-1': '#e21b3c',
    '--ww-shape-2': '#1368ce',
    '--ww-shape-3': '#d89e00',
    '--ww-shape-4': '#26890c',
    '--ww-shape-1-fg': '#ffffff',   // TINTA por forma: la mejor contra ESTE color (medido, no estimado)
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#ffffff',
    
    // LA HOJA. El papel es una superficie propia: el marco lo tematiza el skin,
    // pero encima se ESCRIBE, así que necesita su propio par fondo/tinta. Sin
    // estos dos, el papel caía siempre al crema y el tema solo llegaba al borde —
    // y lo que se pintara encima con `--ww-fg` (tinta del MARCO) quedaba ilegible.
    '--ww-paper': '#fffdf6',
    '--ww-paper-ink': '#1f2937',
    '--ww-success': '#10b981',
    '--ww-danger': '#ef4444',
    '--ww-warning': '#f59e0b'
  },
  bgImage: null,
  fontFamily: null
});

registerSkin({
  name: 'classroom',
  label: 'Aula',
  description: 'Pizarra y madera.',
  cssVars: {
    '--ww-bg': '#fdf6e3',
    '--ww-bg-soft': '#f5edd3',
    '--ww-fg': '#3a2f1f',
    '--ww-card-bg': '#fffdf5',
    '--ww-card-fg': '#3a2f1f',
    '--ww-card-border': '#c9b88a',
    '--ww-accent': '#b45309',
    '--ww-accent-ink': '#ffffff',
    '--ww-shape-1': '#dc2626',
    '--ww-shape-2': '#2563eb',
    '--ww-shape-3': '#ca8a04',
    '--ww-shape-4': '#16a34a',
    '--ww-shape-1-fg': '#ffffff',
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#fdf8ec',
    '--ww-paper-ink': '#1f2937',
    '--ww-success': '#16a34a',   // verde tiza, encaja con la madera cálida
    '--ww-danger': '#dc2626',
    '--ww-warning': '#ca8a04'    // ámbar de la paleta (no el genérico)
  },
  bgImage: null,
  fontFamily: '"Georgia", serif'
});

registerSkin({
  // Card bg is WHITE → card text must be DARK, even though page fg is white.
  name: 'vibrante',
  label: 'Vibrante',
  description: 'Magenta y azul vibrantes.',
  cssVars: {
    '--ww-bg': '#46178f',
    '--ww-bg-soft': '#1368ce',
    '--ww-fg': '#ffffff',
    '--ww-card-bg': '#ffffff',
    '--ww-card-fg': '#1f2937',   // dark text on white cards (fg≠card-fg here)
    '--ww-card-border': '#46178f',
    '--ww-accent': '#ff3355',
    '--ww-accent-ink': '#ffffff',
    '--ww-shape-1': '#e21b3c',
    '--ww-shape-2': '#1368ce',
    '--ww-shape-3': '#d89e00',
    '--ww-shape-4': '#26890c',
    '--ww-shape-1-fg': '#ffffff',   // TINTA por forma: la mejor contra ESTE color (medido, no estimado)
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#ffffff',
        '--ww-paper': '#ffffff',
    '--ww-paper-ink': '#111827',
    '--ww-success': '#26890c',   // verde/rojo del concurso (los mismos de sus formas)
    '--ww-danger': '#e21b3c',
    '--ww-warning': '#d89e00'
  },
  bgImage: 'linear-gradient(135deg, #46178f 0%, #1368ce 100%)',
  fontFamily: null
});

registerSkin({
  name: 'retro',
  label: 'Retro',
  description: 'Píxeles y arcade.',
  cssVars: {
    '--ww-bg': '#0a0a23',
    '--ww-bg-soft': '#1a1a3e',
    '--ww-fg': '#39ff14',
    '--ww-card-bg': '#1a1a3e',
    '--ww-card-fg': '#39ff14',
    '--ww-card-border': '#39ff14',
    '--ww-accent': '#ff00ff',
    '--ww-accent-ink': '#ffffff',
    '--ww-shape-1': '#ff5555',
    '--ww-shape-2': '#5555ff',
    '--ww-shape-3': '#ffff55',
    '--ww-shape-4': '#55ff55',
    '--ww-shape-1-fg': '#1f2937',
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#fdf6e3',
    '--ww-paper-ink': '#3b2f2f',
    '--ww-success': '#39ff14',   // verde fósforo del texto retro
    '--ww-danger': '#ff5555',
    '--ww-warning': '#ffff55'
  },
  bgImage: null,
  fontFamily: '"Courier New", monospace'
});

registerSkin({
  name: 'jungle',
  label: 'Jungla',
  description: 'Verdes y tropical.',
  cssVars: {
    '--ww-bg': '#0f3a26',
    '--ww-bg-soft': '#155e3d',
    '--ww-fg': '#ecfccb',
    '--ww-card-bg': '#1a4d36',
    '--ww-card-fg': '#ecfccb',
    '--ww-card-border': '#84cc16',
    '--ww-accent': '#facc15',
    '--ww-accent-ink': '#14311f',  // amarillo: la tinta clara ahí no llega ni a 2:1
    '--ww-shape-1': '#dc2626',
    '--ww-shape-2': '#0891b2',
    '--ww-shape-3': '#facc15',
    '--ww-shape-4': '#84cc16',
    '--ww-shape-1-fg': '#ffffff',
    '--ww-shape-2-fg': '#1f2937',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#e9f7ec',
    '--ww-paper-ink': '#14311f',
    '--ww-success': '#84cc16',   // lima tropical (borde/acento de la jungla)
    '--ww-danger': '#dc2626',
    '--ww-warning': '#facc15'
  },
  bgImage: 'linear-gradient(180deg, #0f3a26 0%, #1a4d36 100%)',
  fontFamily: null
});

registerSkin({
  // Concurso de TV / eSports: azul eléctrico + rojo, badge VS dorado con anillo
  // animado, paneles flotantes con glow y teclado 3D. Todo el CSS vive en
  // themes/tv-show/skin.css, scoped bajo .skin-tv-show y .vs-skin-tv-show, así
  // que al cambiar de tema revierte por completo. Solo se definen tokens
  // ESTÁNDAR (presentes en 'default') → al cambiar de skin se sobrescriben todos
  // y no queda ninguna variable colgando.
  name: 'tv-show',
  label: 'TV Show',
  description: 'Concurso de televisión: glow azul, badge VS dorado y paneles 3D.',
  vsLayout: 'tv-show',
  stylesheet: 'themes/tv-show/skin.css',
  cssVars: {
    '--ww-bg': '#070d20',
    '--ww-bg-soft': '#0e1838',
    '--ww-fg': '#eaf2ff',
    '--ww-card-bg': '#111d44',
    '--ww-card-fg': '#eaf2ff',
    '--ww-card-border': '#3b82f6',
    '--ww-accent': '#ffc400',
    '--ww-accent-ink': '#0e1a3a',
    '--ww-shape-1': '#ef2b5b',
    '--ww-shape-2': '#2b6fff',
    '--ww-shape-3': '#13c4a3',
    '--ww-shape-4': '#ff8a00',
    '--ww-shape-1-fg': '#ffffff',
    '--ww-shape-2-fg': '#ffffff',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#0e1a3a',
    '--ww-paper-ink': '#e8eefc',
    '--ww-success': '#22c55e',
    '--ww-danger': '#ef4444',
    '--ww-warning': '#fbbf24'
  },
  bgImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, #1a2a66 0%, #070d20 70%)',
  fontFamily: null
});

registerSkin({
  // ARCADE — recreativa retro: marquesina de neón arriba, "INSERT COIN" abajo,
  // rejilla de neón al fondo, líneas de escaneo, fuente de píxeles y paneles que
  // parecen máquinas (cian vs rojo). Todo el CSS en themes/arcade/skin.css,
  // scoped bajo .skin-arcade y .vs-skin-arcade. Solo tokens ESTÁNDAR + de teclado.
  name: 'arcade',
  label: 'Arcade',
  description: 'Recreativa retro: marquesina de neón, INSERT COIN y píxeles.',
  vsLayout: 'arcade',
  stylesheet: 'themes/arcade/skin.css',
  cssVars: {
    '--ww-bg': '#0a0820',
    '--ww-bg-soft': '#120c33',
    '--ww-fg': '#eafcff',
    '--ww-card-bg': '#0c0a26',
    '--ww-card-fg': '#eafcff',
    '--ww-card-border': '#22d3ee',
    '--ww-accent': '#ffd400',
    '--ww-accent-ink': '#0b0a1c',
    '--ww-shape-1': '#ff2e88',
    '--ww-shape-2': '#22d3ee',
    '--ww-shape-3': '#a3e635',
    '--ww-shape-4': '#ffd400',
    '--ww-shape-1-fg': '#1f2937',
    '--ww-shape-2-fg': '#1f2937',
    '--ww-shape-3-fg': '#1f2937',
    '--ww-shape-4-fg': '#1f2937',
        '--ww-paper': '#0b0a1c',
    '--ww-paper-ink': '#eafcff',
    '--ww-success': '#39ff7a',
    '--ww-danger': '#ff3b6b',
    '--ww-warning': '#ffd400',
    '--key-radius': '.4rem',
    '--key-bg': 'rgba(34,211,238,.10)',
    '--key-fg': '#eafcff',
    '--key-border': '2px solid rgba(34,211,238,.5)',
    '--key-shadow': '0 0 10px rgba(34,211,238,.25), inset 0 0 6px rgba(34,211,238,.15)',
    '--key-fn-bg': 'rgba(255,255,255,.04)',
    '--display-bg': 'rgba(0,0,0,.55)',
    '--display-fg': '#39ff7a',
    '--display-border': '2px solid rgba(57,255,122,.6)',
    '--display-radius': '.35rem',
    '--math-q-color': '#ffd400'
  },
  bgImage: 'linear-gradient(180deg, #0a0820 0%, #1a0a3a 100%)',
  fontFamily: '"Press Start 2P", "Courier New", ui-monospace, monospace'
});
