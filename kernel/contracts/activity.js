// EL VOCABULARIO DE LA ACTIVIDAD — la forma de lo que el docente crea, guarda
// y juega. Es el tipo que atraviesa TODAS las capas (§0): el editor la escribe,
// el almacén la persiste, la plantilla la pinta y el modo la juega.
//
// CÓMO SE CONSUME DESDE OTRO FICHERO (esto es el ejemplo, cópialo):
//
//   /** @typedef {import('../kernel/contracts/activity.js').Activity} Activity */
//
//   /** @param {Activity} activity */
//   export function jugar(activity) { … }
//
// Un typedef importado así NO genera código: sigue siendo un `.js` sin runtime.
// Desde `kernel/…` la ruta es `../contracts/activity.js`; desde `core/…` o
// `views/…`, `../kernel/contracts/activity.js`.
//
// DOS TRAMPAS del parser de JSDoc, para no perder media hora con ellas:
//   · un alias `@typedef {import('…').Activity} Activity` PIERDE el genérico
//     (queda instanciado con su defecto), así que `Activity<QaContent>` sobre el
//     alias da TS2315. Para el genérico, se escribe el import EN LÍNEA:
//     `@param {import('…/activity.js').Activity<QaContent>} a`. El alias vale —
//     y es lo cómodo— para el uso normal, sin parámetro.
//   · el signo de interrogación de apertura DENTRO de una línea `@property`
//     rompe el parser (TS1127, «Invalid character»). En comentarios `//` no pasa
//     nada; en JSDoc, se redacta sin él.
//
// ─────────────────────────────────────────────────────────────────────────────
// DECISIÓN: `Activity` es GENÉRICA en su contenido, no una unión discriminada.
//
//   /** @type {Activity} */            → contenido = ActivityContent (la unión)
//   /** @type {Activity<QaContent>} */ → contenido concreto, dentro de Quiz
//
// Por qué NO una unión discriminada por `template`:
//   · el discriminante natural sería `template`, y son 16 valores hoy con
//     contenido REPETIDO (quiz/globos/math comparten `qa`; match/memory
//     comparten `pairs`) — la unión tendría 16 ramas para 11 formas.
//   · `template` CAMBIA sobre la misma actividad (kernel/content/switch.js
//     convierte de una plantilla a otra, docs/conversiones.md): una unión
//     discriminada por él obliga a re-estrechar en cada conversión y afirma una
//     correlación template↔contenido que la conversión rompe a propósito.
//   · las ~50 vistas que solo leen `id`/`title`/`template`/`tags` no quieren
//     estrechar NADA: con la unión, cada `activity.content.items` sería un
//     error; con el genérico por defecto leen los campos comunes sin ruido.
// Y por qué SÍ genérica: la plantilla es el único sitio que conoce su forma de
// contenido, y ahí `Activity<QaContent>` da el tipado exacto sin castings.
//
// La forma REAL sale de `core/migrate.js` (`normalize()` — todo campo que
// aparece ahí es obligatorio tras leer del almacén y opcional al construirla),
// de `core/constants.js` (los DEFAULT_*) y de los `defaultContent/defaultRules/
// defaultScoring` de las 16 plantillas.

/**
 * ATRIBUCIÓN de una imagen (§24: el crédito viaja con el píxel porque con
 * Creative Commons es la condición de uso). La produce `atribucionDe()` de
 * `core/imageSearch.js` y se BORRA al cambiar de imagen.
 * @typedef {Object} ImageCredit
 * @property {string} autor
 * @property {string} licencia
 * @property {string} fuente    De dónde salió: 'commons' | 'openverse' | …
 * @property {string} pagina    URL de la página de origen.
 */

// ─── MODELOS DE CONTENIDO ────────────────────────────────────────────────────
// Uno por modelo REGISTRADO en `kernel/content/models.js` (hoy once). Un modelo
// lo comparten varias plantillas: eso es lo que hace posible «cambiar de
// plantilla en un clic».

/**
 * Ítem de pregunta-respuesta (`core/contentModels/qa.js`). Lo consumen Quiz,
 * Globos y Operaciones.
 * @typedef {Object} QaItem
 * @property {string} id                      `rid('q_')`.
 * @property {string} question
 * @property {string|string[]|null} [answer]  Respuesta(s) válidas. `null` = sin clave.
 * @property {string[]} [options]             Opciones (Quiz/Globos); Operaciones no las trae.
 * @property {number[]} [answerIdx]           Posiciones correctas dentro de `options`; manda sobre `answer`.
 * @property {string|null} [image]            data-URL (§25: 200 KB).
 * @property {ImageCredit} [imageCredit]
 * @property {string|null} [audio]
 * @property {number} [points]                Puntos de ESTE ítem; si falta manda `scoring.pointsPerCorrect`.
 */
