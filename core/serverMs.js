// TIEMPO DE RESPUESTA MEDIDO POR EL SERVIDOR (ley de confianza §22).
//
// El bonus de velocidad (`awardPoints` estilo Kahoot) se calculaba con el `ms`
// que MANDA EL MÓVIL. Eso es una afirmación del cliente decidiendo puntos: basta
// enviar `ms:0` (o atrasar el reloj del teléfono) para cobrar el bonus máximo en
// cada pregunta, sin DevTools, y el marcador lo sumaba tal cual.
//
// Aquí se DERIVA el tiempo de dos marcas que el alumno no escribe:
//   · `openedAt` — instante SERVIDOR en que el host abrió el ítem (lo captura el
//     adaptador del `updated` que devuelve el PATCH de la sala; el blob es
//     host-only, así que el alumno no puede moverlo).
//   · la marca de la propia fila — `created` en fase pregunta (primera y única
//     respuesta) y `updated` en CARRERA, donde la fila se reintenta y lo que
//     cuenta es el instante del acierto. Las dos son `autodate` de PocketBase:
//     las pone el servidor, no viajan en el cuerpo de la petición.
//
// Las dos marcas salen del MISMO reloj (el del servidor), así que la resta no
// arrastra desfase entre dispositivos — eso es lo que hacía inviable comparar el
// reloj del host con el del alumno.
//
// FALLBACK HONESTO: si falta alguna marca (driver `local` sin autodate, sala
// creada antes de esta versión, o el host recargó y perdió el sello del ítem en
// vuelo) se usa el `ms` afirmado por el cliente. Se devuelve `source` para que
// eso sea VISIBLE en el diagnóstico en vez de un silencio.
//
// Módulo PURO (sin fetch ni reloj propio): todo entra por parámetro.

const parse = (v) => {
  if (!v) return NaN;
  // PocketBase serializa "2026-07-30 05:50:42.123Z" (espacio, no T).
  const t = Date.parse(typeof v === 'string' ? v.replace(' ', 'T') : v);
  return Number.isFinite(t) ? t : NaN;
};

/**
 * Tiempo de respuesta a usar para PUNTUAR.
 * @param {object} o
 * @param {string} o.createdAt  autodate `created` de la fila (fase pregunta)
 * @param {string} o.updatedAt  autodate `updated` de la fila (fase carrera)
 * @param {string} o.openedAt   instante servidor en que el host abrió el ítem
 * @param {number} o.claimedMs  el `ms` que afirmó el cliente (solo fallback)
 * @param {string} o.phase      'race' usa `updated`; cualquier otra, `created`
 * @returns {{ms:number, source:'server'|'claimed'}}
 */
export function deriveAnswerMs({ createdAt, updatedAt, openedAt, claimedMs = 0, phase } = {}) {
  const opened = parse(openedAt);
  // En carrera la fila se reintenta: el instante que cuenta es el del acierto
  // (último write del alumno), no el del primer intento.
  const stamp = parse(phase === 'race' ? (updatedAt || createdAt) : createdAt);
  if (Number.isFinite(opened) && Number.isFinite(stamp)) {
    // Nunca negativo: un reloj de servidor no va atrás, pero una sala reabierta
    // o un sello más nuevo que la fila daría un ms absurdo que regalaría bonus.
    return { ms: Math.max(0, stamp - opened), source: 'server' };
  }
  return { ms: Math.max(0, Number(claimedMs) || 0), source: 'claimed' };
}

/** Clave del sello de apertura dentro del blob: en carrera todos los ítems se
 *  abren a la vez (un solo sello); en fase pregunta, uno por ítem. */
export function openedKey(phase, itemIndex) {
  return phase === 'race' ? 'race' : String(itemIndex);
}

/** Sello de apertura para un ítem, con respaldo al de carrera. `map` es
 *  `state.itemOpenedAt` (host-only). */
export function openedAtFor(map, itemIndex, phase) {
  if (!map) return null;
  return map[openedKey(phase, itemIndex)] ?? map[String(itemIndex)] ?? map.race ?? null;
}
