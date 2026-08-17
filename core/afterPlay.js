// A DÓNDE TE LLEVA TERMINAR UNA ACTIVIDAD — política declarada en UN sitio.
//
// Hallazgo del dueño (2026-08-17): «al terminar una actividad debe estar
// estandarizado a dónde llevarme; ahora me lleva a las actividades de usuario
// aunque no estoy logueado». Tenía razón y era un cableado: la pantalla de fin
// (`core/resultScreen.js`) llevaba escrito `#/home`, que redirige a `#/mine`
// («Mis actividades»). A quien juega sin cuenta esa pantalla no le pertenece:
// sale vacía o con las de otro. Y en la app del ALUMNO esa ruta ni existe —
// por eso `views/studentTask.js` ya se había hecho su propia pantalla de fin
// para no acabar en «ruta no encontrada». Dos parches del mismo agujero.
//
// LA REGLA es la misma que ya usa la ENTRADA (§7c, main.teacher.js `#/`): con
// sesión, a lo tuyo; sin sesión, a donde hay algo que hacer. Terminar de jugar
// es como entrar: la pregunta «¿de quién es esta pantalla?» tiene UNA respuesta
// en toda la app, no una por sitio.
//
// Y NO ES SOLO EL DESTINO: lo que de verdad quiere quien acaba de jugar es
// VOLVER A JUGAR (es lo que hace Wordwall, que te deja en la actividad con
// «Start again» en vez de mandarte a un panel). Por eso la política declara
// también si esta pantalla puede ofrecer «Jugar otra vez» — en Tarea NO, que
// tiene tope de intentos (§22-3) y un botón de repetir sería una trampa con
// forma de botón.
import { getAuthUserId } from './auth.js';

// modo → { conSesion, sinSesion, repetir }
// Los modos son los mismos de `core/persistPolicy.js` (el cuadro de qué guarda
// cada uno): si aparece un modo nuevo, se declara en los dos.
export const TRAS_JUGAR = {
  // Individual en la app del profe: es SU material o el escaparate público.
  solo: {
    conSesion: { href: '#/mine',    label: 'Mis actividades', icon: 'bi-house' },
    sinSesion: { href: '#/explore', label: 'Ver más actividades', icon: 'bi-collection' },
    repetir: true,
  },
  // Tarea (app del alumno): su única puerta es la de entrar con PIN. Y NO se
  // repite desde aquí: los intentos los cuenta el servidor.
  'async-tracked': {
    conSesion: { href: '#/join', label: 'Volver', icon: 'bi-arrow-left' },
    sinSesion: { href: '#/join', label: 'Volver', icon: 'bi-arrow-left' },
    repetir: false,
  },
  // VS y Equipos: pizarra compartida en la clase del profe. Su resumen lo pinta
  // el propio modo (`core/duelSummary.js`), pero el destino es el mismo cuadro.
  vs:    { conSesion: { href: '#/mine', label: 'Mis actividades', icon: 'bi-house' },
           sinSesion: { href: '#/explore', label: 'Ver más actividades', icon: 'bi-collection' },
           repetir: true },
  teams: { conSesion: { href: '#/mine', label: 'Mis actividades', icon: 'bi-house' },
           sinSesion: { href: '#/explore', label: 'Ver más actividades', icon: 'bi-collection' },
           repetir: true },
  // Live (docente): el informe de la sala. Dirigir en vivo EXIGE sesión (§22),
  // así que la rama sin sesión no debería ocurrir — y por eso va a la entrada,
  // que decide, en vez de a una pantalla que estaría vacía.
  'live-host': {
    conSesion: { href: '#/mine', label: 'Mis actividades', icon: 'bi-house' },
    sinSesion: { href: '#/',     label: 'Inicio',          icon: 'bi-house' },
    repetir: false,
  },
  // Live (alumno): no pinta pantalla de fin — el podio lo manda el host.
  'live-student': {
    conSesion: { href: '#/join', label: 'Volver', icon: 'bi-arrow-left' },
    sinSesion: { href: '#/join', label: 'Volver', icon: 'bi-arrow-left' },
    repetir: false,
  },
};

// Fail-safe: un modo que nadie declaró va a la ENTRADA, que ya sabe decidir
// (con sesión → Mis actividades; sin sesión → portada). Nunca a una pantalla
// que pueda no ser tuya.
export const DESTINO_DESCONOCIDO = { href: '#/', label: 'Inicio', icon: 'bi-house' };

/**
 * A dónde lleva el botón de salir de la pantalla de fin.
 * `haySesion` se inyecta para poder probar los dos casos sin tocar el almacén;
 * por defecto lo pregunta a `core/auth.js` (síncrono: lee el token guardado).
 */
export function destinoTrasJugar(mode, haySesion = !!getAuthUserId()) {
  const def = TRAS_JUGAR[mode || 'solo'];
  if (!def) return DESTINO_DESCONOCIDO;
  return haySesion ? def.conSesion : def.sinSesion;
}

/** ¿Esta pantalla de fin puede ofrecer «Jugar otra vez»? */
export function puedeRepetir(mode) {
  return TRAS_JUGAR[mode || 'solo']?.repetir === true;
}
