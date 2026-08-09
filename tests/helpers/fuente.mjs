// CITAS DE FUENTE — comprobar el CÓDIGO ESCRITO, no lo que hace.
//
// Hay invariantes que solo se pueden vigilar leyendo el código: «abrir pregunta
// es UNA función», «esta vista no reimplementa el conteo», «el alumno lee el
// instante de la sala y no lo calcula». No hay forma de ejecutarlas: son
// afirmaciones sobre la ESTRUCTURA.
//
// El problema es que se disfrazan de test de comportamiento. Al mover el reloj a
// `serverNow()` —un refactor legítimo y correcto— una suite falló porque exigía
// la cadena literal `lastQuestionShownAt = openAtMs || clock.now()`. No había
// ningún fallo: había una cita desactualizada. Y al revés es peor: la cita sigue
// verde mientras el comportamiento se rompe por otro camino.
//
// Esta ayuda no las elimina —algunas hacen falta—: las MARCA. Cada cita dice en
// su salida que es una cita, y cuando falla explica las dos posibilidades en vez
// de gritar "roto". Además se CUENTAN (`tests/citasFuente.test.mjs`): el número
// solo puede bajar.
//
// Regla de uso: si puedes comprobarlo EJECUTANDO, hazlo y no cites la fuente.

let usadas = 0;

/**
 * @param {string} src     el contenido del fichero ya leído
 * @param {RegExp} patron  lo que tiene que aparecer
 * @param {string} invariante  QUÉ se está protegiendo (no "existe la línea X")
 * @param {string} [archivo]   para el mensaje de error
 */
export function citaDeFuente(src, patron, invariante, archivo = 'el fichero') {
  usadas++;
  if (patron.test(src)) return true;
  throw new Error(
    `CITA DE FUENTE rota en ${archivo}: ${invariante}\n` +
    `   patrón: ${patron}\n` +
    `   Dos posibilidades, y hay que decidir cuál:\n` +
    `   (a) el invariante se ROMPIÓ de verdad → arregla el código;\n` +
    `   (b) el código se refactorizó BIEN y la cita se quedó vieja → actualiza el patrón.\n` +
    `   Si te pasa (b) a menudo con esta cita, conviértela en un test de comportamiento.`
  );
}

export function citasUsadas() { return usadas; }
