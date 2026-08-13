// LEY §25 · CAPACIDAD — los límites del sistema, declarados en UN sitio.
//
// Por qué existe (decisión D6, docs/decisiones-pendientes.md): el servidor es
// UNA Raspberry Pi COMPARTIDA con otros proyectos, y hasta ahora no había
// ningún tope: ni número de actividades por profe, ni tamaño real por actividad
// (había un 200 KB por imagen y un aviso a 1,5 MB, pero el campo de PocketBase
// aceptaba 5 MB), ni política de borrado de las salas en vivo — que crecen para
// siempre aunque la partida durara 20 minutos. Wordwall limita su plan gratuito
// por la misma razón: no es avaricia, es capacidad.
//
// La regla del módulo: **un número, un sitio**. Si un límite aparece escrito en
// una vista, en el esquema o en un script, es una copia y va a divergir. Aquí
// están los cuatro que gobiernan el sistema, y de aquí los leen el editor, el
// panel de administración, el esquema de PocketBase y el script de PowerShell
// (lo vigila tests/quotas.test.mjs).
//
// Módulo PURO: entra un dato, sale un veredicto. Sin DOM, sin fetch.

export const QUOTAS = {
  /** Actividades por profesor. Es un AVISO, no un veredicto: una regla de
   *  PocketBase no sabe contar filas, así que el servidor no puede aplicarlo
   *  (§22 — se dice lo que se puede aplicar, y se dice cuál no). */
  activitiesPerTeacher: 200,

  /** Tamaño máximo de UNA actividad, con sus imágenes inline. Este SÍ lo aplica
   *  el servidor: es el `maxSize` del campo `data` de la colección `activities`.
   *  2 MB = unas diez imágenes al máximo por actividad; con el tope de arriba,
   *  el peor caso de un profe son 400 MB en vez de 1 GB. */
  activityBytes: 2 * 1024 * 1024,

  /** A partir de qué porcentaje se avisa al profe (antes de que rebote). */
  activityWarnRatio: 0.7,

  /** Una imagen suelta DENTRO de un ítem (la foto de una pregunta): se ve
   *  pequeña y acompaña al enunciado. */
  imageBytes: 200 * 1024,

  /** Una imagen que es el LIENZO de la actividad — el fondo, y el dibujo de
   *  «Etiqueta el diagrama». No es lo mismo que la foto de una pregunta: se
   *  mira de cerca y tiene detalle fino (rótulos, líneas, nombres de huesos),
   *  así que con 200 KB / 1280 px salía borrosa justo donde hay que señalar.
   *  El fondo ya usaba este presupuesto por su cuenta; ahora es UNO (§25) y el
   *  diagrama entra en él. Sigue cabiendo de sobra en los 2 MB de la actividad. */
  canvasImageBytes: 800 * 1024,
  canvasImageSide: 1920,

  /** Retención de las salas EN VIVO y todo lo que cuelga de ellas
   *  (live_sessions · live_answers · live_players · live_claims). Pasado esto,
   *  una sala es basura: la partida terminó hace meses y el informe que importa
   *  ya está en `results`. NO se purgan `results` ni `assignment_attempts`: son
   *  el registro del profe sobre sus alumnos, y ese no caduca por nosotros. */
  liveRetentionDays: 120,
};

/** Bytes reales (UTF-8) de una actividad serializada. */
export function activityBytes(a) {
  const s = typeof a === 'string' ? a : JSON.stringify(a ?? null);
  try { return new TextEncoder().encode(s).length; } catch { return s.length; }
}

/**
 * ¿Cabe esta actividad? `level`: 'ok' | 'warn' (se acerca) | 'over' (el
 * servidor la rechazará). `msg` es la frase para el profe — una sola redacción
 * para el editor y el panel.
 */
export function checkActivitySize(a) {
  const bytes = activityBytes(a);
  const limit = QUOTAS.activityBytes;
  const ratio = limit > 0 ? bytes / limit : 0;
  const level = bytes > limit ? 'over' : (ratio >= QUOTAS.activityWarnRatio ? 'warn' : 'ok');
  const mb = (n) => (n / (1024 * 1024)).toFixed(1).replace('.', ',');
  const msg = level === 'over'
    ? `Esta actividad pesa ${mb(bytes)} MB y el máximo es ${mb(limit)} MB: el servidor NO la va a guardar. Quita o reduce imágenes.`
    : level === 'warn'
      ? `Esta actividad pesa ${mb(bytes)} MB de ${mb(limit)} MB. Si sigues añadiendo imágenes dejará de poder guardarse.`
      : '';
  return { level, ok: level !== 'over', bytes, limit, ratio, msg };
}

/** ¿Cuántas actividades le quedan a este profe? Aviso, no veredicto. */
export function checkActivityCount(n) {
  const limit = QUOTAS.activitiesPerTeacher;
  const count = Number(n) || 0;
  const ratio = limit > 0 ? count / limit : 0;
  const level = count >= limit ? 'over' : (ratio >= QUOTAS.activityWarnRatio ? 'warn' : 'ok');
  const msg = level === 'over'
    ? `Tienes ${count} actividades y el límite recomendado es ${limit}. El servidor es compartido: borra o exporta las que ya no uses.`
    : level === 'warn'
      ? `Tienes ${count} de ${limit} actividades.`
      : '';
  return { level, ok: level !== 'over', count, limit, ratio, msg };
}

/**
 * Instante a partir del cual una sala en vivo se considera basura.
 * @param {number} nowMs `clock.now()` — se INYECTA para que sea testeable.
 * @returns {string} ISO
 */
export function liveRetentionCutoff(nowMs, days = QUOTAS.liveRetentionDays) {
  return new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Reparte filas en las que se quedan y las que se purgan, por su `created`.
 * Puro para que la decisión de "qué es viejo" se pueda probar sin servidor —
 * el adaptador solo ejecuta el borrado.
 */
export function partitionByAge(rows, cutoffIso) {
  const keep = [], purge = [];
  for (const r of rows || []) {
    const c = r?.created ?? r?.createdAt ?? null;
    // Sin fecha NO se purga: ante la duda, se conserva el dato del usuario (§24).
    if (c && String(c) < String(cutoffIso)) purge.push(r); else keep.push(r);
  }
  return { keep, purge };
}
