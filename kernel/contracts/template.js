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

/**
 * @typedef {Object} TemplateModes
 * @property {boolean} [solo]   Individual, en esta pantalla, puntúa el shell.
 * @property {boolean} [live]   Sala con PIN/QR y tiempo real (proyector + móviles).
 * @property {boolean} [async]  Tarea (a su ritmo, fuera de clase).
 */

/**
 * POLÍTICA DE JUEGO declarada — obligatoria, y el bloque más grande del
 * contrato. Existe para que el motor y las vistas LEAN cómo se comporta la
 * plantilla en cada modo en vez de adivinarlo (`views/vsView.js` forzaba
 * carrera a todas y en Quiz el primero en acabar le robaba lo hecho al otro).
 *
 * @typedef {Object} TemplatePlay
 * @property {'race'|'points'|'none'} vs     Duelo: gana quien acaba antes, o
 *   quien más suma (espera a los dos). `'none'` = sin VS. Distinto de `'none'`
 *   EXIGE `renderRound`.
 * @property {'turns'|'board'|'none'} teams  Equipos: por turnos, tablero
 *   compartido, o ninguno. `'turns'`/`'board'` EXIGEN `renderRound`.
 * @property {string[]} live   Bucles del catálogo CONGELADO (§26, `core/liveLoops.js`:
 *   `rounds` · `race` · `board` · `claim`). Lista vacía = no se juega en vivo.
 *   Tiene que ser coherente con `modes.live`, y `'board'` EXIGE `renderRaceCell`.
 * @property {'gesto'|'boton'} [submit]  Cómo se envía una respuesta en la ronda
 *   compartida: el toque ES la respuesta (cero botones) o se construye y se
 *   confirma (EXACTAMENTE uno, marcado `data-ww-submit`). OBLIGATORIO si hay
 *   `renderRound`.
 * @property {boolean} [retry]   ¿Un fallo vuelve a la cola?
 * @property {Array<{id:string,label:string,values:Array<{value:string,label:string}>,
 *   get:Function,set:Function}>} [options]  Opciones de PARTIDA (§28 R2): como
 *   mucho 2, de 2 a 4 valores cada una, `get`/`set` obligatorios y `set` PURO
 *   (no toca la actividad guardada). La opción llega SIEMPRE ya elegida.
 * @property {{unidad:string|null, crono:boolean}} [reloj]  Qué reloj ofrece.
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
 * @property {'16/10'|'4/3'|'16/9'|'1/1'|'auto'} [aspectRatio]  Proporción del
 *   marco (por defecto 4/3). La plataforma OBEDECE lo que declare la plantilla.
 * @property {'fill'|'block'|'center'} [panelFit]  Maquetación del panel de VS.
 * @property {() => Object} defaultRules    OBLIGATORIA (función).
 * @property {() => Object} defaultScoring  OBLIGATORIA (función).
 * @property {() => Object} defaultContent  OBLIGATORIA (función). Lo que
 *   devuelve tiene que pasar el `validate()` de su modelo Y, si la plantilla
 *   ofrece rondas, producir al menos un ítem de sesión.
 * @property {() => Object} [defaultLive]   Ajustes de sala por defecto.
 */

/**
 * @typedef {Object} RoundContext
 * @property {number} itemIndex  Índice del ítem/ronda que se sirve.
 */

/**
 * @typedef {Object} ScoreInput
 * @property {*} value          Lo que envió quien juega.
 * @property {Object} [item]    El ítem que se puntúa.
 * @property {number} [msTaken] Milisegundos que tardó (bonus de velocidad).
 * @property {Object} activity  La actividad completa.
 * @property {string} [mode]    El modo, cuando cambia el modelo de puntos
 *   (en carrera son PLANOS: sin bonus de velocidad).
 */

/**
 * LA FORMA DEL SCORER, y no otra: `{correct, points, hits, total}`.
 * `hits`/`total` son el MÉRITO (binarias 1/1 ó 0/1; por partes, 3/8;
 * `total: 0` = no lo puntúa la máquina, lo pone el docente). Con el mérito
 * obligatorio, la tabla, el mapa de calor y el CSV leen igual todas.
 *
 * @typedef {Object} ScoreResult
 * @property {boolean} correct
 * @property {number} points
 * @property {number} hits
 * @property {number} total
 */

/**
 * La superficie ESTÁTICA de una plantilla: son clases con miembros `static`,
 * no instancias (igual que `templates/base.js`).
 *
 * @typedef {Object} TemplateContract
 * @property {TemplateMeta} meta
 * @property {(rootSel: string|Element, activity: Object, opts?: Object) => void} renderPlayer
 *   OBLIGATORIO (lo exige el registro al arrancar). El modo Individual/Tarea.
 * @property {(root: Element, activity: Object, onChange: Function) => void} renderEditor
 *   OBLIGATORIO (lo exige el registro).
 * @property {(root: Element, payload: Object, cbs?: Object) => (Object|null)} [renderRound]
 *   La ronda COMPARTIDA (VS · Equipos · alumno en vivo). Si existe, exige
 *   `scoreSubmission`, `getRoundPayload` y `meta.play.submit`.
 * @property {(root: Element, ctx: Object) => void} [renderRoundHost]
 *   Lo que se PROYECTA en vivo. `templates/base.js` trae una por defecto; si la
 *   plantilla escribe la suya, cuenta como alternativa a `scoreSubmission`
 *   cuando `modes.live` (proyecta aunque no auto-puntúe).
 * @property {(cellEl: Element, ctx: Object) => void} [renderRaceCell]
 *   Una celda del tablero del docente en vivo. OBLIGATORIA si `play.live`
 *   incluye `'board'`.
 * @property {(activity: Object, ctx: RoundContext) => (Object|null)} [getRoundPayload]
 *   El payload SIN la solución (§22). Obligatorio con `modes.live` o `renderRound`.
 * @property {(input: ScoreInput) => ScoreResult} [scoreSubmission]
 *   El ÚNICO scorer de la plantilla: lo usan todos los modos, y ninguna vista
 *   reimplementa el conteo.
 * @property {(content: Object, fromVersion: number) => Object} [migrateContent]
 *   OBLIGATORIA si `templateVersion > 1`, y tiene que ser IDEMPOTENTE.
 * @property {(content: Object, fromTemplate: string) => Object} [adoptContent]
 *   Adapta el contenido al CONVERTIR desde otra plantilla del MISMO
 *   `contentModel` pero distinta forma de ítem (Operaciones→Quiz genera
 *   `options[]`). La invoca `kernel/content/switch.js`; reglas en
 *   `kernel/content/qaAdapt.js`. Opcional y no se valida.
 */

export {};
