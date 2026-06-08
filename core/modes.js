// Single source of truth for the GAME MODES of an activity.
//
// The activity page (views/playerView.js) builds its "Modos de juego" bar from
// MODE_DEFS, and the gating ("is this mode available for this activity?") lives
// HERE, in one place — instead of being copy-pasted across views where it used
// to drift. Adding a mode, or changing when one is offered, is a one-line edit
// in this file. A template opts into `live`/`async` via its static
// `meta.modes` (see templates/HOW_TO_ADD.md); `solo`/`vs`/`teams` are derived
// from what the template can do (scorer, items), not declared per template.
//
// PURE MODULE: it imports only pure core (registry + session engine), never a
// view or any DOM/browser code, so the gating is unit-testable in Node (see
// tests/modes.test.mjs). Actually MOUNTING a mode pulls its view lazily via
// dynamic import inside runMode(), which keeps this module side-effect free.
//
//   embed:true  → the mode's setup AND game run INSIDE the activity stage, on
//                 the SAME page with the SAME chrome (like Individual). These
//                 are the shared-screen modes: Individual, VS, Equipos.
//   embed:false → the mode opens its own page because it is a different
//                 PHYSICAL setup: En vivo = projector + students' phones;
//                 Tarea = assignment management. These share the mode bar and
//                 styling but navigate via `href` instead of mounting.
import { getTemplate } from './registry.js';
import { isVsCompatible, sessionItems } from '../kernel/session/engine.js';

export const MODE_DEFS = [
  {
    id: 'solo', label: 'Individual', icon: 'bi-person-fill', color: 'success',
    embed: true,
    title: 'Jugar aquí, en este dispositivo',
    isAvailable: () => true
  },
  {
    id: 'vs', label: 'VS (duelo)', icon: 'bi-fire', color: 'danger',
    embed: true,
    isAvailable: (a) => isVsCompatible(a),
    disabledHint: 'Necesita autocorrección y 2+ preguntas'
  },
  {
    id: 'teams', label: 'Equipos', icon: 'bi-people-fill', color: 'primary',
    embed: true,
    // Memoria juega Equipos con su mecánica nativa (ver runMode); el resto, por
    // turnos. Solo necesita al menos 1 ronda para tener algo que jugar.
    isAvailable: (a) => sessionItems(a).length >= 1,
    disabledHint: 'Esta actividad no tiene preguntas'
  },
  {
    id: 'live', label: 'En vivo', icon: 'bi-broadcast', color: 'info',
    embed: false,
    href: (a) => `#/launch/${a.id}`,
    isAvailable: (a) => !!getTemplate(a?.template)?.meta?.modes?.live,
    disabledHint: 'Esta plantilla no admite En vivo'
  },
  {
    id: 'task', label: 'Tarea', icon: 'bi-journal-check', color: 'warning',
    embed: false,
    href: (a) => `#/tasks/${a.id}`,
    isAvailable: (a) => !!getTemplate(a?.template)?.meta?.modes?.async,
    // Tarea no tiene sentido si la plantilla no la soporta: se OCULTA en vez de
    // mostrarse deshabilitada (las demás se muestran grises con su pista).
    hideWhenUnavailable: true
  }
];

/** Modes to render in the bar: all of them, minus those flagged to hide when
 *  unavailable (today only Tarea). Disabled-but-visible state is decided by the
 *  caller from `isAvailable`. */
export function availableModes(activity) {
  return MODE_DEFS.filter(m => !(m.hideWhenUnavailable && !m.isAvailable(activity)));
}

export function getMode(modeId) { return MODE_DEFS.find(m => m.id === modeId); }

export function isModeAvailable(modeId, activity) {
  const m = getMode(modeId);
  return !!(m && m.isAvailable(activity));
}

/** Mount an EMBED mode into `host` (a DOM element = the activity stage). Returns
 *  a handle `{ dispose() }` so the caller can tear the mode down (stop
 *  animations/timers/sounds) before mounting another. Only valid for
 *  `embed:true` modes — `embed:false` modes navigate via their `href`.
 *
 *  Views are pulled with DYNAMIC import so this module (and its tests) stay
 *  free of DOM/browser dependencies at import time. */
export async function runMode(modeId, host, activity, ctx) {
  switch (modeId) {
    case 'solo': {
      // `host` is the stage selector/element; the template paints straight into
      // it (mount() accepts either), exactly as the page did before.
      const { runPlayer } = await import('./player.js');
      await runPlayer(host, activity, { skipChrome: true });
      return { dispose() {} };
    }
    case 'vs': {
      const { mountVs } = await import('../views/vsView.js');
      return mountVs(host, activity, ctx) || { dispose() {} };
    }
    case 'teams': {
      // Memoria es un tablero por turnos (mecánica propia); el resto, secuencia.
      if (activity.template === 'memory') {
        const { mountMemory } = await import('../views/memoryView.js');
        return mountMemory(host, activity, ctx) || { dispose() {} };
      }
      const { mountTeams } = await import('../views/teamsView.js');
      return mountTeams(host, activity, ctx) || { dispose() {} };
    }
    default:
      throw new Error(`Modo no embebible: ${modeId} (¿es embed:false?)`);
  }
}