/**
 * @typedef {Object} QaContent
 * @property {QaItem[]} items
 */

/**
 * Pareja izquierda/derecha (`core/contentModels/pairs.js`). Emparejar y Memoria.
 * Una imagen cuenta como lado (`pairComplete`).
 * @typedef {Object} Pair
 * @property {string} id            `rid('p_')`.
 * @property {string} left
 * @property {string} right
 * @property {string|null} [leftImage]
 * @property {string|null} [rightImage]
 * @property {string|null} [image]  Alias legado del lado izquierdo.
 * @property {number} [points]
 */
/**
 * @typedef {Object} PairsContent
 * @property {Pair[]} pairs
 */

/**
 * Lista plana de textos (`core/contentModels/entries.js`). HUÉRFANO: ninguna
 * plantilla lo declara hoy; sigue registrado para una futura de tarjetas.
 * @typedef {Object} EntriesContent
 * @property {string[]} entries
 */

/**
 * Una marca del alumno sobre el texto (`core/contentModels/textCorrection.js`).
 * @typedef {Object} TextMark
 * @property {number} pos               Índice de carácter dentro de `text`.
 * @property {'tilde'|'coma'|'punto'} kind
 */
/**
 * Una frase con su clave de marcas. Tildes y Comas.
 * @typedef {Object} Passage
 * @property {string} id       `rid('ps_')`.
 * @property {string} text     El texto SIN corregir (sin tildes / sin comas).
 * @property {TextMark[]} marks
 */
/**
 * @typedef {Object} TextCorrectionContent
 * @property {Passage[]} passages
 */

/**
 * Un pin sobre el dibujo. `x`/`y` son FRACCIONES 0..1 de la imagen, para que la
 * posición no dependa del tamaño en pantalla.
 * @typedef {Object} DiagramPin
 * @property {string} id     `rid('pin_')`.
 * @property {string} label
 * @property {number} x
 * @property {number} y
 */
/**
 * Etiqueta el diagrama (`core/contentModels/diagram.js`).
 * @typedef {Object} DiagramContent
 * @property {string|null} image        data-URL del dibujo.
 * @property {number} [imageW]          Forma de la foto, apuntada al elegirla.
 * @property {number} [imageH]
 * @property {ImageCredit} [imageCredit]
 * @property {DiagramPin[]} pins
 */

/**
 * Tarjeta con texto e imagen (`core/contentModels/items.js`). Ruleta y Abre
 * Cajas. VOCABULARIO RESERVADO: el texto se llama `question`, igual que en `qa`,
 * para que las conversiones no paguen impuesto de nombres (el campo legado `q`
 * lo migra `migrateLegacyItems`).
 * @typedef {Object} CardItem
 * @property {string} [id]            `rid('it_')`. Ausente en contenido legado.
 * @property {string} question
 * @property {string|null} [image]
 * @property {ImageCredit} [imageCredit]
 */
/**
 * @typedef {Object} ItemsContent
 * @property {CardItem[]} items
 */

/**
 * Palabra colocada en la rejilla del Crucigrama.
 * @typedef {Object} CrosswordWord
 * @property {string} id
 * @property {string} word
 * @property {string} clue
 * @property {number} row
 * @property {number} col
 * @property {'H'|'V'} dir
 */
/**
 * Sopa de Letras: solo las palabras a buscar.
 * @typedef {Object} WordsearchContent
 * @property {string[]} words
 */
/**
 * Crucigrama: palabra + pista + posición.
 * @typedef {Object} CrosswordContent
 * @property {CrosswordWord[]} words
 */
/**
 * El modelo `words` tal y como está REGISTRADO: su `validate` solo exige que
 * `words` sea un array, y las dos plantillas que lo consumen guardan formas
 * distintas (Sopa: `string[]`; Crucigrama: `CrosswordWord[]`). Quien no sepa
 * cuál de las dos tiene, usa este; quien lo sepa, el concreto.
 * @typedef {Object} WordsContent
 * @property {Array<string|CrosswordWord>} words
 */

