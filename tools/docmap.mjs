// EL MAPA DE LA DOCUMENTACIÓN — una sola lista, dos generadores.
//
// `tools/docgen.mjs` escribe el bloque `<!-- GENERADO:nav -->` de cada MD y
// `tools/module-map.mjs` escribe `docs/arquitectura-modulos.md` entero. Los dos
// necesitan la MISMA tabla "ir a otro documento": si cada uno tuviera la suya,
// divergirían — que es exactamente el problema que resolvió `docgen` con los
// cuadros de los bucles.
//
// La integridad de estos enlaces (fichero existe · ancla existe) la vigila
// `tests/docs.test.mjs`.

/** Ancla de GitHub para un encabezado: minúsculas, fuera todo lo que no sea
 *  letra/número/espacio/guion (emojis, §, ·, puntos…), y espacios a guiones. */
export function anchorOf(heading) {
  return heading.toLowerCase().trim()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .replace(/ /g, '-');
}

/** [etiqueta, fichero dentro de docs/, qué responde]. El orden es el de lectura
 *  recomendada: primero para quién es la app, luego cómo se construye. */
export const DOC_MAP = [
  ['`docs/norte.md`', 'norte.md', 'para quién es la app, la escena real y cómo se decide (**manda sobre el resto**)'],
  ['`docs/leyes.md`', 'leyes.md', 'TODAS las leyes, cada una con el test que la vigila'],
  ['`docs/arquitectura-modulos.md`', 'arquitectura-modulos.md', 'la radiografía: capas, imports, esfuerzo por tramo y mapa de datos (GENERADO)'],
  ['`docs/modos-de-juego.md`', 'modos-de-juego.md', 'contrato de los 5 modos y los 4 bucles en vivo'],
  ['`docs/decisiones-pendientes.md`', 'decisiones-pendientes.md', 'lo aplazado, con su condición para reabrirlo'],
  ['`docs/estudio-bucles-live.md`', 'estudio-bucles-live.md', 'por qué el vivo es como es (estudio medido)'],
  ['`docs/testing.md`', 'testing.md', 'las suites y las redes de seguridad del preflight'],
  ['`docs/guia-testeo-companero.md`', 'guia-testeo-companero.md', 'guía de pruebas paso a paso, para alguien no técnico'],
];

/** La tabla "ir a otro documento" vista DESDE `file` (ruta relativa al repo).
 *  Se excluye a sí mismo: un enlace a la página en la que ya estás es ruido. */
export function docTable(file) {
  const rel = file.startsWith('docs/') ? '' : 'docs/';
  const rows = DOC_MAP.filter(d => !file.endsWith(d[1]))
    .map(([, href, what]) => `| [\`${href}\`](${rel}${href}) | ${what} |`);
  rows.push(file.startsWith('docs/')
    ? '| [`../CLAUDE.md`](../CLAUDE.md) | el mapa de entrada del repo: "quiero X → voy a Y" |'
    : '| [`docs/README.md`](docs/README.md) | índice completo de la documentación |');
  return ['| Documento | Qué responde |', '|---|---|', ...rows].join('\n');
}
