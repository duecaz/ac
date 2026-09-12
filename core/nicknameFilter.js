// Conservative nickname filter (ES + EN). Strips accents, checks length 2-40,
// rejects empty after strip, rejects basic slurs/insults substring match.
const BLOCK = [
  'puta','puto','mierda','cabron','cabrón','gilipollas','imbecil','imbécil','idiota','tonto','tonta','marica','maricon','maricón',
  'fuck','shit','bitch','asshole','dick','cunt','nigger','nigga','retard','slut','whore','bastard','faggot'
];

/**
 * @typedef {{ok: false, reason: string}|{ok: true, value: string}} NicknameVerdict
 */

/**
 * @param {unknown} raw
 * @returns {NicknameVerdict}
 */
export function isAcceptableNickname(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'inválido' };
  const trimmed = raw.trim();
  if (trimmed.length < 2) return { ok: false, reason: 'muy corto' };
  if (trimmed.length > 40) return { ok: false, reason: 'muy largo' };
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(trimmed)) return { ok: false, reason: 'caracteres no válidos' };
  const norm = trimmed.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  for (const w of BLOCK) if (norm.includes(w)) return { ok: false, reason: 'apodo no permitido' };
  return { ok: true, value: trimmed };
}

/**
 * EL APODO CON EL QUE SE ENTRA A JUGAR — dueño único de las DOS decisiones que
 * la sala en vivo y Equipos tomaban cada una por su cuenta (y que ya habían
 * costado sendos arreglos gemelos):
 *
 *  1. El interruptor del panel MANDA. Estaba escrito por el editor («Filtro de
 *     apodos») y no lo leía nadie: se rechazaba siempre, así que apagarlo no
 *     hacía nada. Ojo: lo que el interruptor decide es si se RECHAZA, no si se
 *     NORMALIZA — saltárselo dejaba entrar nombres sin recortar.
 *  2. Con el filtro APAGADO entra un apodo que el filtro rechaza, y entonces no
 *     hay `f.value` (el veredicto solo lo trae cuando acepta): se normaliza aquí
 *     igual —recortado— en vez de devolver `undefined`, que reventaba al
 *     de-duplicar apodos (`.toLowerCase()` de nada) y dejaba miembros sin nombre.
 *
 * @param {{live?: {nicknameFilter?: boolean}}|null|undefined} activity
 * @param {unknown} nickname
 * @returns {string}
 * @throws {Error} `Apodo: <motivo>` si el filtro está encendido y lo rechaza.
 */
export function apodoLimpio(activity, nickname) {
  const f = isAcceptableNickname(nickname);
  if (!f.ok && activity?.live?.nicknameFilter !== false) throw new Error('Apodo: ' + f.reason);
  return f.ok ? f.value : String(nickname ?? '').trim();
}