/**
 * El tablero de tubos de Ordena las Pelotas (`templates/ballsort/game/board.js`).
 * @typedef {Object} BallsortBoard
 * @property {string} levelId
 * @property {string[]} colors
 * @property {number} tubeCapacity
 * @property {string[][]} tubes   Un array por tubo, de abajo a arriba.
 */
/**
 * @typedef {Object} BallsortItem
 * @property {string} id
 * @property {BallsortBoard} board
 * @property {'moves'|'time'} mode
 */
/**
 * Contenido GENERADO: el docente no escribe ítems, ajusta el tablero.
 * @typedef {Object} BallsortContent
 * @property {string} level
 * @property {'moves'|'time'} mode
 * @property {boolean} random     Tablero nuevo en cada partida.
 * @property {BallsortItem[]} items
 */

/**
 * Colorear: `dibujo` es el nombre de un dibujo del banco compartido
 * (`assets/juegos/dibujos`), no un píxel guardado en la actividad.
 * @typedef {Object} ColorearItem
 * @property {string} id
 * @property {string} dibujo
 */
/**
 * @typedef {Object} ColorearContent
 * @property {ColorearItem[]} items
 */

/**
 * Tangram: `figura` es el nombre de una silueta del catálogo.
 * @typedef {Object} TangramItem
 * @property {string} id
 * @property {string} figura
 */
/**
 * @typedef {Object} TangramContent
 * @property {TangramItem[]} items
 */

/**
 * Rompecabezas: un dibujo del banco troceado en una rejilla.
 * @typedef {Object} PuzzleItem
 * @property {string} id
 * @property {string} dibujo
 * @property {number} filas
 * @property {number} columnas
 */
/**
 * @typedef {Object} PuzzleContent
 * @property {PuzzleItem[]} items
 */

/**
 * CUALQUIER contenido de actividad: la unión de los once modelos registrados.
 * Es el defecto del genérico `Activity`, y lo que ve quien no sabe (ni
 * necesita saber) qué plantilla tiene delante.
 * @typedef {QaContent|PairsContent|EntriesContent|TextCorrectionContent
 *   |DiagramContent|ItemsContent|WordsContent|BallsortContent|ColorearContent
 *   |TangramContent|PuzzleContent} ActivityContent
 */

// ─── LOS BLOQUES COMUNES ─────────────────────────────────────────────────────
// Los rellena `normalize()` con los DEFAULT_* de core/constants.js MEZCLADOS
// con los `defaultRules/defaultScoring/defaultLive` de la plantilla, así que
// tras leer del almacén están SIEMPRE presentes (aunque sus campos concretos
// dependan de la plantilla: por eso llevan un índice abierto).

/**
 * Reglas de la partida. Los cuatro primeros son los de `DEFAULT_RULES`; cada
 * plantilla añade los suyos (`hintMode`, `gridSize`, `selector`, `directions`,
 * `spinDurationMs`, `removeAfterSpin`…), por eso el índice abierto.
 * @typedef {Object} ActivityRules
 * @property {number} [timer]              Segundos por ítem. 0 = sin reloj.
 * @property {boolean} [randomize]         Barajar el orden de los ítems.
 * @property {boolean} [shuffleOptions]    Barajar las opciones de cada ítem.
 * @property {Record<string, unknown>} [templateOptions]
 */

/**
 * Parámetros de PUNTUACIÓN. Los LEE el scorer de la plantilla (nunca el
 * player): `core/scoring/award.js` los consulta para convertir mérito en puntos.
 * @typedef {Object} ScoringRules
 * @property {'flat'|'velocidad'} [mode]  En Individual, con bonus por rapidez o sin él.
 * @property {number} [pointsPerCorrect]  Puntos base de un acierto (defecto 1; Tildes/Comas nuevas, 10).
 * @property {number} [pointsPerWrong]    Penalización; solo cuenta si es NEGATIVA.
 * @property {number} [maxScore]          Techo declarado. 0 = derivarlo del scorer.
 */

/**
 * Corrección. `alFinal` decide si se corrige al terminar o entre hojas; lo
 * pregunta `corrigeAlFinal()` (core/constants.js), no cada vista.
 * @typedef {Object} ActivityReview
 * @property {boolean} [allowOverride]  El docente puede cambiar el veredicto.
 * @property {boolean} [alFinal]
 */

