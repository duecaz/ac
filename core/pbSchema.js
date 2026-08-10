// QUÉ CAMPOS LE FALTAN A UNA COLECCIÓN QUE YA EXISTE (reparación append-only).
//
// Vivía suelto dentro del botón «Crear colecciones» de `views/adminView.js`, y
// por eso su único test posible era CITAR la línea. Aquí es una función pura
// que se puede ejecutar: el test comprueba NÚMEROS y nombres, no redacción
// (tests/helpers/fuente.mjs explica por qué eso importa).
//
// La regla que encierra, y que costó un fallo real:
//   · `created`/`updated` en PocketBase <0.23 son campos de SISTEMA — declararlos
//     revienta la actualización de la colección.
//   · En ≥0.23 son campos normales `autodate`. Una colección creada ANTES de que
//     los declaráramos se quedaba SIN ELLOS para siempre, porque la reparación
//     los excluía igual que en <0.23. Eso dejó a `live_sessions` de la Pi sin
//     `updated`, y sin ese dato el sello de apertura (§22-1) NI SE INTENTABA:
//     el tiempo de la carrera caía al que afirma el móvil, en silencio absoluto.
//     Lo cazó el botón «Probar carrera» del panel.

/**
 * @param {object} o
 * @param {Array<{name:string}>} o.actuales  campos que HOY tiene la colección
 * @param {Array<{name:string}>} o.deseados  campos que el DEFS declara
 * @param {boolean} o.isV23  ¿PocketBase ≥0.23? (allí created/updated son campos)
 * @returns {Array<object>} los que faltan, en el orden del DEFS (nunca `id`)
 */
export function camposQueFaltan({ actuales = [], deseados = [], isV23 = false } = {}) {
  const hay = new Set((actuales || []).map(f => f?.name));
  const nuncaTocar = isV23 ? ['id'] : ['id', 'created', 'updated'];
  return (deseados || []).filter(f => f?.name && !hay.has(f.name) && !nuncaTocar.includes(f.name));
}
