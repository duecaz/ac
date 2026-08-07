// Backend-aware identity. Supabase fue retirado, así que no hay SDK ni login
// anónimo remoto: en cualquier backend usamos el anon id persistido
// (localStorage), de modo que SOLO/ASYNC/LIVE funcionan también offline.
import { getAnonId } from './state.js';
import { lsGet, lsSet } from './ls.js';
import { isAcceptableNickname } from './nicknameFilter.js';

export async function ensureIdentity() {
  try { return { id: getAnonId() }; } catch { return { id: 'local-anon' }; }
}

// EL APODO DEL ALUMNO — dueño único (§21 aplicada al almacén, `ls-dueno`).
// Vivía declarado DOS veces, en `views/studentLive.js` y en `views/studentTask.js`
// (cada una con su `const NICK_KEY`), y una de ellas escribía además con
// `localStorage` crudo saltándose el aviso de cuota. El apodo es transversal a
// Live y a Tarea: no pertenece a ninguna pantalla, pertenece a la identidad
// local del alumno — que es justo lo que este módulo ya representaba.
// R7: es lo MÍNIMO que el aula necesita (un nombre que el profe reconozca) y no
// sale de este dispositivo salvo cuando el alumno entrega.
const NICK_KEY = 'ww.nick';

/** El apodo guardado, o '' si no hay o ya no pasa el filtro. */
export function getNick() {
  const n = lsGet(NICK_KEY) || '';
  return isAcceptableNickname(n).ok ? n : '';
}

/** Guarda el apodo YA saneado (el filtro lo aplica quien lo pide, que es quien
 *  puede explicarle al alumno por qué no vale). Devuelve false si no se pudo. */
export function setNick(value) {
  return lsSet(NICK_KEY, String(value ?? ''));
}
