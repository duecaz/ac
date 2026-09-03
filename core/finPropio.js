// EL FINAL DE LA PARTIDA ES DEL SHELL — y quien no lo quiera, lo DECLARA aquí.
//
// Medido el 2026-09-04 montando las 13: once terminaban con la pantalla estándar
// (`core/resultScreen.js`: puntaje, techo, «otra vez»), el Crucigrama con un
// cartel propio que al cerrarse dejaba al alumno en el tablero sin puntaje ni
// salida, y Abre Cajas se la saltaba con un `skipResultScreen: true` suelto,
// sin decir por qué. Un mayoritario, un propio y una mezcla: la MISMA forma
// que tuvo la cabecera (tres tratamientos de una franja) y que costó dos
// capturas del dueño descubrir. Esta vez la divergencia se declara antes de
// que la clase la encuentre.
//
// LA REGLA (§21b, un dueño): el shell (`core/soloPlayer.js`) pinta el final;
// una plantilla puede AÑADIR encima (celebración, `after`, título e icono que
// digan la verdad de cómo acabó) pero no SUSTITUIR la pantalla. La única
// salida es una entrada en este mapa con su motivo escrito — y escribirlo es
// cuando se ve si de verdad lo es. Un `skipResultScreen` sin entrada aquí NO
// se obedece: el shell pinta la estándar igual (fail-safe, como un modo
// desconocido en `persistPolicy` no guarda).
//
// Lo lee el shell en tiempo de ejecución y lo lee `tools/costuras-divergencia.mjs`
// en CI: la misma lista para los dos, o acabaría diciendo dos cosas.

/** @type {Record<string, string>} nombre de plantilla → motivo */
export const FIN_PROPIO = {
  'question-live':
    'Abre Cajas no tiene acierto ni fallo: el «puntaje» sería «6 de 6 cajas '
    + 'abiertas», que es un avance, no un resultado. Se proyecta y la pregunta '
    + 'la hace el docente en voz alta; su cierre dice que se acabaron las cajas.',
};

/** ¿Puede esta plantilla saltarse la pantalla estándar de fin? Solo si lo
 *  declaró con motivo. */
export const finPropio = (template) => Boolean(FIN_PROPIO[template]);