/**
 * Aspecto DECLARADO por el docente (§3: el tema cambia TOKENS, la actividad los
 * consume). `background: 'custom'` implica `backgroundImage`.
 * @typedef {Object} ActivityPresentation
 * @property {string} [skin]                Id de skin (`core/skins.js`); 'default' si no.
 * @property {string} [background]          Id de fondo o 'custom' o 'none'.
 * @property {string} [backgroundImage]     data-URL cuando `background === 'custom'`.
 * @property {ImageCredit} [backgroundImageCredit]
 * @property {boolean} [sound]
 * @property {boolean} [teams]
 */

/**
 * Ajustes de la SALA EN VIVO. Son de la capa MODO, no de la plantilla: sus
 * defectos viven en `DEFAULT_LIVE` (core/constants.js) y una plantilla no los
 * declara (§0/§21b).
 * @typedef {Object} LiveSettings
 * @property {boolean} [enabled]
 * @property {'manual'|'autoOnAllAnswered'|'autoOnTimer'} [advanceMode]
 * @property {number} [questionTimer]       Segundos por pregunta.
 * @property {'firstOf'|'timer'|'allAnswered'} [lockAnswersOn]
 * @property {boolean} [showAnswerAfterEach]
 * @property {boolean} [showLeaderboardBetween]
 * @property {'velocidad'|'flat'} [pointsModel]
 * @property {number} [speedBonusMax]
 * @property {boolean} [allowLateJoin]
 * @property {number} [maxPlayers]
 * @property {boolean} [nicknameFilter]
 * @property {boolean} [streakBonus]        DEUDA ABIERTA: nadie lo calcula desde que se retiró Supabase.
 * @property {number} [streakBonusPerStep]
 * @property {'all'|'firstN'|'time'} [endPolicy]   Política de fin de carrera/tablero.
 * @property {number} [endN]
 * @property {number} [endMinutes]
 */

/**
 * Etiqueta LIGERA del autor, denormalizada dentro del JSON para pintar «por X»
 * sin una consulta por tarjeta. El perfil rico vive en la colección `profiles`.
 * @typedef {Object} ActivityAuthor
 * @property {string|null} id
 * @property {string|null} name
 * @property {string|null} signedAt   ISO del primer guardado firmado.
 */

/**
 * UNA ACTIVIDAD, tal y como sale de `normalize()` (core/migrate.js) y como la
 * guarda `core/storage.js`.
 *
 * Todo lo que aquí es obligatorio lo RELLENA `normalize()`, así que una
 * actividad leída del almacén o del backend lo trae siempre; lo que se le pasa
 * A `normalize()` puede traer mucho menos.
 *
 * @template [C=ActivityContent]
 * @typedef {Object} Activity
 * @property {string} id                    `act_XXXXXXXXXX` (core/migrate.js `newActivityId`).
 * @property {string} title
 * @property {string} subtitle
 * @property {string} template              `meta.name` de la plantilla que la juega.
 * @property {number} templateVersion       Versión de la FORMA del contenido (§24).
 * @property {number} schemaVersion         Versión del sobre; hoy `SCHEMA_VERSION` = 4.
 * @property {C} content
 * @property {ActivityRules} rules
 * @property {ScoringRules} scoring
 * @property {ActivityReview} review
 * @property {ActivityPresentation} presentation
 * @property {LiveSettings} live
 * @property {ActivityAuthor} author
 * @property {'private'|'unlisted'|'public'} visibility  Nace 'unlisted' (borrador).
 * @property {string|null} forkOf           Id de la actividad de la que se duplicó.
 * @property {string[]} tags
 * @property {string} language              ISO corto; 'es' por defecto.
 * @property {Record<string, unknown>} media
 * @property {string} createdAt             ISO.
 * @property {string} updatedAt             ISO. Es el reloj del LWW en el merge remoto.
 * @property {boolean} [_unsynced]          Marca LOCAL de pendiente de subir. Nunca viaja al backend.
 * @property {string} [owner]               Dueño en PocketBase; lo sella el remoteStore, no el editor.
 */

/**
 * La FILA de la colección `activities` de PocketBase, ya normalizada por el
 * remoteStore. `data` es la actividad entera; `id` prefiere el del contenido
 * (el que usan los enlaces `#/play/:id`) con respaldo al id recortado de PB.
 * @typedef {Object} ActivityRow
 * @property {string} id
 * @property {Activity} data
 * @property {string} [language]
 * @property {string[]} [tags]
 * @property {string} [owner]
 * @property {string} [updated_at]
 */

export {};
