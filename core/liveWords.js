import { lsGet, lsSet, lsDel } from './ls.js';

// Diccionario de palabras de 4 letras (ASCII, mayúsculas) para los códigos de
// sala Live. Los alumnos leen en voz alta "ve a GATO punto lanube punto uno"
// — mucho más fácil que "GH3K9X". Las palabras se reciclan automáticamente en
// cuanto la sesión termina (el profesor la cierra y el registro se borra del
// servidor). El profesor puede cambiar la lista desde Admin → Palabras Live.
//
// Criterios de selección:
//   - Exactamente 4 letras ASCII (sin Ñ, tildes ni dígrafos)
//   - Vocabulario de aula primaria — neutro, sin doble sentido
//   - Evitar letras difíciles de distinguir en voz alta (evitar C/K duplicados)

export const DEFAULT_WORDS = [
  // A
  'AGUA','ALBA','ALMA','ALTO','AMOR','ARCO','ARTE','AULA','AYER','AZUL',
  // B
  'BECA','BESO','BOCA','BOLA','BOTA',
  // C
  'CAFE','CAJA','CAMA','CAPA','CARA','CASA','CAZA','CELO','CERO','CIEN',
  'CIMA','CINE','CLAN','CODO','COLA','COPA','COSA','CUBO',
  // D
  'DAMA','DATO','DEDO','DIOS','DONA','DUNA',
  // E
  'EDAD',
  // F
  'FAMA','FARO','FILA','FINO','FOCA','FORO','FOTO',
  // G
  'GATO','GIRO','GOMA','GOTA',
  // H
  'HADA','HILO','HOJA','HORA','HUMO',
  // I
  'ISLA',
  // K
  'KILO',
  // L
  'LAGO','LANA','LATA','LEAL','LINO','LOBO','LOCO','LOMA','LONA','LORO','LUNA',
  // M
  'MANO','MAPA','MASA','MAYO','MESA','META','MIEL','MIMO','MITO','MODA',
  'MONO','MORA','MOTO','MUSA',
  // N
  'NABO','NANA','NAVE','NIDO','NODO','NOTA','NUBE','NUEZ',
  // O
  'OBRA','OLEO','OLLA','OLMO','OLOR','ONDA',
  // P
  'PALO','PATO','PAVO','PERA','PESO','PILA','PINO','PISO','PLAN',
  'POLO','POZO','PUMA',
  // R
  'RAMO','RANA','RAYA','REAL','REJA','REMO','RIMA','RISA','ROCA','ROPA','ROSA',
  // S
  'SACO','SALA','SANO','SECO','SEDA','SETA','SODA','SOPA',
  // T
  'TACO','TALA','TAPA','TAZA','TELA','TEMA','TINA','TIPO','TIRA',
  'TOCA','TOGA','TONO','TORO','TREN','TRIO','TUBO','TUNA',
  // U
  'URNA','UVAS',
  // V
  'VAGO','VALE','VELA','VENA','VIDA','VINO','VISA','VOTO',
  // Y
  'YEMA',
  // Z
  'ZONA',
];

const LS_KEY = 'ww.live_words';

/** Devuelve la lista activa (personalizada o la por defecto). */
export function getWordList() {
  try {
    const raw = lsGet(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length >= 4) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_WORDS;
}

/** Persiste una lista personalizada (array de strings en mayúsculas). */
export function setWordList(words) {
  lsSet(LS_KEY, JSON.stringify(words));
}

/** Elimina la lista personalizada y vuelve al diccionario por defecto. */
export function resetWordList() {
  lsDel(LS_KEY);
}

/**
 * Elige una palabra que NO esté en `usedSet`. Si todas están en uso (aula con
 * muchas salas simultáneas) se recicla — elige cualquiera. Las palabras se
 * reciclan automáticamente cuando la sesión termina y el registro se borra.
 * @param {Set<string>} [usedSet]
 * @returns {string}
 */
export function pickWord(usedSet = new Set()) {
  const list = getWordList();
  const available = list.filter(w => !usedSet.has(w));
  const pool = available.length > 0 ? available : list;
  return pool[Math.floor(Math.random() * pool.length)];
}
