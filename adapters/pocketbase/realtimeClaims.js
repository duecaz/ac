// §22-4 — CREDENCIAL DEL DISPOSITIVO (colección `live_claims`).
//
// Al entrar, el alumno se queda con un secreto que registra en `live_claims`
// (colección cerrada) y que manda en una CABECERA con cada escritura suya. Sin
// esto bastaba con VER el `playerId` de un compañero —la lista de jugadores es
// pública, y el host la necesita— para responder en su nombre.
//   · En memoria + localStorage: el Map cubre los tests y la sesión en curso; el
//     almacenamiento, el F5 a mitad de partida.
//   · La cabecera NO se guarda en la fila → el secreto no queda legible en
//     `live_answers`, que sí es pública.
import { rid } from '../../core/ids.js';
import { lsGet, lsSet } from '../../core/ls.js';

/**
 * Fábrica de la sección de claims. `deps`:
 *   - pbFetch: cliente HTTP con reintentos (compartido, del ensamblador).
 *   - CLM: nombre de la colección `live_claims`.
 */
export function createClaimsSection({ pbFetch, CLM }) {
  const claimKey = (sessionId) => `ww.claim.${sessionId}`;
  const claims = new Map();
  function claimSecret(sessionId) {
    if (claims.has(sessionId)) return claims.get(sessionId);
    const stored = lsGet(claimKey(sessionId));
    if (stored) claims.set(sessionId, stored);
    return stored || null;
  }
  /** Cabecera de credencial para las escrituras del ALUMNO. Vacía en el host (va
   *  firmado con su token y la regla lo deja pasar por la otra rama). */
  function claimHeaders(sessionId) {
    const secret = claimSecret(sessionId);
    return secret ? { 'X-WW-Claim': secret } : undefined;
  }
  /** Registra la credencial de ESTE dispositivo para el jugador recién creado. */
  async function registerClaim(sessionId, playerId) {
    const secret = rid('cl_');
    try {
      await pbFetch(`/api/collections/${CLM}/records`, {
        method: 'POST', body: JSON.stringify({ session: sessionId, player: playerId, secret }),
      });
    } catch (e) {
      // 404 = servidor sin la colección (aún no se han creado): se sigue sin
      // credencial, que es exactamente el comportamiento anterior. 400 = ese
      // jugador ya está reclamado (índice único) → no se puede pisar.
      if (e?.status !== 404 && e?.status !== 400) throw e;
      if (e?.status === 400) return null;
    }
    claims.set(sessionId, secret);
    lsSet(claimKey(sessionId), secret);
    return secret;
  }

  return { claimSecret, claimHeaders, registerClaim };
}
