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
//
// AUTORIDAD (¿quién puede ABRIR este modo?): un modo que crea una sesión
// compartida ESCRIBE en una colección host-only (ley §22: el veredicto es del
// host, y el servidor solo distingue host de alumno por el token). Esos modos
// declaran en qué colección escriben (`writes`) y qué acto de profe hacen
// (`hostAction`); `modeNeedsAuth()` lo DERIVA de las reglas reales
// (`HOST_ONLY_WRITES` de core/pbRules.js) en vez de repetir la lista. Así la UI
// puede avisar ANTES —"inicia sesión para crear la sala"— en vez de dejar que
// el 403 aparezca con la clase delante.
import { getTemplate } from './registry.js';
import { isVsCompatible } from '../kernel/session/engine.js';
import { sessionItems } from '../kernel/content/sessionItems.js';
import { canAutoScoreRound } from './templateCapability.js';
import { HOST_ONLY_WRITES, LIVE_SESSIONS, ASSIGNMENTS } from './pbRules.js';
import { claimStage } from './stageClaim.js';

export const MODE_DEFS = [
  {
    id: 'solo', label: 'Individual', short: 'individual', icon: 'bi-person-fill', color: 'success',
    embed: true,
    // La ruta del modo, aquí como la de todos. Faltaba —solo la declaraban los
    // dos que navegan (live/tarea)— y por eso `rutaDeModo('solo')` devolvía
    // `#/solo/:id`, que no existe: el hueco que obligaba a escribir `#/play/…`
    // a mano en cada vista que pinta la tira de modos.
    href: (a) => `#/play/${a.id}`,
    title: 'Jugar aquí, en este dispositivo',
    // Casi todo template implementa renderPlayer, salvo los que se declaran
    // SOLO en vivo (p.ej. Pregunta Live: meta.modes.solo === false). Ese opt-out
    // explícito oculta "Individual"; el resto lo mantiene por defecto.
    supportsTemplate: (T) => T?.meta?.modes?.solo !== false,
    isAvailable: (a) => getTemplate(a?.template)?.meta?.modes?.solo !== false
  },
  {
    id: 'vs', label: 'VS (duelo)', short: 'vs', icon: 'bi-fire', color: 'danger',
    embed: true,
    href: (a) => `#/vs/${a.id}`,
    // CAPACIDAD (¿puede esta plantilla?): sabe puntuar un ítem y pintarlo.
    supportsTemplate: (T) => canAutoScoreRound(T),
    // DISPONIBLE (¿esta actividad concreta?): además, ≥2 ítems para una carrera justa.
    isAvailable: (a) => isVsCompatible(a),
    disabledHint: 'Necesita autocorrección y 2+ preguntas'
  },
  {
    id: 'teams', label: 'Equipos', short: 'equipos', icon: 'bi-people-fill', color: 'primary',
    embed: true,
    // Capacidad: auto vía scoreSubmission+renderRound, o Memoria con su mecánica
    // nativa por turnos. (No se ofrece en herramientas como la ruleta, que no
    // tienen ronda.)
    supportsTemplate: (T) => canAutoScoreRound(T) || T?.meta?.play?.teams === 'propio',
    // Disponible: Memoria necesita ≥2 pares; el resto, ≥1 ronda. Coincide con lo
    // que cada vista exige (no ofrecer un modo que luego no arranca).
    isAvailable: (a) => traeMecanicaPropia(a)
      ? (a?.content?.pairs || []).filter(p => p?.left && p?.right).length >= 2
      : sessionItems(a).length >= 1,
    disabledHint: 'Esta actividad no tiene preguntas suficientes'
  },
  {
    id: 'live', label: 'En vivo', short: 'en vivo', icon: 'bi-broadcast', color: 'info',
    embed: false,
    href: (a) => `#/launch/${a.id}`,
    // Abrir sala = escribir en live_sessions (host-only). El ALUMNO no necesita
    // cuenta: entra con el PIN.
    writes: LIVE_SESSIONS,
    hostAction: 'crear una sala en vivo',
    supportsTemplate: (T) => !!T?.meta?.modes?.live,
    isAvailable: (a) => !!getTemplate(a?.template)?.meta?.modes?.live,
    disabledHint: 'Esta plantilla no admite En vivo'
  },
  {
    id: 'task', label: 'Tarea', short: 'tarea', icon: 'bi-journal-check', color: 'warning',
    embed: false,
    href: (a) => `#/tasks/${a.id}`,
    // Crear/cerrar tarea = escribir en assignments (host-only). El alumno la
    // hace con su código, sin cuenta.
    writes: ASSIGNMENTS,
    hostAction: 'crear una tarea',
    supportsTemplate: (T) => !!T?.meta?.modes?.async,
    isAvailable: (a) => !!getTemplate(a?.template)?.meta?.modes?.async,
    // Tarea no tiene sentido si la plantilla no la soporta: se OCULTA en vez de
    // mostrarse deshabilitada (las demás se muestran grises con su pista).
    hideWhenUnavailable: true
  }
];

