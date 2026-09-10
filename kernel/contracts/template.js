// TemplateContract — la forma que TODA plantilla de actividad debe cumplir.
//
// QUIÉN MANDA (decidido en la auditoría estructural del 2026-09-10, porque este
// fichero describía una superficie de hace versiones y el tutorial producía una
// plantilla que NO pasaba el contrato):
//
//   · `core/templateContract.js` — LA AUTORIDAD. Es el checker EJECUTABLE: lo
//     corre CI (`tests/templateContract.test.mjs`), el panel `#/admin` y
//     `tools/check-template.mjs`. Si este JSDoc y ese checker discrepan, manda
//     el checker — y hay que corregir este fichero.
//   · `core/templateCapability.js` — los requisitos CONDICIONALES (qué exige
//     `modes.live`, qué significa «puede autopuntuar una ronda»). Viven ahí
//     porque los consultan DOS clientes con reacciones distintas: el registro
//     (`core/registry.js`, que lanza al arrancar) y el checker (que acumula
//     issues). Estuvieron escritos por separado y decían cosas distintas.
//   · `core/registry.js` — guarda de ARRANQUE: solo el mínimo estructural.
//   · `templates/base.js` — DEFAULTS compartidos. No es una segunda
//     especificación: lo que aporta son valores, no reglas.
//   · este fichero — la descripción JSDoc de todo lo anterior, para que un
//     editor te autocomplete y para leerlo de una pasada.
//   · `templates/HOW_TO_ADD.md` — la explicación humana, derivada de lo mismo.
//
// Nada de esto valida por su cuenta: la validación vive en UN sitio.
//
// El VOCABULARIO que usa (Activity, RoundPayload, ScoreInput…) vive en los
// contratos vecinos: `activity.js` (el dato) y `session.js` (jugar). Aquí no se
// vuelve a definir ninguno — un concepto, un dueño (§21b).
//
// OJO con el signo de interrogación de apertura dentro de un bloque JSDoc: en
// una línea `@property` rompe el parser de TypeScript (TS1127). En comentarios
// de línea como este no pasa nada.

/**
 * @typedef {import('./activity.js').Activity} Activity
 * @typedef {import('./activity.js').ActivityContent} ActivityContent
 * @typedef {import('./activity.js').ActivityPresentation} ActivityPresentation
 * @typedef {import('./activity.js').ActivityRules} ActivityRules
 * @typedef {import('./activity.js').LiveSettings} LiveSettings
 * @typedef {import('./activity.js').ScoringRules} ScoringRules
 * @typedef {import('./session.js').LiveLoop} LiveLoop
 * @typedef {import('./session.js').LivePhase} LivePhase
 * @typedef {import('./session.js').RoundContext} RoundContext
 * @typedef {import('./session.js').RoundPayload} RoundPayload
 * @typedef {import('./session.js').ScoreInput} ScoreInput
 * @typedef {import('./session.js').ScoreResult} ScoreResult
 * @typedef {import('./session.js').SubmitKind} SubmitKind
 * @typedef {import('./session.js').TeamsPolicy} TeamsPolicy
 * @typedef {import('./session.js').VsPolicy} VsPolicy
 */

/**
 * @typedef {Object} TemplateModes
 * @property {boolean} [solo]   Individual, en esta pantalla, puntúa el shell.
 * @property {boolean} [live]   Sala con PIN/QR y tiempo real (proyector + móviles).
 * @property {boolean} [async]  Tarea (a su ritmo, fuera de clase).
 */

/**
 * Una OPCIÓN DE PARTIDA (§28 R2, `core/playOptions.js`): lo que cambia el juego
 * para ESTA vez, no el contenido guardado. Como mucho 2 por plantilla, de 2 a 4
 * valores cada una, y la opción llega SIEMPRE ya elegida.
 *
 * `set` es PURO: devuelve una COPIA de la actividad; la guardada no se toca (§24).
 *
 * @typedef {Object} PlayOption
 * @property {string} id
 * @property {string} label
 * @property {Array<{value: string, label: string, icon?: string}>} values
 * @property {(activity: Activity) => string} get
 * @property {(activity: Activity, value: string) => Activity} set
 */

