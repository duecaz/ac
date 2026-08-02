// LOS TRAMOS DEL VIAJE DEL PROFESOR — el mapa de PRIORIDAD, no de estructura.
//
// `docs/arquitectura-modulos.md` medía tamaño y fan-in: métricas NEUTRAS. Con el
// norte escrito (`docs/norte.md`) sabemos que no todos los tramos valen igual —
// el profe SIEMPRE pasa por "buscar/crear", juega casi siempre en la pizarra
// (solo · VS · equipos) y solo en algunos colegios usa "en vivo" con los móviles
// de los alumnos. Este mapeo permite preguntarle al repo dónde está el código y
// dónde están los tests POR TRAMO, y ver si el esfuerzo cae donde el profe pasa.
//
// La primera medición (v1.51.365) dio esto: "en vivo" 0,74 líneas de test por
// línea de código; "buscar/crear", 0,09. Ocho veces menos cubierto el tramo por
// el que pasan TODAS las clases.
//
// El mapeo es DECLARADO a mano y por orden (el primero que casa, gana): un
// módulo mal clasificado falsea la foto, así que se prefiere explícito y
// revisable a listo y adivinado.

export const TRACKS = [
  ['buscar/crear', /^views\/(home|explore|landing|author|editor)|^core\/(homePreview|activityThumb|likes|search)\.js/],
  ['jugar en pizarra', /^views\/(playerView|startScreen|vsView|teamsView|memoryView|listView)|^core\/(soloPlayer|soloTimer|teams|vsAnimations|modes)/],
  ['jugar en vivo', /live|Live|^kernel\/session|^views\/session/],
  ['informes/tareas', /reports|sessionTable|sessionModel|itemStats|assignment|attempt/i],
  ['plantillas (mecánicas)', /^templates\//],
];

/** Tramo de un módulo. `infra/común` es el cajón honesto: utilidades que sirven
 *  a todos los tramos (html, eventos, almacenamiento, skins…). */
export function trackOf(file) {
  const f = String(file).split('\\').join('/');
  for (const [name, re] of TRACKS) if (re.test(f)) return name;
  return 'infra/común';
}

/** Tramo de una SUITE de tests, por su nombre. Mismo criterio: explícito. */
export const TEST_TRACKS = [
  ['jugar en vivo', /live|race|session|unscorable|deadline|clock/i],
  ['buscar/crear', /home|activityCard|explore|author|editor|likes|storage|search/i],
  ['informes/tareas', /report|assignment|itemStat|sessionTable|attempt|idempot/i],
  ['plantillas (mecánicas)', /template|content|qaAdapt|scoring|textMarks|wheel|ballsort|diagram|crossword|quizAnswer|memory/i],
  ['jugar en pizarra', /solo|mode|team|render|presentation|fullscreen|styles|skins/i],
];

export function testTrackOf(suite) {
  for (const [name, re] of TEST_TRACKS) if (re.test(String(suite))) return name;
  return 'infra/común';
}

export const TRACK_ORDER = ['buscar/crear', 'jugar en pizarra', 'jugar en vivo',
  'informes/tareas', 'plantillas (mecánicas)', 'infra/común'];

/** Cuánto pesa cada tramo en la ESCENA real (docs/norte.md §1). No es una
 *  métrica: es la decisión de producto, escrita, para poder contrastarla con el
 *  esfuerzo. `siempre` = por ahí pasa toda clase. */
export const TRACK_USE = {
  'buscar/crear': '**siempre** — toda clase empieza aquí',
  'jugar en pizarra': '**lo habitual** — solo · VS · equipos, sin móviles',
  'jugar en vivo': 'algunos colegios (alumnos con su propio móvil)',
  'informes/tareas': 'después de clase',
  'plantillas (mecánicas)': 'siempre (es el contenido jugado)',
  'infra/común': 'todo lo anterior',
};