/** Modos que una PLANTILLA puede ofrecer en principio (capacidad), derivados de
 *  lo que la clase implementa/declara. Lo usa el selector de plantillas para
 *  mostrar "solo · vs · equipos · …" sin contenido todavía. Para una actividad
 *  concreta (con contenido) usa availableModes(). T es la clase de plantilla. */
/** ¿Esta actividad trae su PROPIA mecánica de Equipos? Lo DECLARA la plantilla
 *  (`meta.play.teams === 'propio'`), no lo adivina la plataforma por el nombre. */
const traeMecanicaPropia = (a) =>
  getTemplate(a?.template)?.meta?.play?.teams === 'propio';

/**
 * LA RUTA DE UN MODO — dueño único.
 *
 * «Equipos» tiene DOS rutas (`#/teams/:id` y `#/memory/:id`, la mecánica propia)
 * y elegir entre ellas estaba escrito, palabra por palabra, en CINCO vistas:
 * home, portada, biblioteca, juegos y autor —
 *   navigate(`#/${b.dataset.tpl === 'memory' ? 'memory' : 'teams'}/${id}`)
 * — o sea la plataforma preguntándole a un botón si la plantilla se llama
 * «memory». Dos cosas mal a la vez: la ley §0 (un modo no conoce plantillas
 * concretas) y el número — una mecánica propia nueva obligaba a acordarse de
 * cinco sitios, y el sexto que se olvidara mandaría al profe a la vista que no
 * es. Aquí se decide una vez, a partir de lo que la plantilla DECLARA.
 */
export function rutaDeModo(modeId, activity) {
  const def = getMode(modeId);
  if (def?.href) return def.href(activity);
  if (modeId === 'teams') return `#/${traeMecanicaPropia(activity) ? 'memory' : 'teams'}/${activity.id}`;
  return `#/${modeId}/${activity.id}`;
}

export function modesForTemplate(T) {
  return MODE_DEFS.filter(m => m.supportsTemplate(T));
}

/** Modes to render in the bar: all of them, minus those flagged to hide when
 *  unavailable (today only Tarea). Disabled-but-visible state is decided by the
 *  caller from `isAvailable`. */
export function availableModes(activity) {
  return MODE_DEFS.filter(m => !(m.hideWhenUnavailable && !m.isAvailable(activity)));
}

export function getMode(modeId) { return MODE_DEFS.find(m => m.id === modeId); }

/** Normaliza `'live'` | MODE_DEF → MODE_DEF. */
const asMode = (m) => (typeof m === 'string' ? getMode(m) : m);

/** ¿Abrir este modo exige sesión de profe? Se DERIVA de las reglas del servidor
 *  (`HOST_ONLY_WRITES`), no de una lista repetida aquí: si mañana una colección
 *  deja de ser host-only, el aviso desaparece solo. */
export function modeNeedsAuth(mode) {
  const m = asMode(mode);
  return !!(m?.writes && HOST_ONLY_WRITES.includes(m.writes));
}

/** Frase EXACTA que ve el profe cuando le falta la sesión ("Inicia sesión para
 *  crear una sala en vivo"). Una sola redacción para el botón, el tooltip, el
 *  modal y el gate del router — no cuatro variantes que se separan. */
export function modeAuthHint(mode) {
  const m = asMode(mode);
  if (!modeNeedsAuth(m)) return '';
  return `Inicia sesión para ${m.hostAction || `usar ${m.label}`}`;
}

/** Modos host-only que hoy están BLOQUEADOS por no haber entrado. `authed` lo
 *  aporta la vista (este módulo es puro y no conoce la sesión). */
export function lockedModes(authed) {
  return authed ? [] : MODE_DEFS.filter(m => modeNeedsAuth(m));
}

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
  // Ficha de ocupación (§23): montar un modo RECLAMA el escenario, así los
  // relojes pendientes del modo anterior (el spin de la Ruleta, el avance del
  // shell secuencial) descubren en su alive() que ya no son los dueños.
  claimStage(host);
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
      // La plantilla DECLARA si trae su mecánica de Equipos (play.teams:'propio').
      if (traeMecanicaPropia(activity)) {
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
