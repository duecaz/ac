// Backend-agnostic SESSION engine — one pure core that drives every
// multiplayer / classroom format from a single brain, so scoring and flow live
// in ONE place (and stay in parity with the Supabase Edge Functions):
//
//   live   sala con anfitrión, al estilo de un concurso: many players, a synchronized
//          question→reveal→leaderboard flow, anti-cheat scoring at settle()
//          (never when a client submits). Byte-for-byte the old createLiveRoom.
//   teams  One screen, no 1:1 devices (Baamboozle/Factile-style): fixed teams
//          take TURNS on a shared question flow. Scored automatically
//          (scoreSubmission) OR by a TEACHER JUDGE — the host marks ✓/✗ — so ANY
//          content plays in teams, even templates without a machine scorer.
//   vs     1-vs-1 duel: two sides race through the SAME item sequence in
//          PARALLEL, each auto-scored on submit; standings() drives the central
//          "who's winning" animation. Needs a scorer and ≥2 items to be fair.
//   (solo NO vive aquí: el modo Individual es de los shells de core/soloPlayer.js.)
//
// Pure: no DOM, no network, JSON-serializable state → a whole session can be
// simulated and asserted in Node, and rebuilt from a snapshot (opts.state).
//
// v1.51.630: partido POR MÁQUINA (docs/leyes.md §0, deuda condicionada de
// CLAUDE.md) — este fichero queda de FACHADA: el despachador `createSession` y
// los re-exports que sus importadores actuales esperan. Cada máquina vive en su
// propio fichero (liveMachine.js, teamsMachine.js, vsMachine.js), la
// puntuación/carga de ronda COMPARTIDA en score.js, y `sessionItems` se mudó a
// kernel/content/ (era utilidad de contenido, no del motor). El diagrama y el
// mapa completo de la superficie re-exportada: docs/arquitectura-modulos.md.
import { getTemplate } from '../../core/registry.js';
import { FORMATS } from './formats.js';
import { createLiveSession } from './liveMachine.js';
import { createTeamsSession } from './teamsMachine.js';
import { createVsSession, isVsCompatible, ganador } from './vsMachine.js';

export { FORMATS };
// `ganador`: quién gana un duelo, la regla en un solo sitio (§21b) — la usan el
// podio del duelo (views/vsView.js) y el orquestador de listas (views/listView.js).
export { isVsCompatible, ganador };
// `roundPayloadOf`: las vistas de live (rondas, tablero, carrera) y
// core/liveSnapshot.js lo importaban de aquí; sigue siendo LA misma función,
// solo que implementada en score.js junto a autoScore (su gemela de puntuación).
export { roundPayloadOf } from './score.js';

/**
 * @typedef {import('../contracts/activity.js').Activity} Activity
 * @typedef {import('../contracts/session.js').SessionFormat} SessionFormat
 * @typedef {import('./liveMachine.js').LiveOpts} LiveOpts
 * @typedef {import('./teamsMachine.js').TeamsOpts} TeamsOpts
 * @typedef {import('./vsMachine.js').VsOpts} VsOpts
 */

/**
 * Las opciones de las TRES máquinas juntas: cada campo es opcional y `format`
 * decide cuál las lee. Es intersección y no unión a propósito — así el
 * despachador puede pasar el MISMO objeto a la máquina que toque.
 * @typedef {LiveOpts & TeamsOpts & VsOpts & { format?: SessionFormat }} SessionOpts
 */

/**
 * Single entry point. `opts.format` selects the flow; `opts.state` hydrates.
 * @param {Activity} activity
 * @param {SessionOpts} [opts]
 */
export function createSession(activity, opts = {}) {
  const format = opts.format || FORMATS.LIVE;
  const T = getTemplate(activity?.template);
  if (!T) throw new Error(`Plantilla desconocida: ${activity?.template}`);
  // La sala en vivo y el duelo solo corren con una plantilla que PUNTÚA: el
  // contrato se lo EXIGE a quien declara `modes.live` o `play.vs`, y `createVsSession`
  // vuelve a comprobarlo con `isVsCompatible` antes de montar nada. Equipos NO
  // lo exige (existe el modo juez), así que ahí va la plantilla tal cual.
  const conScorer = () => /** @type {import('./score.js').ScoringTemplate} */ (T);
  switch (format) {
    case FORMATS.LIVE:  return createLiveSession(activity, conScorer(), opts);
    case FORMATS.TEAMS: return createTeamsSession(activity, T, opts);
    case FORMATS.VS:    return createVsSession(activity, conScorer(), opts);
    // SOLO no tiene sesión de kernel A PROPÓSITO (C3): el modo Individual vive
    // en los shells (core/soloPlayer.js), que son su único dueño — estado,
    // reanudación F5, techo y guardado. Hubo un createSoloSession aquí que
    // NADIE llamaba en producción: era una segunda verdad latente y se retiró.
    // El kernel es para los modos multi-actor (lados, turnos, fases, sala).
    case FORMATS.SOLO:  throw new Error('El modo Individual no usa sesión de kernel: vive en core/soloPlayer.js');
    default: throw new Error(`Formato de sesión desconocido: ${format}`);
  }
}
