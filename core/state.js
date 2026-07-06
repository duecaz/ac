// Identidad anonima estable. (El antiguo mapa efimero setState/getState/clearState
// se elimino: nadie lo importaba - auditoria estructural.)

// Stable anonymous user id, persisted in localStorage. Used for player rejoin.
import { lsGet, lsSet } from './ls.js';
const ANON_KEY = 'ww.anonId';
export function getAnonId() {
  let v = lsGet(ANON_KEY);
  if (!v) {
    v = crypto.randomUUID();
    lsSet(ANON_KEY, v);
  }
  return v;
}