/**
 * POLÍTICA DE JUEGO declarada — obligatoria, y el bloque más grande del
 * contrato. Existe para que el motor y las vistas LEAN cómo se comporta la
 * plantilla en cada modo en vez de adivinarlo (`views/vsView.js` forzaba
 * carrera a todas y en Quiz el primero en acabar le robaba lo hecho al otro).
 *
 * @typedef {Object} TemplatePlay
 * @property {VsPolicy} vs     Duelo: gana quien acaba antes, o quien más suma
 *   (espera a los dos). `'none'` = sin VS. Distinto de `'none'` EXIGE `renderRound`.
 * @property {TeamsPolicy} teams  Equipos: por turnos, tablero compartido,
 *   mecánica propia, o ninguno. `'turns'`/`'board'` EXIGEN `renderRound`.
 * @property {LiveLoop[]} live   Bucles del catálogo CONGELADO (§26,
 *   `core/liveLoops.js`). Lista vacía = no se juega en vivo. Tiene que ser
 *   coherente con `modes.live`, y `'board'` EXIGE `renderRaceCell`. (`loopsOf()`
 *   tolera además la forma heredada de un solo string.)
 * @property {SubmitKind} [submit]  Cómo se envía una respuesta en la ronda
 *   compartida: el toque ES la respuesta (cero botones) o se construye y se
 *   confirma (EXACTAMENTE uno, marcado `data-ww-submit`). OBLIGATORIO si hay
 *   `renderRound`.
 * @property {boolean} [retry]   Un fallo vuelve a la cola, o no.
 * @property {PlayOption[]} [options]  Opciones de PARTIDA.
 * @property {{unidad: string|null, crono?: boolean}} [reloj]  Qué reloj ofrece.
 */

/**
 * @typedef {Object} TemplateEditor
 * @property {string} [elemento]   Nombre SINGULAR y en minúscula de lo que el
 *   docente añade — de ahí sale el botón «+ Añadir …». Obligatorio salvo que
 *   el contenido sea `generado`.
 * @property {boolean} [generado]  El contenido lo produce la plantilla (los
 *   juegos): entonces no hay nada que «añadir» y `elemento` sobra.
 * @property {string} primerPaso   Qué se lee con la actividad vacía. Obligatorio
 *   y de 25 caracteres para arriba: es lo que enseña a empezar, en vez de
 *   contenido de muestra que hay que borrar.
 */

/**
 * @template [C=ActivityContent]
 * @typedef {Object} TemplateMeta
 * @property {string} name            Id único, p. ej. 'quiz'. OBLIGATORIO.
 * @property {string} label           Nombre humano. OBLIGATORIO (no vacío).
 * @property {string} icon            Clase de Bootstrap Icons. OBLIGATORIO.
 * @property {string} [color]         Color de Bootstrap para el botón/badge.
 * @property {string} instructions    Frase corta de CÓMO SE JUEGA. OBLIGATORIA:
 *   la muestra la antesala, que es una para todos los modos.
 * @property {'ejercicio'|'juego'} kind  Familia (norte §4c): el contenido lo
 *   pone el docente, o lo genera la plantilla. OBLIGATORIO.
 * @property {string} [skill]         La HABILIDAD que entrena. OBLIGATORIA si
 *   `kind === 'juego'` (es el eje por el que se ordena la estantería).
 * @property {string} contentModel    Qué modelo de contenido consume.
 *   OBLIGATORIO y tiene que estar REGISTRADO en `kernel/content/models.js`.
 * @property {number} templateVersion Entero ≥ 1. Súbelo al cambiar la forma del
 *   contenido; > 1 EXIGE `migrateContent`.
 * @property {TemplateModes} modes    Dónde se puede jugar. OBLIGATORIO.
 * @property {TemplatePlay} play      Política de juego. OBLIGATORIA.
 * @property {TemplateEditor} editor  Qué se añade y qué enseña el vacío. OBLIGATORIO.
 * @property {boolean} [paginated]    Una pantalla por ítem (de ahí sale el nº de páginas).
 * @property {string} [markNoun]      Lo que el alumno MARCA, en singular (Tildes/Comas).
 * @property {'16/10'|'4/3'|'16/9'|'1/1'|'auto'} [aspectRatio]  Proporción del
 *   marco (por defecto 4/3). La plataforma OBEDECE lo que declare la plantilla.
 * @property {'fill'|'block'|'center'} [panelFit]  Maquetación del panel de VS.
 * @property {boolean} [iaPalabrasComoTexto]  Modelo `words`: la plantilla guarda
 *   CADENAS sueltas (Sopa de Letras), no fichas con pista, así que lo que escribe
 *   la IA se aplana antes de entrar (`core/aiContent.js`). Lo lee el chasis del
 *   editor (`core/editorShell.js`).
 * @property {boolean} [seMarcaConLapiz]  Se juega MARCANDO sobre un texto
 *   (Tildes/Comas), así que la antesala ofrece calibrar el lápiz antes de
 *   empezar. Lo DECLARA la plantilla; la lee `views/antesala.js` (§0).
 * @property {() => ActivityRules} defaultRules      OBLIGATORIA (función).
 * @property {() => ScoringRules} defaultScoring     OBLIGATORIA (función).
 * @property {() => C} defaultContent                OBLIGATORIA (función). Lo que
 *   devuelve tiene que pasar el `validate()` de su modelo Y, si la plantilla
 *   ofrece rondas, producir al menos un ítem de sesión.
 * @property {() => LiveSettings} [defaultLive]      Ajustes de sala por defecto.
 * @property {() => ActivityPresentation} [defaultPresentation]  Tema/fondo sugeridos.
 */

