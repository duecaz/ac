# Modos de juego — contrato único (léelo antes de tocar un modo o una plantilla)

> Por qué existe este documento: antes, cada modo (VS, Equipos, Memoria)
> improvisaba su propia pantalla de inicio y su propio enganche en la página de
> la actividad, y se desincronizaban (markup distinto, un bug de copia‑pega, un
> gateo duplicado que se quedaba viejo). Ahora hay **una sola fuente de verdad**.
> Si añades una plantilla o un modo nuevo, sigue este contrato y aparecerá en el
> sitio correcto, con el aspecto correcto, **sin improvisar**.

Fecha: 2026-07-29 (§9 reescrita como **documento de estudio**: fichas + escenarios
Gherkin + decisiones de diseño abiertas). Verificado contra `core/modes.js`,
`core/persistPolicy.js`, `core/deadlineTicker.js`, `kernel/session/engine.js`,
`kernel/session/memory.js`, `views/modeSetup.js`, `views/playerView.js` y los
`views/*View.js`.

> **Si vienes a decidir el diseño de un modo, ve directo a la §9.** Ahí está,
> por modo: qué hace HOY (con el test que lo fija) y qué está sin decidir.

---

## 1. El mapa: dónde vive cada cosa

| Pieza | Archivo | Responsabilidad |
|---|---|---|
| **Registro de modos** | `core/modes.js` | Qué modos existen, cuándo está disponible cada uno (`isAvailable`), y cómo se monta (`runMode`). **El gateo vive AQUÍ y solo aquí.** |
| **Andamiaje de setup** | `views/modeSetup.js` | La cabecera + subtítulo + botón Empezar **idénticos** para todos los modos. |
| **Página de actividad** | `views/playerView.js` | Pinta la barra "Modos de juego" desde el registro y aloja el modo activo en el *escenario* (`#ww-player-widget`). |
| **Vistas de modo** | `views/vsView.js`, `teamsView.js`, `memoryView.js` | La jugada concreta de cada modo. |
| **Capacidades de plantilla** | `templates/*/template.js` (`static meta`) | Qué sabe hacer la plantilla (puntuar, servir un ítem, live, async). |

**Regla de oro:** la barra de modos y su gateo **se derivan**; nunca se escriben
a mano en la página. Si quieres cambiar cuándo se ofrece un modo, edita
`isAvailable` en `core/modes.js` — un solo sitio.

---

## 2. Los dos tipos de modo: `embed` vs. página propia

```js
// core/modes.js
{ id:'vs', label:'VS (duelo)', icon:'bi-fire', color:'danger',
  embed:true, isAvailable:(a)=>isVsCompatible(a), disabledHint:'…' }
```

- **`embed: true`** → el setup **y** la partida corren **dentro del escenario de
  la actividad**, en la misma página y con el mismo tema (como Individual). Son
  los modos de **pantalla compartida**: `solo`, `vs`, `teams` (este último monta
  Memoria si la plantilla es `memory`).
- **`embed: false`** → el modo abre **su propia página** porque es otro montaje
  **físico**: `live` (proyector + móviles de alumnos) y `task` (gestión de
  tareas). Comparten barra y estética, pero **navegan** vía `href(a)` en vez de
  montarse en el escenario. *No se embeben a propósito*: su ciclo de vida (sala
  Supabase, código/QR, asignaciones) no encaja en el marco de la actividad.

> Si algún día quieres embeber también el *setup* de En vivo/Tarea, cambia
> `embed:true` y añade su rama en `runMode` — pero ten en cuenta que la sala y la
> gestión seguirán necesitando pantalla propia.

---

## 3. ¿Cuándo aparece cada modo? (gateo)

`isAvailable(activity)` decide. Hoy:

| Modo | Disponible si… | De dónde sale |
|---|---|---|
| **Individual** (`solo`) | siempre | — |
| **VS** (`vs`) | la plantilla **autocorrige** (`scoreSubmission`) **y** sabe pintar un ítem (`renderRound`) **y** hay **≥2 ítems** | `isVsCompatible()` en `kernel/session/engine.js` |
| **Equipos** (`teams`) | hay **≥1 ronda** (`sessionItems(a).length`) | el juez docente juega cualquier contenido; auto necesita scorer |
| **En vivo** (`live`) | `template.meta.modes.live === true` | la plantilla lo declara |
| **Tarea** (`task`) | `template.meta.modes.async === true` | la plantilla lo declara |

