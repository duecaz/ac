// REPORTE DE UN TOQUE — para el compañero que testea en dispositivo real.
//
// Sus hallazgos son la mejor red del proyecto, pero llegaban como "me salió un
// mensaje que no pude leer": sin versión, sin pantalla, sin el error de debajo.
// Tocar el chip de versión del navbar copia al portapapeles un reporte pegable
// (versión · pantalla · últimos errores del anillo local) y el hallazgo se
// vuelve reproducible al primer intento.
//
// R7 (norte): son MENORES y el dato es MÍNIMO — el reporte NO lleva nombre de
// alumno, ni marca/modelo del aparato (nada de userAgent), ni identificadores.
// Solo lo que ya es de la app: su versión, su ruta y sus propios errores.
// Puro e inyectable → testeable sin navegador (tests/bugReport.test.mjs).
import { VERSION } from './constants.js';
import { estadoSonido } from './sounds.js';
import { isEffectsMuted } from './effects.js';
import { recentErrors } from './errorLog.js';

export function buildBugReport({
  version = VERSION,
  // Estado de sonido y efectos: «no se escucha» y «no sale la animación» son
  // los dos reportes que más veces han llegado sin datos suficientes. Se
  // inyectan para poder probarlo sin navegador.
  son = estadoSonido(),
  fxApagados = isEffectsMuted(),
  href = (typeof location !== 'undefined' ? location.href : ''),
  errors = recentErrors(),
  now = new Date(),
} = {}) {
  const ult = (errors || []).slice(-5)
    .map(e => `  - [${e?.at || '?'}] ${String(e?.message || '').slice(0, 200)}${e?.page ? ` (${e.page})` : ''}`)
    .join('\n');
  return [
    `REPORTE AulaReto v${version}`,
    `fecha: ${now.toISOString()}`,
    `pantalla: ${href}`,
    `sonido: ${son.silenciado ? 'SILENCIADO' : 'activo'} · cargados: ${son.sonidosCargados}`
      + (son.ultimoFallo ? ` · último fallo → ${son.ultimoFallo}` : ' · sin fallos'),
    `efectos: ${fxApagados ? 'APAGADOS' : 'activos'}`,
    ult ? `últimos errores:\n${ult}` : 'últimos errores: (ninguno registrado)',
    '¿qué estabas haciendo cuando pasó? → ',
  ].join('\n');
}