/**
 * Lo que el marco le pasa a `renderPlayer`. `mode` es lo que decide qué se
 * persiste (`core/persistPolicy.js`); `onFinish` recibe el resultado ya con su
 * TECHO, derivado del scorer y no de una fórmula paralela.
 * @typedef {Object} PlayerOpts
 * @property {import('./session.js').PersistMode} [mode]
 * @property {boolean} [skipChrome]
 * @property {(result: {score: number, maxScore?: number, timeUsed?: number} & Record<string, unknown>) => void} [onFinish]
 */

/**
 * Los callbacks de una ronda compartida (VS · Equipos · alumno en vivo).
 * `chips` viaja tal cual a la plantilla: quedarse solo con `onSubmit` era lo que
 * dejaba a la vista pintando su barra ENCIMA de la de la hoja.
 * @typedef {Object} RoundCallbacks
 * @property {(value: unknown) => void} [onSubmit]
 * @property {(snap: {progress?: number} & Record<string, unknown>) => void} [onProgress]
 *   Solo las plantillas de TABLERO (`play.live` con `'board'`): emiten su estado
 *   en cada movimiento, para que el duelo mueva la cuerda y el docente vea
 *   avanzar cada tablero. Lo único que lee la plataforma es `progress` (0..1);
 *   el resto del estado viaja tal cual hasta el scorer de la plantilla.
 * @property {{left?: string, right?: string}} [chips]  Los indicadores que la
 *   VISTA querría pintar (progreso · puntos). Viajan a la plantilla para que los
 *   aloje en SU barra: decía `string`, pero el único que los produce
 *   (`views/live/studentCarrera.js`) y el único que los consume
 *   (`core/textCorrectionRound.js`) llevan siempre los dos lados.
 * @property {boolean} [disabled]
 */

/**
 * EL ASA de una ronda ya montada: lo que `renderRound` devuelve para que la
 * vista le hable SIN tocar el DOM de la plantilla. Todo es OPCIONAL —la mayoría
 * de plantillas no devuelve nada— y quien lo usa pregunta antes
 * (`handle?.flush`), que es justo lo que evita el `querySelector` a clases
 * internas de otra capa (§23).
 * @typedef {Object} RoundHandle
 * @property {() => void} [flush]          Entrega lo que el alumno lleva hecho
 *   sin esperar su «Listo» (el profe avanzó: rescate del trazo en curso).
 * @property {boolean} [chromePropio]      La ronda YA pinta su barra (progreso
 *   y herramientas), así que la vista no monta otra encima.
 * @property {(texto: string, pct: number) => void} [setReloj]  Repintar SOLO el
 *   reloj, sin volver a montar la ronda.
 * @property {() => void} [dispose]        Soltar timers y listeners propios.
 * @property {() => void} [unmount]        Lo mismo que `dispose` y además vaciar
 *   el hueco: la ronda de TABLERO (Ordena las Pelotas) se monta entera dentro de
 *   su nodo y lo devuelve limpio.
 * @property {() => Record<string, unknown>} [getState]  El estado de la ronda de
 *   tablero ahora mismo (la misma instantánea que viaja por `onProgress`).
 */

