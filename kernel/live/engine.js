// LIVE room — now a thin alias over the unified SESSION engine (format 'live').
// The estilo concurso flow, the anti-cheat scoring at settle() and the exact state
// shape all live in kernel/session/liveMachine.js, the single brain shared by
// live / teams / vs and mirrored by the Supabase Edge Functions (retiradas).
// Kept as a named export so the local driver and existing tests stay unchanged.
import { createSession, FORMATS } from '../session/engine.js';

/**
 * @typedef {import('../contracts/activity.js').Activity} Activity
 * @typedef {import('../contracts/session.js').LiveEngine} LiveEngine
 * @typedef {import('../session/liveMachine.js').LiveOpts} LiveOpts
 * @typedef {import('../session/engine.js').SessionOpts} SessionOpts
 */

/**
 * LA PUERTA DE LA SALA EN VIVO, TIPADA: entra `LiveOpts` (blob de la fila +
 * código) y sale el motor de live, no la unión de las tres máquinas. Las DOS
 * conversiones viven aquí, una vez y con su motivo, en vez de repetirse en cada
 * adaptador (antes: `paraHidratar` en la frontera y cinco casts a `LiveEngine`):
 *  - `SessionOpts` es la INTERSECCIÓN de las opciones de las tres máquinas, así
 *    que un estado de sala en vivo no encaja aunque sea el único que el
 *    despachador va a leer con `format: 'live'`.
 *  - `createSession` devuelve la máquina que toque; el `format` de aquí decide
 *    cuál, y es esta función la única que lo sabe.
 * @param {Activity} activity
 * @param {LiveOpts} [opts]
 * @returns {LiveEngine}
 */
export function createLiveRoom(activity, opts = {}) {
  const conFormato = /** @type {SessionOpts} */ ({ ...opts, format: FORMATS.LIVE });
  return /** @type {LiveEngine} */ (createSession(activity, conFormato));
}