Estados en la barra:
- **Disponible** → botón de color (si `embed`) o enlace (si no).
- **No disponible** → botón gris **deshabilitado** con `disabledHint` como tooltip…
- …**salvo** los modos con `hideWhenUnavailable:true` (hoy solo **Tarea**), que
  se **ocultan** en lugar de mostrarse grises.

Importante: el gateo usa la actividad **tal como se va a jugar**, respetando el
"Cambiar plantilla" de la página (`playActivity()` en `playerView.js`). Si el
docente cambia Quiz→Ruleta, VS desaparece solo.

### Dos niveles de compatibilidad (la forma recomendada)

Cada modo en `MODE_DEFS` declara **dos** predicados, y todo lo demás se deriva de
esa única tabla (los modos "se inscriben" ahí; nadie los lista a mano):

- **`supportsTemplate(T)`** — *capacidad*: ¿puede esta **plantilla** (la clase)
  ofrecer el modo en principio? Depende solo de lo que implementa/declara
  (`scoreSubmission`+`renderRound` → VS; `renderRound` o ser Memoria → Equipos;
  `meta.modes.live`/`async` → En vivo/Tarea). **No** mira el contenido.
- **`isAvailable(activity)`** — *disponibilidad*: para una **actividad** concreta
  (con contenido), ¿está disponible ya? (p. ej. VS exige además ≥2 ítems).

Quién usa cuál:
- **Selector de plantillas** (`views/templateSelector.js`, las tarjetas con
  "solo · vs · equipos · …") → `modesForTemplate(T)` (capacidad; aún no hay
  contenido).
- **Página de actividad** (barra de modos) → `availableModes(activity)`
  (disponibilidad real).

Regla: si añades un modo o cambias cuándo aplica, edita **solo** su entrada en
`MODE_DEFS` (`supportsTemplate` + `isAvailable`). El selector y la barra se
actualizan solos.

### El editor es un SHELL compartido (anti-deriva)

`core/editorShell.js` (`renderEditorShell`) renderiza **una sola vez** el chasis
de TODOS los editores: título/subtítulo + las pestañas estándar **Contenido ·
Individual · Puntuación · Modos · En vivo · Presentación**. Cada plantilla
aporta **solo** sus paneles propios (su `content`, y opcionalmente `rules`,
`scoring`, `live`); las pestañas **Modos** y **Presentación** y el gateo salen
del registro automáticamente.

Por qué: antes cada `editor.js` armaba a mano su barra de pestañas y derivaban
(Math no tenía pestañas; otro se quedó sin "Modos"; nombres distintos). Con el
shell **es imposible que un editor "haga lo suyo"** u olvide un modo: todos
heredan el mismo esqueleto y los nombres salen del registro. Un editor nuevo
NO debe construir `nav-tabs` propias — llama a `renderEditorShell`.

La pestaña **"Modos"** (contenido en `core/editorModes.js`) reúne los ajustes de
cada modo, gateada por las **mismas** reglas:
- **VS** (si `isVsCompatible`): animación central + feedback por respuesta
  (sonido/destello/confeti) → `presentation.vsAnimation` / `.vsAnimationSrc` /
  `.vsFeedback` (lo lee `vsView`).
- **Equipos**: nº de equipos y puntuación por defecto → `presentation.teamsCount`
  / `.teamsScoring` (los toma como valores iniciales `teamsView`/`memoryView`).
- **Tarea**: intentos por defecto → `presentation.taskMaxAttempts` (lo usa el
  formulario de creación de tareas). En vivo conserva su propia pestaña.

---

## 4. Contrato de una vista de modo embebido

Cada modo `embed:true` (que no sea solo) expone **dos** entradas, y comparten el
mismo código — no se duplica nada entre "embebido" y "página suelta":