/**
 * Lo que se PROYECTA en vivo. `item` es el ítem COMPLETO (el host tiene la
 * clave); `payload` es el saneado que ve el alumno.
 * @typedef {Object} HostRoundContext
 * @property {LivePhase} [phase]
 * @property {unknown} [item]
 * @property {RoundPayload|null} [payload]
 * @property {unknown[]} [answers]
 * @property {Record<string, string[]>} [playerMap]  Quién eligió cada opción,
 *   agrupado por el valor de la respuesta. Lo arma el host
 *   (`views/live/hostRondas.js`) al revelar; la plantilla lo pinta si lo trae.
 */

/**
 * La superficie ESTÁTICA de una plantilla: son clases con miembros `static`,
 * no instancias (igual que `templates/base.js`).
 *
 * @template [C=ActivityContent]
 * @typedef {Object} TemplateContract
 * @property {TemplateMeta<C>} meta
 * @property {(rootSel: string|Element, activity: import('./activity.js').Activity<C>, opts?: PlayerOpts) => void} renderPlayer
 *   OBLIGATORIO (lo exige el registro al arrancar). El modo Individual/Tarea.
 * @property {(root: Element, activity: import('./activity.js').Activity<C>, onChange: (activity: import('./activity.js').Activity<C>) => void) => void} renderEditor
 *   OBLIGATORIO (lo exige el registro).
 * @property {(root: Element, payload: RoundPayload, cbs?: RoundCallbacks) => (RoundHandle|null|void)} [renderRound]
 *   La ronda COMPARTIDA (VS · Equipos · alumno en vivo). Si existe, exige
 *   `scoreSubmission`, `getRoundPayload` y `meta.play.submit`.
 * @property {(root: Element, ctx: HostRoundContext) => void} [renderRoundHost]
 *   Lo que se PROYECTA en vivo. `templates/base.js` trae una por defecto; si la
 *   plantilla escribe la suya, cuenta como alternativa a `scoreSubmission`
 *   cuando `modes.live` (proyecta aunque no auto-puntúe).
 * @property {(cellEl: Element, ctx: Record<string, unknown>) => void} [renderRaceCell]
 *   Una celda del tablero del docente en vivo. OBLIGATORIA si `play.live`
 *   incluye `'board'`.
 * @property {(activity: import('./activity.js').Activity<C>, ctx: RoundContext) => (RoundPayload|null)} [getRoundPayload]
 *   El payload SIN la solución (§22). Obligatorio con `modes.live` o `renderRound`.
 * @property {(input: ScoreInput) => ScoreResult} [scoreSubmission]
 *   El ÚNICO scorer de la plantilla: lo usan todos los modos, y ninguna vista
 *   reimplementa el conteo.
 * @property {(content: C, fromVersion: number) => C} [migrateContent]
 *   OBLIGATORIA si `templateVersion > 1`, y tiene que ser IDEMPOTENTE.
 * @property {(input: {item: unknown, activity?: Activity}) => Array<{key: string|number, label?: string, ok?: boolean}>} [itemParts]
 *   ANALÍTICA POR PARTE (M1, `core/itemStats.js`): en qué se descompone un ítem
 *   (cada tilde requerida, cada hueco). Sin ella, el informe cae al genérico
 *   «1 parte por ítem».
 * @property {(input: {value: unknown, item?: unknown, activity?: Activity}) => Array<string|number>} [valueParts]
 *   Qué partes marcó UNA respuesta. Solo se consulta si hay `itemParts`.
 * @property {(item: unknown) => string} [itemLabel]
 *   Etiqueta corta del ítem para las tablas e informes.
 * @property {(content: ActivityContent, fromModel: string, opts?: Record<string, unknown>) => (C|null)} [adoptContent]
 *   Adapta el contenido al CONVERTIR desde otra plantilla del MISMO
 *   `contentModel` pero distinta forma de ítem (Operaciones→Quiz genera
 *   `options[]`). La invoca `kernel/content/switch.js`; reglas en
 *   `kernel/content/qaAdapt.js`. Opcional y no se valida.
 *   El segundo argumento es el MODELO de origen (es lo que pasan los dos
 *   llamantes, `switch.js` y `core/editorShell.js`), y el tercero, opcional,
 *   son las opciones del cambio: hoy solo lo mira el Crucigrama (`soloForma`,
 *   sondear qué faltará sin pagar la colocación de la rejilla).
 */

