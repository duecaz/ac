// EL MOTOR DE SKINS: registrar, aplicar y previsualizar. Los SIETE skins de
// fábrica son datos y viven en `themes/builtin/` (uno por fichero), junto al CSS
// propio de los temas que lo tienen; aquí no hay ni un color.
//
// Un skin se registra con `registerSkin()` desde cualquier módulo — no hay que
// editar este fichero para añadir uno. Los de fábrica se registran al importarlo
// (abajo), así que quien importe `core/skins.js` los tiene ya.
//
// LA INTERFAZ tema↔juego (qué token declara cada uno y quién lo consume) está en
// `docs/tokens.md` — GENERADO por `node tools/tokens.mjs` —, y el resumen escrito
// a mano, en `themes/builtin/index.js`.

import { VERSION } from './constants.js';
import { SKINS_DE_FABRICA } from '../themes/builtin/index.js';

/**
 * UN SKIN, tal y como lo registra su manifiesto. `cssVars` es la INTERFAZ con
 * el juego (§3): el skin cambia tokens, la actividad los consume.
 * @typedef {Object} Skin
 * @property {string} name
 * @property {string} label
 * @property {Record<string, string>} cssVars
 * @property {string} [description]
 * @property {string|null} [bgImage]
 * @property {string|null} [fontFamily]
 * @property {string|null} [vsLayout]
 * @property {string|null} [stylesheet]
 */

/** @type {Map<string, Skin>} */
const _registry = new Map();

/** Register a skin. Can be called from any module — no core file needs editing.
 *  def must have: name (string), label (string), cssVars (object).
 *  Optional: description, bgImage, fontFamily, vsLayout, stylesheet, cssVars.
 */
/** @param {Skin} def */
export function registerSkin(def) {
  if (!def?.name) throw new Error('registerSkin: missing name');
  _registry.set(def.name, def);
}

/** Return a skin by name, falling back to 'default'.
 * @param {string|null|undefined} name
 * @returns {Skin|undefined} */
export function getSkin(name) {
  return (name ? _registry.get(name) : undefined) || _registry.get('default');
}

export function listSkins() { return [..._registry.values()]; }

// Apply skin globally (page-wide) when target=null, or scoped to a single
// element (e.g. the player frame) when target is an Element.
/**
 * @param {string|null|undefined} name
 * @param {Element|null} [target]
 */
export function applySkin(name, target = null) {
  const skin = getSkin(name);
  if (!skin) return;   // no hay ni `default`: nada que aplicar
  const validName = name && _registry.has(name) ? name : 'default';
  const cls = `skin-${validName}`;
  const allCls = [..._registry.keys()].map(k => `skin-${k}`);
  const el = /** @type {HTMLElement} */ (target || document.documentElement);
  for (const [k, v] of Object.entries(skin.cssVars || {})) el.style.setProperty(k, v);
  if (target) {
    el.classList.remove(...allCls);
    el.classList.add(cls);
    el.style.fontFamily = skin.fontFamily || '';
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
/** @param {string|null|undefined} name */
export function skinPreviewHtml(name) {
  const s = getSkin(name);
  if (!s) return '';
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

// ── Los skins de fábrica ──────────────────────────────────────────────────────
// Son DATO (themes/builtin/): se registran al cargar este módulo, que es lo que
// todos sus consumidores importan. Un skin externo llama a registerSkin() desde
// su propio módulo.
for (const def of SKINS_DE_FABRICA) registerSkin(def);