```js
// La que usa la página de actividad (escenario embebido):
export function mountVs(host, activity, ctx, opts = {}) { … return { dispose() {} }; }

// El wrapper de la ruta directa (#/vs/:id), por compatibilidad de deep-links:
export function renderVsView(rootSel, id) {
  const host = typeof rootSel === 'string' ? document.querySelector(rootSel) : rootSel;
  const a = get(id);
  mountVs(host, a, null, { backHref: `#/play/${a.id}` });
}
```

Reglas del contrato `mountX(host, activity, ctx, opts)`:

1. **`host`** es un elemento DOM **o** un selector (usa `mount()`/`on()`, que
   aceptan ambos). Renderiza **dentro de `host`**; **no** tomes `#app` ni
   navegues.
2. Devuelve **`{ dispose() }`**. `dispose()` para animaciones/temporizadores/
   sonidos. La página lo llama antes de cambiar de modo y al salir
   (`ctx.add(...)`). VS, p. ej., destruye su animación central.
3. La pantalla de inicio se pinta con **`renderModeSetup`** (sección 5): no
   inventes tu propia cabecera/botón.
4. **`opts.backHref`**: si viene (ruta suelta a pantalla completa) muestra
   "Volver"/"Salir"; si no (embebido) **no** pongas botón de volver — la barra de
   modos, siempre visible encima del escenario, es el camino de vuelta.
5. El registro engancha la vista con **import dinámico** en `runMode`
   (`core/modes.js`) para que `core/modes.js` siga siendo **puro** (testeable en
   Node sin DOM).

---

## 5. El andamiaje de setup (`renderModeSetup`)

Pinta la **misma** cabecera, subtítulo, área de opciones y botón Empezar para
todos. Tú solo aportas las opciones específicas (`body`) y las lees en `onStart`.

```js
renderModeSetup(host, {
  icon: 'bi-fire', color: 'danger',
  title: 'Duelo VS',
  subtitle: `${a.title} · ${n} preguntas`,
  body: `…inputs de nombres, contador de equipos, toggles…`,
  startLabel: '¡Empezar!',     // opcional
  note: 'texto pequeño bajo el botón', // opcional
  backHref,                    // opcional (solo ruta suelta)
  onMount: (host) => { /* cablea los controles del body */ },
  onStart: () => { /* lee valores y arranca la partida */ },
});
```

No reescribas este chrome en tu vista. Si necesitas un control nuevo común a
varios modos, añádelo al andamiaje, no a una vista suelta.

### 5b. Pantalla de inicio estándar del modo Individual (`views/startScreen.js`)

El modo `solo` NO salta directo al primer ítem: `playerView` monta primero
`renderStartScreen(widget, activity, { frame, onStart })` — una tarjeta estándar
con **Título + Instrucciones + Ajustes** (Sonido, Efectos y, en Tildes/Comas,
"Calibrar pizarra") + botón **Iniciar**, que SIEMPRE entra en pantalla completa
antes de arrancar. Así el alumno no ve el ejercicio antes de empezar.

- Las instrucciones salen de `activity.instructions` → `meta.instructions` de la
  plantilla → texto genérico. **Toda plantilla debe declarar
  `meta.instructions`** (las 12 actuales lo hacen).
- La animación de progreso (carril `#ww-solo-anim`) y el player real se montan
  en `onStart`, no antes.

### 5c. Política de maquetación del panel VS (`meta.panelFit`)

Cada plantilla **declara** cómo debe tratarse su contenido dentro del panel VS;
`vsView` pone la clase `ww-fit-<modo>` en `.vs-body` y `styles/vs.css` resuelve
cada caso en un solo sitio (nada de olfatear la estructura con `:has`):

| Valor | Comportamiento | Ejemplo |
|---|---|---|
| `fill` (defecto) | el contenido **llena** el panel y se escala para caber | Tildes/Comas (fitPassage), Quiz |
| `block` | **bloque único** indivisible: tamaño natural, centrado, con tope — no se estira | la calculadora de Operaciones |
| `center` | tamaño natural, centrado, sin llenar | contenido pequeño |

