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

/**
 * Escena POR FASE para las vistas live (docs/handoff-player-frame.md, Etapa 1):
 * devuelve un toggle `scene(game)` que aplica el fondo/skin de la actividad SOLO
 * en pantallas de JUEGO y lo resetea en las de chrome (lobby/podio/esperas), con
 * short-circuit para no re-aplicar en cada repaint. Compartido por hostLive y
 * studentLive (antes cada vista llevaba su copia).
 * El teardown NO va aquí: cada vista registra `ctx.add(() => resetScene())`.
 */
export function sceneToggle(activity, { defaultSkin = 'vibrante', target = null } = {}) {
  let on = null;
  return (game) => {
    if (game === on) return;
    on = game;
    if (game) applyScene(activity, null, { defaultSkin, target });
    else resetScene(target);
  };
}

// ── EL AMBIENTE DEL DUELO, UN SOLO DUEÑO (§21b, 2026-09-01) ─────────────────
//
// `presentation.vsFeedback` y `presentation.vsAnimationOff` los escribían y
// leían DOS módulos con sus propias constantes: `views/vsView.js` (la antesala y
// el duelo) y `core/editorModes.js` (el panel del editor). La misma forma escrita
// dos veces acaba diciendo dos cosas, y ya lo decía: al retirar el interruptor de
// sonido hubo que tocar los dos ficheros con el mismo comentario, y el defecto de
// la animación NO coincidía —el editor la daba por encendida siempre, mientras el
// duelo la apaga sola en las hojas de texto (Tildes/Comas), donde el carril
// central roba el ancho que necesita el texto—. Es decir: el editor enseñaba
// «Animación: sí» y la clase veía el duelo sin animación.
//
// El sonido NO está aquí: su dueño es `core/sounds.js` (el silencio global).
// Interno a propósito: quien necesite los valores llama a `vsFeedback(a)` —
// exportar la constante invitaría a volver a mezclarla a mano en otro módulo,
// que es de donde venía la divergencia.
const VS_FX_DEFAULTS = { flash: true, confetti: false };

/** Los interruptores de feedback del duelo, con sus defectos. */
export function vsFeedback(activity) {
  return { ...VS_FX_DEFAULTS, ...(activity?.presentation?.vsFeedback || {}) };
}

/** Enciende/apaga UNO. Muta la actividad (quien llama decide si la guarda). */
export function setVsFeedback(activity, key, on) {
  if (!activity.presentation) activity.presentation = {};
  activity.presentation.vsFeedback = { ...vsFeedback(activity), [key]: !!on };
  return activity;
}

/** ¿Se ve la animación central del duelo? El defecto lo pide la PLANTILLA: una
 *  hoja de texto la apaga sola porque necesita el ancho. */
export function vsAnimacionOn(activity, { textTight = false } = {}) {
  return !(activity?.presentation?.vsAnimationOff ?? textTight);
}

export function setVsAnimacion(activity, on) {
  if (!activity.presentation) activity.presentation = {};
  activity.presentation.vsAnimationOff = !on;
  return activity;
}
