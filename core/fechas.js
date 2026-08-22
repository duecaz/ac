// LA HORA QUE SE MUESTRA ES LA DEL QUE MIRA (dueño, 2026-08-21, con captura).
//
// PocketBase sella en UTC y con un formato propio: `2026-08-21 23:50:12.345Z`
// (espacio en vez de la «T»). Las vistas lo pintaban CORTÁNDOLO —
// `created.slice(0, 16)`— porque así ya parece una fecha… pero es la hora de
// Greenwich: el profe entregó su hoja a las 18:50 de Lima y el panel decía
// 23:50. Y con `slice(0, 10)` el error salta de hora a DÍA: cualquier cosa
// hecha después de las 19:00 en Lima aparece fechada al día siguiente.
//
// Cortar una cadena no es formatear una fecha. Aquí vive el único conversor:
// interpreta el sello (aunque venga con espacio), y lo pinta en la zona del
// navegador que lo lee.
//
// `timeZone` existe para poder PROBARLO sin depender de la zona de la máquina
// donde corra CI; en la app nunca se pasa, que es lo que hace que cada uno vea
// su hora.

/** Convierte el sello de PB (o cualquier ISO) en Date; null si no se entiende. */
function aFecha(sello) {
  if (!sello) return null;
  if (sello instanceof Date) return isNaN(sello) ? null : sello;
  // El espacio de PB no es ISO válido en todos los navegadores: se normaliza.
  const d = new Date(String(sello).trim().replace(' ', 'T'));
  return isNaN(d) ? null : d;
}

const partes = (d, timeZone, extra) => new Intl.DateTimeFormat('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric', ...(timeZone ? { timeZone } : {}), ...extra,
}).format(d);

/** `21/08/2026 18:50` en la zona de quien mira. Vacío si el sello no vale. */
export function fechaHora(sello, { timeZone } = {}) {
  const d = aFecha(sello);
  if (!d) return '';
  return partes(d, timeZone, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** `21/08/2026` en la zona de quien mira. Vacío si el sello no vale. */
export function fechaCorta(sello, { timeZone } = {}) {
  const d = aFecha(sello);
  if (!d) return '';
  return partes(d, timeZone);
}