Regla asociada: con la animación central apagada (`vs-no-stage`) el grid usa UNA
sola fila a `1fr` — los paneles llenan el alto (el bug de Tildes VS cortado
venía de heredar las dos filas del layout vertical). En plantillas de texto
(`contentModel: 'textCorrection'`) la animación central va **apagada por
defecto** (el texto necesita el ancho); `presentation.vsAnimationOff` la fuerza.

---

## 6. Cómo se monta en la página (resumen de `playerView.js`)

- El escenario es `#ww-player-widget`, dentro de `#ww-frame`.
- `modeBarHtml(playActivity())` pinta la barra desde `availableModes(...)`.
- `selectMode(id)`: `dispose()` del anterior → resalta el botón activo → expande
  el marco (`#ww-frame.is-expanded`) si el modo no es `solo` → `runMode(...)`.
- El tema (skin/fondo) se aplica a `#ww-frame`, así que vale para **todos** los
  modos embebidos sin esfuerzo extra.

---

## 7. Receta: añadir un MODO nuevo

1. Añade una entrada a `MODE_DEFS` en `core/modes.js` (`id, label, icon, color,
   embed, isAvailable`, y `href` si `embed:false`).
2. Si es `embed:true`, añade su rama en `runMode` (import dinámico de la vista).
3. La vista exporta `mountX(host, activity, ctx, opts)` y usa `renderModeSetup`.
4. (Opcional) ruta suelta `#/x/:id` → wrapper `renderXView` que llama a `mountX`
   con `backHref`.
5. Añade un caso a `tests/modes.test.mjs` para fijar su gateo.

No toques `playerView.js`: la barra se regenera sola.

---

## 8. Receta: que una PLANTILLA nueva ofrezca cada modo

Esto es lo que hace que **una actividad nueva no haga lo que quiera**: el modo
que ofrece depende **solo** de lo que la plantilla declara/implementa.

| Para que aparezca… | La plantilla debe… |
|---|---|
| **Individual** | nada (siempre) — implementa `renderPlayer` |
| **VS** y **Equipos‑auto** | `scoreSubmission(...)` **y** `renderRound(root, payload, {onSubmit})` (y ≥2 ítems para VS) |
| **Equipos‑juez** | nada extra — el docente marca ✓/✗ sobre cualquier contenido |
| **En vivo** | `meta.modes.live = true` **+** `getRoundPayload` **+** `scoreSubmission` (lo valida `registry.js` al arrancar) |
| **Tarea** | `meta.modes.async = true` |

Detalles del contrato de plantilla en `templates/HOW_TO_ADD.md` y `templates/base.js`.
El registro (`core/registry.js`) **falla ruidosamente** al arrancar si declaras
`modes.live` sin los métodos necesarios — así no descubres el fallo a mitad de
una clase en vivo.

---

## 9. Reglas de juego de cada modo — FICHAS + ESCENARIOS (documento de estudio)

> **Para qué es esta sección.** No es solo referencia: es el material para
> **decidir el diseño** de cada modo. Cada modo tiene (a) una **ficha** con las
> cinco preguntas que definen un modo, (b) **escenarios Gherkin** del
> comportamiento REAL de hoy —cada uno con el test que lo fija—, y (c) las
> **decisiones de diseño abiertas**, planteadas como preguntas con opciones.
>
> Regla de oro: **si un escenario de aquí no coincide con el código, uno de los
> dos está mal — y el test dice cuál.** Si cambias una regla, cambia el
> escenario Y su test en el mismo commit.

### 9.0 Las cinco preguntas que definen un modo

Todo modo debe responderlas explícitamente. Cuando una queda implícita, aparece
un bug: el VS cortaba al rival porque "quién decide el fin" vivía en una vista
en vez de declararse; la Tarea guardaba doble porque "qué persiste" era un
`if` suelto.

| # | Pregunta | Dónde se responde HOY |
|---|---|---|
| 1 | **¿Quién puntúa?** | `T.scoreSubmission` (uno por plantilla), vía `autoScore` en el kernel |
| 2 | **¿Quién decide el fin?** | El kernel, leyendo `meta.play` de la plantilla |
| 3 | **¿Qué persiste?** | `core/persistPolicy.js` (cuadro único) |
| 4 | **¿Qué reloj usa?** | `core/soloTimer.js` (duración) · `core/deadlineTicker.js` (hasta un instante / ascendente) |
| 5 | **¿Hay identidad de alumno?** | Determina si el resultado es atribuible (y por tanto si tiene sentido guardarlo) |

