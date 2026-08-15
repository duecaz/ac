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

// LA MAQUETA, MEDIDA. «Todavía tiene scroll, ¿o aún no se actualizó?» (dueño,
// 2026-08-15): con un reporte que solo lleva versión y ruta, esa pregunta no
// tiene respuesta — y la alternativa era pedirle que pegara código en la consola
// del navegador (que Chrome bloquea hasta escribir «allow pasting»: tres pasos
// para el que ya está haciendo el favor de probar).
// Estos cinco números contestan solos las dos preguntas que más han costado esta
// semana: ¿sobra pantalla?, ¿el marco descuenta la barra?, ¿el ejercicio llena
// el marco? Son medidas de LAYOUT, no del aparato: ni marca, ni modelo, ni
// userAgent (R7 intacto).
export function medidasPantalla(doc = (typeof document !== 'undefined' ? document : null),
                                win = (typeof window !== 'undefined' ? window : null)) {
  if (!doc || !win) return null;
  const alto = (sel) => {
    const el = doc.querySelector(sel);
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  };
  const marco = alto('#ww-frame');
  const ronda = alto('#s-round') ?? alto('.tc-round') ?? alto('#ww-player-widget');
  const varH = doc.documentElement && win.getComputedStyle
    ? win.getComputedStyle(doc.documentElement).getPropertyValue('--ww-topbar-h').trim() : '';
  return {
    ventana: `${win.innerWidth}x${win.innerHeight}`,
    sobra: (doc.documentElement?.scrollHeight || 0) - (win.innerHeight || 0),
    barra: alto('.ww-topbar'),
    barraVar: varH || '(sin dato)',
    marco, ronda,
  };
}

export function buildBugReport({
  version = VERSION,
  medidas = medidasPantalla(),
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
    medidas ? `maqueta: ventana ${medidas.ventana} · scroll sobrante ${medidas.sobra}px`
      + ` · barra ${medidas.barra ?? '—'}px (descontada ${medidas.barraVar})`
      + ` · marco ${medidas.marco ?? '—'}px · ejercicio ${medidas.ronda ?? '—'}px` : null,
    ult ? `últimos errores:\n${ult}` : 'últimos errores: (ninguno registrado)',
    '¿qué estabas haciendo cuando pasó? → ',
  ].join('\n');
}
