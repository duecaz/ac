// ContentModelContract — la forma de un MÓDULO DE MODELO DE CONTENIDO.
//
// Un modelo de contenido es el DATO ABSTRACTO que el docente escribe (preguntas,
// parejas, frases con marcas, pines sobre un dibujo). Las plantillas declaran
// cuál consumen en `meta.contentModel`, y compartir modelo es lo que hace
// posible «cambiar de plantilla en un clic»: cualquier plantilla del mismo
// modelo pinta el mismo contenido, y los conversores puentean entre modelos con
// degradación declarada (docs/conversiones.md).
//
// QUIÉN MANDA: `kernel/content/models.js` (`MODELS`) es el registro
// EJECUTABLE — once modelos hoy — y `getModel(name)` la única puerta. Los
// módulos hoja de `core/contentModels/*` tienen superficies desiguales (unos
// solo exponen `isCorrect`, otros `newEmpty`/`validate`): ese registro los
// envuelve en esta forma sin moverlos.
//
// Las FORMAS concretas del contenido de cada modelo (`QaContent`, `PairsContent`,
// `TextCorrectionContent`…) viven en `kernel/contracts/activity.js`: aquí está
// el contrato del MÓDULO, allí el del DATO.
//
//   /** @typedef {import('../kernel/contracts/contentModel.js').ContentModelContract} ContentModelContract */

/**
 * @typedef {import('./activity.js').ActivityContent} ActivityContent
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors  Problemas legibles por una persona; vacío cuando `ok`.
 */

/**
 * El contrato de un modelo, ya normalizado por `kernel/content/models.js`.
 *
 * @template [C=ActivityContent]
 * @typedef {Object} ContentModelContract
 * @property {string} name                    Id del modelo: 'qa', 'pairs', 'textCorrection'…
 * @property {() => C} newEmpty               Contenido EN BLANCO y válido. Es lo que usa
 *   `newActivity()`: una actividad nueva nace vacía, no con contenido de muestra que
 *   haya que borrar (R-D) — salvo las de contenido GENERADO, que nacen con su tablero.
 * @property {(content: unknown) => ValidationResult} validate
 *   FRONTERA: le puede llegar cualquier cosa (un JSON importado, una fila del backend,
 *   contenido de una plantilla anterior), así que entra como `unknown` y se estrecha aquí.
 * @property {(fromModel: string, content: unknown) => boolean} [canConvertFrom]
 * @property {(fromModel: string, content: unknown) => (C|null)} [convertFrom]
 *   Conversión best-effort; `null` cuando no se puede. Puede PERDER campos que el
 *   modelo destino no sabe guardar, y eso es correcto: la degradación se declara.
 */

/**
 * El registro completo, tal y como lo exporta `kernel/content/models.js`.
 * @typedef {Record<string, ContentModelContract>} ContentModelRegistry
 */

/**
 * La puerta única al registro: `getModel(name)` devuelve el contrato o `null`
 * si ese nombre no está REGISTRADO (una plantilla que declare un modelo no
 * registrado no puede validarse ni convertirse — lo caza
 * `tests/templateContract.test.mjs`).
 * @typedef {(name: string) => (ContentModelContract|null)} GetModel
 */

export {};