---

### 9.1 Individual (solo)

| | |
|---|---|
| **Puntúa** | La plantilla (`T.scoreSubmission`), acumulado por el shell |
| **Termina** | El shell, al agotar los ítems (o `ctx.finish()` del core) |
| **Persiste** | `results` — es el único modo con historial propio |
| **Reloj** | `createCountdown` (`rules.timer`, por ítem) — opcional |
| **Identidad** | El propio dispositivo (anon id) |
| **Reanuda F5** | **Sí** (única con reanudación) |

```gherkin
Escenario: reanudar tras recargar la página
  Dado que juego una actividad en modo Individual
  Y que he respondido el ítem 1 de 3 y llevo 1 punto
  Cuando recargo la página (F5)
  Entonces continúo en el ítem 2
  Y conservo el punto que ya tenía
  # tests/soloPlayer.test.mjs

Escenario: terminar limpia el progreso guardado
  Dado que he terminado una actividad en Individual
  Cuando la vuelvo a abrir
  Entonces empieza desde el ítem 1
  # tests/soloPlayer.test.mjs

Escenario: el techo y el marcador salen del mismo sitio
  Dado que una actividad tiene 4 ítems a 1 punto
  Cuando termino con 3 aciertos
  Entonces la pantalla dice "3 / 4"
  Y el resultado registrado dice lo mismo
  # tests/persistPolicy.test.mjs (defaultMaxScore)
```

**Decisión abierta** — hoy el orden aleatorio (`rules.randomize`) desactiva la
reanudación (al rebarajar, retomar sería incoherente). Alternativa: guardar
también el orden barajado, como ya hace Memoria con su mazo. ¿Merece la pena?

---

### 9.2 VS (duelo, dos en una pantalla)

| | |
|---|---|
| **Puntúa** | `T.scoreSubmission` vía `autoScore` del kernel (`mode: 'vs'`) |
| **Termina** | El kernel, según **`meta.play.vs`** de la plantilla |
| **Persiste** | **Nada** (por diseño: pizarra compartida sin identidad) |
| **Reloj** | Ninguno — **no hay temporizador de pregunta en VS** |
| **Identidad** | Ninguna (dos apodos locales) |

**La política `meta.play.vs` es LA decisión de diseño de este modo:**

| Valor | Cómo acaba | Quién gana | Plantillas hoy |
|---|---|---|---|
| `'race'` | El primero que completa TODO cierra el duelo | Quien terminó primero | Operaciones, Sopa, Ordena las Pelotas |
| `'points'` | Cuando **ambos** terminan | Quien más suma (desempata quien acabó antes) | Quiz, Globos, Emparejar, Tildes, Comas |
| `'none'` | No se juega en VS | — | Memoria, Ruleta, Crucigrama, Diagrama, Pregunta en vivo |

```gherkin
Escenario: 'points' — acabar primero NO corta al rival
  Dado un Quiz en VS (meta.play.vs = 'points')
  Y que Ana ha respondido las 4 preguntas
  Cuando Beto responde su pregunta 1
  Entonces se acepta su respuesta
  Y el duelo sigue en curso
  # tests/sessionEngine.test.mjs

Escenario: 'points' — gana quien más suma
  Dado que ambos han terminado
  Cuando se calcula el resultado
  Entonces gana quien tiene más puntos
  Y si empatan, gana quien terminó antes

Escenario: 'race' — el primero cierra
  Dado Operaciones en VS (meta.play.vs = 'race')
  Cuando Ana completa todos los ítems
  Entonces el duelo termina de inmediato
  Y Beto ya no puede responder
  # tests/sessionEngine.test.mjs
```

**Decisiones abiertas del VS** (pedidas por QA, sin implementar):

1. **¿Simultáneo con temporizador?** Hoy cada lado va a su ritmo sobre la misma
   secuencia. La propuesta de QA para pizarra: *ambos ven la MISMA pregunta a la
   vez · temporizador visible · se espera a ambos o al fin del tiempo · tras cada
   ronda se muestran respuesta correcta, puntos y marcador · el ganador se
   anuncia solo al final*. Eso es un **tercer valor de `play.vs`**
   (p.ej. `'rounds'`), no un cambio de los dos existentes.
