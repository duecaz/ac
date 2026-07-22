// Perfil público del profe (colegio + frase + avatar). Se guarda por-usuario en
// localStorage y se DENORMALIZA dentro del `author` de cada actividad al guardar
// (storage.save) — así la página pública del autor puede mostrarlo sin leer la
// colección `users` (que es privada: solo el propio dueño/admin la ven). El avatar
// se captura del login con Google. Ver docs/handoff-acceso-docente.md (perfil).
import { lsSet } from './ls.js';

const KEY = (uid) => `ww.profile.${uid}`;

export function getProfile(uid) {
  if (!uid) return {};
  try { return JSON.parse(localStorage.getItem(KEY(uid)) || '{}'); } catch { return {}; }
}

export function setProfile(uid, patch) {
  if (!uid) return {};
  const next = { ...getProfile(uid), ...patch };
  lsSet(KEY(uid), JSON.stringify(next));
  return next;
}
