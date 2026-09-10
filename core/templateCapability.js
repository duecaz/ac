// Predicado COMPARTIDO: "¿esta plantilla puede autopuntuar una ronda?" — hace
// falta scoreSubmission (puntuar) Y renderRound (pintar el ítem sin backend).
//
// Antes vivía triplicado con criterios DISTINTOS: core/modes.js exigía solo
// renderRound, el motor de sesión (createTeamsSession, hoy en
// kernel/session/teamsMachine.js) exigía solo scoreSubmission, y
// views/teamsView.js exigía scoreSubmission+getRoundPayload
// (no renderRound). Con eso, una plantilla como Crucigrama/Ruleta/Abre-Cajas
// (scoreSubmission+getRoundPayload, SIN renderRound) pasaba el check de
// teamsView pero luego `roundBody()` no podía pintar la ronda (exige
// renderRound) → el botón "Revelar" se quedaba deshabilitado para siempre.
// Hoy no es alcanzable (core/modes.js ya oculta "Equipos" para esas plantillas
// antes de llegar a teamsView), pero los tres sitios deben usar el MISMO
// criterio para no volver a desalinearse si el gateo de arriba cambia.
//
// Módulo sin imports (ni de core/ ni de kernel/) a propósito: core/modes.js
// importa kernel/session/engine.js, así que si este predicado viviera en
// cualquiera de los dos, el otro no podría importarlo sin crear un ciclo.
export function canAutoScoreRound(T) {
  return typeof T?.scoreSubmission === 'function' && typeof T?.renderRound === 'function';
}

/** ¿La plantilla PROYECTA su propia pantalla de host en vivo?
 *
 *  No se pregunta con `typeof`: la clase base trae una `renderRoundHost` por
 *  defecto, así que TODA plantilla la tiene y la pregunta siempre daría «sí».
 *  Lo que importa es si la ha ESCRITO —si la sobreescribe—, que es lo que
 *  distingue «proyecta lo suyo» de «hereda el enunciado genérico». Se mira como
 *  propiedad PROPIA porque `core/` no puede importar de `templates/` (§0). */
function proyectaRondaPropia(T) {   // interna: solo la usa faltaParaLive (§30)
  return !!T && Object.getOwnPropertyNames(T).includes('renderRoundHost');
}

/** QUÉ LE FALTA a una plantilla que declara `modes.live`, como lista de frases.
 *  Vacía = cumple.
 *
 *  DUEÑO ÚNICO de este requisito condicional (§21b). Estaba escrito DOS veces y
 *  con semántica distinta: `core/registry.js` exigía `getRoundPayload` Y
 *  `scoreSubmission` sin excepción y LANZABA al registrar, mientras
 *  `core/templateContract.js` aceptaba como alternativa que la plantilla
 *  proyectara su propia pantalla de host. Es decir: había una plantilla posible
 *  que pasaba el contrato en CI y reventaba al arrancar. Ahora los dos preguntan
 *  aquí, cada uno con su reacción (el registro lanza, el checker acumula). */
export function faltaParaLive(T) {
  const falta = [];
  if (typeof T?.getRoundPayload !== 'function') falta.push('getRoundPayload');
  if (typeof T?.scoreSubmission !== 'function' && !proyectaRondaPropia(T)) {
    falta.push('scoreSubmission (o una renderRoundHost propia: ni auto-puntúa ni proyecta)');
  }
  return falta;
}