2. **¿Debería el VS dejar historial?** Hoy no persiste porque no hay identidad
   ni vista que lo lea. Si se quiere, el orden correcto es: primero la vista en
   Reportes, después `results: true` en `core/persistPolicy.js`.
3. **¿Temporizador por pregunta?** No existe en VS. `rules.timer` solo lo
   respeta Individual.

---

### 9.3 Equipos (por turnos, una pantalla)

| | |
|---|---|
| **Puntúa** | `autoScore` (modo *automático*) o el **docente** (modo *juez*, ✓/✗) |
| **Termina** | La vista, al agotar las rondas (`session.totalItems`) |
| **Persiste** | **Nada** (por diseño, igual que VS) |
| **Reloj** | Ninguno — **no hay tiempo límite por turno** |
| **Identidad** | Ninguna (equipos con nombre local) |

```gherkin
Escenario: todos los equipos responden lo mismo
  Dado una actividad con 5 ítems y 2 equipos
  Cuando empieza la partida
  Entonces se juegan 4 rondas (múltiplo del nº de equipos)
  Y cada equipo responde exactamente 2 veces
  # tests/sessionEngine.test.mjs — un impar dejaba a un equipo con una de más

Escenario: el turno rota al avanzar
  Dado que es el turno del Equipo 1
  Cuando el docente pulsa "Siguiente"
  Entonces el turno pasa al Equipo 2

Escenario: cualquier contenido se puede jugar en equipos
  Dado una plantilla SIN autocorrección
  Cuando el docente elige "Juez docente"
  Entonces marca ✓/✗ sobre lo que el equipo respondió en voz alta
  # tests/sessionEngine.test.mjs
```

**Decisiones abiertas de Equipos** (las tres que reportó QA):

1. **Memoria por equipos — mecánica propia.** Spec propuesta: *acierto = punto y
   REPITE turno; fallo = las cartas se ocultan y pasa el turno; gana quien más
   parejas*. Hoy Memoria tiene su propio motor (`kernel/session/memory.js`) que
   ya repite turno al acertar, **pero suma +1 fijo** ignorando la configuración
   de puntos. ¿Unificar ese motor con `createTeamsSession`?
2. **¿Robo (steal)?** Para Quiz: si el equipo del turno falla, ¿el otro puede
   robar la pregunta por 1 punto? No existe hoy.
3. **¿Tiempo límite por turno (p.ej. 15 s)?** No existe hoy.
4. **Sopa y Ordena las Pelotas en equipos.** Declaran `play.teams: 'board'`
   (tablero compartido), pero el flujo actual es de turnos pregunta→revelar, que
   no encaja: Sopa reparte el tablero completo en cada turno y Ordena exige
   resolver el puzle para poder "Revelar". **La política ya está declarada; falta
   que la vista la respete** (o retirarles el modo hasta entonces).

> Las tres primeras son **la misma máquina** con parámetros distintos
> (`repiteAlAcertar`, `permiteRobo`, `segundosPorTurno`). Construirla una vez y
> parametrizarla es preferible a tres mecánicas artesanales.

---

### 9.4 En vivo (host + móviles)

| | |
|---|---|
| **Puntúa** | El **host** al liquidar (`settle`) — el alumno NO puntúa |
| **Termina** | El docente (o el temporizador, según `advanceMode`) |
| **Persiste** | `live_answers` (una fila por alumno/ítem) + estado de la sala |
| **Reloj** | `startDeadlineTicker` — cuenta hasta el instante que fija el host |
| **Identidad** | Apodo por sala (`live_players`, único por sala) |

