// Conservative nickname filter (ES + EN). Strips accents, checks length 2-40,
// rejects empty after strip, rejects basic slurs/insults substring match.
const BLOCK = [
  'puta','puto','mierda','cabron','cabrón','gilipollas','imbecil','imbécil','idiota','tonto','tonta','marica','maricon','maricón',
  'fuck','shit','bitch','asshole','dick','cunt','nigger','nigga','retard','slut','whore','bastard','faggot'
];

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
