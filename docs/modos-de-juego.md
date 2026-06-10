# Modos de juego — contrato único (léelo antes de tocar un modo o una plantilla)

> Por qué existe este documento: antes, cada modo (VS, Equipos, Memoria)
> improvisaba su propia pantalla de inicio y su propio enganche en la página de
> la actividad, y se desincronizaban (markup distinto, un bug de copia‑pega, un
> gateo duplicado que se quedaba viejo). Ahora hay **una sola fuente de verdad**.
> Si añades una plantilla o un modo nuevo, sigue este contrato y aparecerá en el
> sitio correcto, con el aspecto correcto, **sin improvisar**.

Fecha: 2026-06-08. Verificado contra `core/modes.js`, `views/modeSetup.js`,
`views/playerView.js` y los `views/*View.js`.

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

## 9. Reglas de juego de cada modo (esto es ley)

Cómo se gana en cada modo. La lógica vive en `kernel/session/engine.js`
(`vs`/`teams`/`solo`) y `kernel/session/memory.js`, y está cubierta por
`tests/sessionEngine.test.mjs` / `tests/memory.test.mjs`. **Si cambias una
regla, cambia el test que la fija — no al revés.**

- **VS (duelo)** — es una **carrera en paralelo**: ambos responden la MISMA
  secuencia, cada uno a su ritmo. **El duelo termina en cuanto el PRIMERO
  completa todos los ítems** (no se espera al otro; el perdedor no sigue
  jugando). Gana **quien más puntos tenga** en ese momento (puede haber
  empate). Como ambos recorren la misma secuencia en orden y los puntos no son
  negativos por defecto, el que termina primero suele ir igual o por delante.
- **Equipos (por turnos)** — los equipos se turnan sobre un único flujo de
  preguntas. Termina al agotar los ítems; gana el equipo con más puntos.
  Puntuación **automática** (la plantilla puntúa) o **juez docente** (✓/✗).
- **Memoria (equipos)** — voltear dos cartas: acierto = suma y **repites**
  turno; fallo = pasa el turno. Termina al emparejar todo; gana más parejas.
- **Individual** — cursor puntuado sobre los ítems; sin condición de victoria
  (es práctica personal).

> Invariante de VS/Equipos/Solo: una vez `status === 'ended'`, `answer()` /
> `dispatch()` rechazan más jugadas. Las vistas deben ignorar toques tardíos en
> la ventana de feedback (ver `onAnswer` en `vsView.js`) para no chocar con esa
> ley.