```gherkin
Escenario: el alumno no se puede auto-puntuar
  Dado que respondo desde el móvil
  Cuando envío mi respuesta
  Entonces se guarda SIN veredicto
  Y solo el host le pone puntos al liquidar la pregunta
  # kernel/session/engine.js (settle) — política anti-trampa

Escenario: una respuesta rezagada no se pierde
  Dado que mi respuesta llega después de liquidarse su pregunta
  Cuando el docente cierra la sala
  Entonces esa respuesta se liquida también
  # tests/liveLocal.test.mjs

Escenario: 30 alumnos entran a la vez
  Cuando 30 alumnos se unen simultáneamente
  Entonces hay 30 filas de jugador y 30 apodos únicos
  # core/stressTest.js — verificado en la Pi real con 50
```

**Deuda conocida de Live** (no es decisión de diseño, es arreglo pendiente):
en **modo carrera** el alumno SÍ puntúa en su propio dispositivo
(`studentLive.js`), rompiendo la política anti-trampa de arriba. Y los puntos
manuales de *Pregunta en vivo* (+10/+50) no pasan por la fórmula de puntos.

---

### 9.5 Tarea (asíncrona)

| | |
|---|---|
| **Puntúa** | El shell Individual (la plantilla) |
| **Termina** | El shell, al agotar los ítems |
| **Persiste** | `assignment_attempts` — y **NUNCA** `results` a la vez |
| **Reloj** | El del shell Individual (`rules.timer`) |
| **Identidad** | Apodo + id anónimo del dispositivo |
| **Reanuda F5** | **No** — recargar debe ser un intento limpio |

```gherkin
Escenario: una entrega deja UN solo registro
  Dado que termino una tarea
  Entonces se registra un intento en assignment_attempts
  Y NO se escribe ninguna fila en results
  # tests/persistPolicy.test.mjs — antes se guardaba en los dos sitios

Escenario: recargar no continúa el intento
  Dado que voy por la mitad de una tarea
  Cuando recargo la página
  Entonces empiezo un intento limpio

Escenario: el gateo decide quién puede entregar
  Dado una tarea cerrada, vencida o sin intentos disponibles
  Cuando intento abrirla
  Entonces veo el motivo y no puedo jugar
  # core/assignmentRules.js (assignmentGate) — puro y testeado
```

**Decisión abierta** — `max_attempts` nulo se interpreta como **1 intento**
(no ilimitado). Los dos drivers guardan siempre un número, así que hoy no
ocurre; queda escrito para que nadie lo "arregle" al revés.

---

### 9.6 Cuadro comparativo (las cinco preguntas, de un vistazo)

| | Individual | VS | Equipos | En vivo | Tarea |
|---|---|---|---|---|---|
| **Puntúa** | plantilla | plantilla (kernel) | plantilla o docente | host al liquidar | plantilla |
| **Fin** | agotar ítems | `meta.play.vs` | agotar rondas | el docente | agotar ítems |
| **Persiste** | `results` | nada | nada | `live_answers` | `assignment_attempts` |
| **Reloj** | duración (opcional) | ninguno | ninguno | hasta deadline | duración (opcional) |
| **Identidad** | dispositivo | ninguna | ninguna | apodo por sala | apodo + dispositivo |
| **Reanuda F5** | sí | no | no | no (lo marca el host) | no |
| **`rules.timer`** | ✅ | ❌ | ❌ | ❌ (usa el del host) | ✅ |
| **`rules.randomize`** | ✅ | ❌ | ❌ | ❌ | ✅ |

> **Lo que este cuadro revela** (material de decisión): `rules.timer` y
> `rules.randomize` los configura el docente en el editor creyendo que aplican
> al juego, pero **solo funcionan en Individual y Tarea**. O se respetan en
> todos los modos, o el editor debe decir en cuáles aplican.

---

### 9.7 Invariantes (esto no se negocia)

- Una vez `status === 'ended'`, `answer()` / `dispatch()` rechazan más jugadas.
  Las vistas deben ignorar toques tardíos en la ventana de feedback.
- **Un solo scorer por plantilla**: ningún modo —ni el player Individual—
  reimplementa el conteo. Vigilado por `tests/scoringSources.test.mjs`.
- **Ningún modo escribe dos veces**: `results` y `assignment_attempts` son
  excluyentes. Vigilado por `tests/persistPolicy.test.mjs`.
- **Ningún `setInterval` a pelo** en un modo: hay tres primitivos de reloj.
- Un modo desconocido **no guarda nada** (fail-safe).