/**
 * LA MISMA META, VISTA DESDE LA BASE — la que hay que poner en
 * `templates/base.js`, y solo ahí.
 *
 * Por qué existe y no vale `TemplateMeta`: los 16 `static meta = { … }` de las
 * plantillas son literales SIN anotar, así que TypeScript ENSANCHA sus valores
 * (`kind: 'juego'` se infiere `string`, `play.vs: 'race'` se infiere `string`,
 * el `mode: 'moves'` de Pelotas también). Un literal ensanchado no es asignable
 * a una unión estrecha, y eso es TODO el TS2417: no hay nada mal en la
 * plantilla, solo falta decirle a TypeScript qué valores acepta.
 *
 * Así que la BASE declara la forma ANCHA —las uniones como `string`, los
 * `default*` como objeto— y cada plantilla que quiera el tipado exacto lo pide
 * ella misma, con una línea y sin arrastrar a las otras quince:
 *
 *     una anotación `type` con `TemplateMeta<QaContent>` sobre su `static meta`
 *
 * `TemplateMeta` sigue siendo el contrato de verdad: es lo que se documenta, lo
 * que comprueba `core/templateContract.js` y lo que se pide cuando alguien
 * RECIBE una meta. Esto es solo la boca ancha por la que entra.
 *
 * @typedef {Object} BaseTemplateMeta
 * @property {string} name
 * @property {string} label
 * @property {string} icon
 * @property {string} [color]
 * @property {string} [instructions]
 * @property {string} [kind]
 * @property {string} [skill]
 * @property {string|null} contentModel
 * @property {number} templateVersion
 * @property {TemplateModes} modes
 * @property {{vs: string, teams: string, live: string[], submit?: string,
 *   retry?: boolean, options?: PlayOption[],
 *   reloj?: {unidad: string|null, crono?: boolean}}} [play]
 * @property {TemplateEditor} [editor]
 * @property {boolean} [paginated]
 * @property {string} [markNoun]
 * @property {string} [aspectRatio]
 * @property {string} [panelFit]
 * @property {boolean} [iaPalabrasComoTexto]
 * @property {boolean} [seMarcaConLapiz]
 * @property {() => Record<string, unknown>} defaultRules
 * @property {() => Record<string, unknown>} defaultScoring
 * @property {() => Record<string, unknown>} defaultContent
 * @property {() => Record<string, unknown>} [defaultLive]
 * @property {() => Record<string, unknown>} [defaultPresentation]
 */

/**
 * LO MISMO, pero como lo ve el registro: una CLASE cuyos miembros son estáticos,
 * no un objeto. Es el tipo de `getTemplate()` y el que hay que pedir cuando se
 * recibe «la plantilla» (`T`) por parámetro.
 *
 * En JavaScript, el lado estático de una clase ES un objeto con esos miembros,
 * así que `TemplateStatic` no añade nada al contrato: solo le pone nombre al
 * hecho de que se pasa la CLASE, sin instanciar.
 *
 * @template [C=ActivityContent]
 * @typedef {TemplateContract<C>} TemplateStatic
 */

// CÓMO SE HACE QUE `class X extends BaseTemplate` COMPILE (hoy son 16 TS2417,
// «Class static side incorrectly extends base class static side»).
//
// La causa NO es el patrón de clases estáticas —no hay que cambiarlo— sino que
// `templates/base.js` declara sus estáticos SIN tipo: TypeScript los infiere lo
// más estrechos posible y entonces ninguna subclase encaja.
//   · `static meta = { … contentModel: null, defaultRules: () => ({}) … }` se
//     infiere con `contentModel: null`, así que una subclase con
//     `contentModel: 'qa'` deja de ser asignable.
//   · `static renderPlayer = null` se infiere de tipo `null`, así que una
//     subclase que le asigne una función, tampoco.
//
// El arreglo son TRES anotaciones en la base, y ni una línea en las 16 hijas
// (verificado: con ellas los 16 TS2417 desaparecen):
//
//     @type {TemplateMeta}                    sobre  static meta = { … }
//     @type {TemplateContract['renderPlayer']|null}  sobre  static renderPlayer = null
//     @type {TemplateContract['renderEditor']|null}  sobre  static renderEditor = null
//
// (Los dos últimos siguen valiendo `null` en ejecución: son ABSTRACTOS a
// propósito — con un stub que lanza, el guard de arranque de `core/registry.js`
// no podía fallar nunca, porque la subclase lo heredaba.)
//
// No se ha hecho aquí porque esta fase solo toca `kernel/contracts/`: queda
// anotado para la fase que abra `templates/`.

export {};
