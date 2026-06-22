// PRESENTATION LAYER — single place that applies an activity's theme to a scene.
//
// An activity's presentation has two independent axes (see skins.js / backgrounds.js):
//   skin       = colors + fonts + sounds
//   background = visual texture
// Wordwall-style decoupling: the SAME content can be shown with any theme, so
// the "apply the theme to the screen" step is a presentation concern that must
// live in ONE module — not be re-implemented by every full-screen view.
//
// Before this module, the solo player, host-live and student-live views each
// copy-pasted the same three lines (apply skin, apply background, register a
// reset on teardown). They drifted — different fallbacks, and it was easy to
// forget the cleanup — which is exactly how a theme leaked onto the whole page.
//
//   applyScene(activity, ctx)                 → theme the PAGE for an immersive
//                                               view; auto-restores on teardown.
//   applyScene(activity, ctx, { defaultSkin}) → same, with a different fallback.
//   applyScene(activity, null, { target })    → theme only ONE element (the embed
//                                               frame); page chrome untouched.
//   resetScene(target?)                       → restore neutral skin + background.
import { applySkin } from './skins.js';
import { applyBackground } from './backgrounds.js';

const NEUTRAL_SKIN = 'default';
const NEUTRAL_BG = 'none';

// Restore neutral chrome. target=null → the page; an Element → just that element.
export function resetScene(target = null) {
  applySkin(NEUTRAL_SKIN, target);
  applyBackground(NEUTRAL_BG, target);
}

/**
 * Apply `activity`'s skin + background to a scene.
 * @param {object|null} activity         the activity (reads .presentation.skin/.background)
 * @param {{add:Function}|null} ctx       lifecycle handle; if given, neutral chrome
 *                                        is restored automatically on teardown.
 * @param {object} [opts]
 * @param {string} [opts.defaultSkin]     fallback when the activity has no skin
 * @param {string} [opts.defaultBg]       fallback when the activity has no background
 * @param {Element|null} [opts.target]    scope to this element instead of the page
 * @returns {Function} a manual reset for this same scope
 */
export function applyScene(activity, ctx = null, { defaultSkin = NEUTRAL_SKIN, defaultBg = NEUTRAL_BG, target = null } = {}) {
  applySkin(activity?.presentation?.skin || defaultSkin, target);
  applyBackground(activity?.presentation?.background || defaultBg, target, activity?.presentation?.backgroundImage);
  if (ctx) ctx.add(() => resetScene(target));
  return () => resetScene(target);
}
