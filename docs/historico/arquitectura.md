# Arquitectura de la app — Referencia completa

> Versión 1.51.9 · Vanilla JS ES Modules · Sin bundler · Bootstrap 5 via CDN

> ⚠️ **Nota:** algunas secciones de abajo (flujo LIVE, Edge Functions, "supabase =
> producción") son ANTERIORES a la migración a PocketBase. El backend de
> producción es **PocketBase** (`pb.lanube.uno`); **Supabase fue retirado** y la
> plantilla **Froggy eliminada**. Para el estado actual, la fuente de verdad es
> `CLAUDE.md` en la raíz del repo.

---

## 1. Principios de diseño

La app sigue el modelo de **Wordwall**: contenido, plantilla y presentación son ejes
completamente independientes.

```
Contenido  →  "10 preguntas de biología"
Plantilla  →  Quiz / Emparejar / Rueda / …
Presentación → skin (colores) + fondo (textura)
Modo de juego → Solo / VS / Equipos / En vivo / Tarea
```

Cualquier combinación de estos cuatro ejes es válida. Cambiar la plantilla reutiliza
el contenido sin modificarlo. Cambiar el skin o el fondo no toca nada más.

---

## 2. Entradas al sistema (HTML pages)

| Archivo | Usuario | Descripción |
|---|---|---|
| `index.html` → `main.teacher.js` | Profesor | SPA principal: crear, editar, jugar, lanzar en vivo |
| `student.html` → `main.student.js` | Alumno | Unirse a sala live o abrir tarea asignada |
| `embed.html` → `main.embed.js` | Embed externo | Actividad embebida en iframe (solo modo Solo) |
| `tools/test.html` | Dev | Suite de tests en el navegador |

Cada entrada registra sus rutas de hash (`#/home`, `#/edit/:id`, …) y hace boot.

---

## 3. Árbol de directorios y responsabilidades

```
ac/
│
├── core/                 ← Módulos de infraestructura (sin lógica de negocio específica)
│   ├── html.js           tagged-template builder + mount() + escapeHtml()
│   ├── events.js         Delegación de eventos. on() idempotente por (root,ev,sel)
│   ├── router.js         Hash-router de la SPA (matchRoute, navigate, start)
│   ├── routing.js        Lógica pura de routing testeable en Node
│   ├── lifecycle.js      Rastreador de recursos por vista. acquire(key) + ctx.add()
│   ├── storage.js        Capa de persistencia: localStorage + sync con remote
│   ├── storageMerge.js   Merge local vs remote (last-write-wins por updatedAt)
│   ├── migrate.js        Migración de esquema de actividad v1→v4 + normalize()
│   ├── registry.js       Registro de plantillas. registerTemplate() + getTemplate()
│   ├── modes.js          Catálogo de modos (Solo/VS/Equipos/Live/Tarea) y gating
│   ├── modeMatrix.js     Qué modo soporta cada plantilla (matriz)
│   ├── presentation.js   ◀ NUEVO: applyScene() + resetScene() — capa de tema central
│   ├── skins.js          Registry de skins. registerSkin() + getSkin() + applySkin(name, target?)
│   ├── backgrounds.js    Catálogo de fondos + applyBackground(name, target?, imageUrl?). Incluye 'custom' (imagen subida)
│   ├── activityThumb.js  Miniatura live 16:10 (DOM escalado, skin+fondo scoped)
│   ├── player.js         Wrapper: runPlayer(sel, activity, opts). Aplica tema global
│   ├── editorShell.js    Chasis compartido de todos los editores (pestañas, preview)
│   ├── editorModes.js    Panel "Modos" dentro del editor Shell
│   ├── editorPrimitives.js Controles de ítem reutilizables (subir/bajar/eliminar)
│   ├── imagePicker.js    Picker de imágenes para ítems del editor
│   ├── ls.js             Wrapper seguro de localStorage (nunca crashea en privado)
│   ├── toast.js          Sistema de notificaciones + confirmModal()
│   ├── effects.js        Confeti (canvas propio, sin CDN)
│   ├── sounds.js         Sonidos de juego + isMuted/setMuted
│   ├── tts.js            Text-to-speech (opcional)
│   ├── fullscreen.js     Toggle fullscreen del frame del juego
│   ├── gameEvents.js     Bus de eventos de juego (correcto/error/fin) para efectos
│   ├── liveTransport.js  Facade de transporte LIVE — oculta backend (local/supabase)
│   ├── livePhases.js     Máquina de fases LIVE (lobby→pregunta→reveal→leaderboard)
│   ├── results.js        Guardar resultados de partida
│   ├── resultScreen.js   Pantalla de fin de partida (HTML compartido)
│   ├── roundRender.js    Renderizado de opciones (shuffle, grids)
│   ├── podium.js         HTML del podio (Live final)
│   ├── streaks.js        Bonus por rachas de aciertos
│   ├── submitQueue.js    Cola de respuestas offline para modo Live
│   ├── nicknameFilter.js Validación de apodos de alumnos
│   ├── teams.js          Lógica de turnos de equipos
│   ├── textMarks.js      Sistema de marcas de tildes/comas
│   ├── textCorrectionRound.js Ronda de corrección de texto (tildes/comas Live)
│   ├── io.js             Importar/exportar actividades en JSON
│   ├── auth.js           Autenticación (PocketBase email/password)
│   ├── identity.js       ID anónimo de visitante (para stats)
│   ├── state.js          Estado global mínimo (anonId)
│   ├── connection.js     Monitor de conectividad online/offline
│   ├── errorLog.js       Captura de errores no manejados (log local)
│   ├── upload.js         Convierte imágenes a data-URL inline (sin storage externo)
│   ├── vsAnimations.js   Animaciones VS (SVG propio + Lottie opcional)
│   ├── vsAnimStore.js    Registro de animaciones custom (admin)
│   ├── dbDiag.js         Diagnóstico CRUD de BD (usado en admin)
│   ├── selftest.js       Suite de 28 tests in-browser (usada en admin)
│   ├── assignmentRules.js Reglas de tareas (vencimiento, intentos)
│   ├── assignmentsTransport.js Facade de tareas (oculta backend)
│   └── constants.js      VERSION, SCHEMA_VERSION, DEFAULT_* constants
│
├── kernel/               ← Lógica de negocio pura. Sin DOM, testeable en Node
│   ├── session/
│   │   ├── engine.js     ◀ CEREBRO: createSession(activity, {format}) para todos los modos
│   │   └── memory.js     Sesión de Memoria (mecánica de turnos por pares)
│   ├── live/
│   │   └── engine.js     Alias de session/engine para compatibilidad (thin wrapper)
│   ├── content/
│   │   ├── models.js     Catálogo de ContentModels (qa, pairs, entries, textCorrection…)
│   │   ├── index.js      getContentModel(name)
│   │   ├── switch.js     applySwitch() — cambio de plantilla conservando contenido
│   │   ├── convert.js    Conversiones de contenido entre modelos
│   │   └── qaAdapt.js    Adaptador Q&A para conversiones quiz↔math
│   └── contracts/
│       ├── template.js   JSDoc: TemplateContract (lo que debe implementar una plantilla)
│       ├── contentModel.js JSDoc: ContentModel contract
│       ├── dataPort.js   JSDoc: RemoteStore (puerto de persistencia)
│       ├── realtimePort.js JSDoc: RealtimePort (puerto de transporte LIVE)
│       └── index.js      Re-exporta todos los contratos
│
├── templates/            ← Plugins de actividad. Cada uno es autocontenido
│   ├── base.js           Clase base (documentación, no instanciada)
│   ├── quiz/             Preguntas de opción múltiple
│   │   ├── index.js      registerTemplate(QuizTemplate) — punto de entrada
│   │   ├── template.js   Clase QuizTemplate (meta + métodos estáticos)
│   │   ├── editor.js     renderQuizEditor() → llama a editorShell
│   │   ├── player.js     renderQuizPlayer() — la partida en sí
│   │   └── scorer.js     scoreQuizSubmission() puro (testeable en Node)
│   ├── match/            Emparejar columnas
│   ├── memory/           Memoria (voltear pares)
│   ├── math/             Matemáticas (generación de operaciones)
│   ├── tildes/           Corrección de tildes en texto
│   ├── comas/            Corrección de comas en texto
│   └── wheel/            Ruleta (sorteo/pregunta aleatoria)
│       └── logic.js      lógica de la ruleta separada del render
│
├── views/                ← Vistas SPA (montan en #app, usan lifecycle)
│   ├── home.js           Lista de actividades con filtros y miniaturas live
│   ├── templateSelector.js Selector de plantilla al crear nueva actividad
│   ├── editView.js       Contenedor del editor (barra superior + autosave)
│   ├── switchTemplate.js Lógica "cambiar formato" (Wordwall-style)
│   ├── playerView.js     Página de actividad: frame + modos + pickers de tema
│   ├── hostLive.js       Vista del anfitrión (sala en vivo)
│   ├── studentLive.js    Vista del alumno (sala en vivo + unirse)
│   ├── studentTask.js    Vista alumno para tarea asignada
│   ├── vsView.js         Modo duelo 1vs1 (animación + dos tableros)
│   ├── teamsView.js      Modo equipos (turno a turno, juez)
│   ├── memoryView.js     Modo equipos especial para Memoria
│   ├── modeSetup.js      Pantalla de configuración antes de iniciar modo
│   ├── assignments.js    Gestión de tareas (profesor)
│   ├── reports.js        Reportes de resultados
│   ├── explore.js        Banco de actividades públicas
│   ├── sorteoView.js     Sorteo/ruleta rápida (sin actividad)
│   ├── embedModal.js     Modal de embed (código iframe)
│   ├── authView.js       Badge de autenticación (navbar)
│   └── adminView.js      Panel admin: tests, diagnóstico BD, animaciones custom
│
├── adapters/             ← Implementaciones de los puertos (DataPort / RealtimePort)
│   ├── index.js          Selector de backend: local | pocketbase  (Supabase retirado)
│   ├── local/            Backend en memoria (desarrollo offline)
│   │   ├── remoteStore.js
│   │   ├── realtime.js
│   │   └── assignments.js
│   └── pocketbase/       Backend PRODUCCIÓN (Raspberry Pi 5, pb.lanube.uno)
│       ├── remoteStore.js (actividades + resultados)
│       ├── realtime.js    (live: subscribeRoom, submitAnswer…)
│       └── assignments.js (tareas)
│
├── themes/               ← Skins externos. Cada carpeta es un skin autocontenido
│   └── colegios/
│       └── skin.css      Overrides VS school (barra TV, device panels, keypad per-side)
│
├── styles/               ← CSS base de actividades y chrome (estructura + vars con defaults)
│   ├── theme.css         Variables CSS globales + reglas base
│   ├── skins.css         Reglas de skin → body.skin-X y .ww-player-frame.skin-X
│   ├── backgrounds.css   Reglas de fondo → body.bg-X y .ww-player-frame.bg-X
│   ├── player.css        Layout del frame de juego (.ww-play-page, .ww-player-frame)
│   ├── editor.css        Layout del editor y tiles de picking
│   ├── live.css          Pantalla grande del anfitrión; colores de opciones → --ww-shape-*
│   ├── vs.css            Layout VS (clásico + base); skins viven en themes/*/skin.css
│   ├── teams.css         Layout de turnos de equipos
│   ├── quiz.css          Estilo de la grilla un concurso
│   ├── match.css         Tablero de pares de emparejar
│   ├── memory.css        Tablero de cartas de memoria
│   ├── math.css          Keypad matemático; propiedades visuales → CSS vars (--key-*, --display-*)
│   ├── review.css        Pantalla de revisión de respuestas
│   ├── textCorrection.css Texto con marcas de tildes/comas
│   └── touch.css         Mejoras táctiles (botones más grandes en móvil)
│
└── tests/                ← Tests de Node (no requieren DOM)
    ├── run.mjs           Corre todos los suites
    ├── presentation.test.mjs ← invariante anti-leak de temas
    ├── stability.test.mjs    ls.js, html.js, pbFetch
    ├── simPlay.test.mjs      Simulación VS y Live con bots
    └── … (25 suites en total)
```

---

## 4. Modelo de datos de una Actividad

```js
{
  id:              "abc123xyz",        // 15 chars alphanum
  title:           "Capitales de Europa",
  subtitle:        "",
  template:        "quiz",             // nombre del plugin
  templateVersion: 1,                 // para migraciones de contenido
  schemaVersion:   4,                 // migración global del esquema
  visibility:      "private",         // private | unlisted | public
  tags:            ["geografía"],
  language:        "es",
  updatedAt:       "2026-06-20T…",
  forkOf:          null,
  author:          { id, name, signedAt },
  likes:           0,                 // placeholder sistema de usuarios
  _unsynced:       true,              // flag temporal si el remote falló

  // ── Contenido (forma depende del template) ──
  content: {
    items: [                          // quiz, math, tildes, comas
      { id, question, answer, options[], points, image, audio }
    ],
    pairs: [ { id, left, right } ],   // match, memory
    entries: [ { id, label } ],       // wheel
    passages: [ { id, text, marks } ] // tildes, comas (corrección de texto)
  },

  // ── Configuración modular ──
  rules:        { timer, randomize, shuffleOptions, … },
  scoring:      { mode, pointsPerCorrect, pointsPerWrong, … },
  review:       { allowOverride, showCorrectAnswer, autoAdvanceToSummary, … },
  live:         { advanceMode, questionTimer, lockAnswersOn, maxPlayers, … },
  presentation: { skin, background, vsAnimation, vsAnimationSrc }
}
```

---

## 5. El sistema de capas de presentación (temas)

### 5a. Ejes y scope

La presentación tiene **dos ejes independientes** que se aplican mediante clases CSS.
Ambos entienden scope: global (body) o restringido a un elemento (frame, miniatura,
preview del editor).

```
presentation.js  ← punto de entrada único para las vistas
    │
    ├── skins.js      applySkin(name, target?)
    │     ├── styles/skins.css          body.skin-X  /  .ww-player-frame.skin-X
    │     └── themes/<name>/skin.css    cargado dinámicamente desde el manifiesto
    └── backgrounds.js applyBackground(name, target?)
          └── styles/backgrounds.css    body.bg-X  /  .ww-player-frame.bg-X
```

**Regla crítica:** un apply *scoped* (con `target`) **jamás** toca `<body>`.
Un apply global (sin target) **jamás** toca un elemento específico.
Esto impide que el tema de la actividad "pinte" el chrome de la página.

```
applyScene(activity, ctx)               → tema la PÁGINA (vistas fullscreen)
applyScene(activity, ctx, {target:frame}) → tema solo el FRAME (playerView)
resetScene(target?)                     → restaura skin-default + bg-none
```

### 5b. Registry de skins (`core/skins.js`)

Los skins se **registran**, no se hardcodean en un objeto. El patrón es idéntico al
de las plantillas (`registerTemplate`):

```js
// Registrar un skin (desde cualquier módulo, sin tocar core/skins.js)
import { registerSkin } from '../../core/skins.js';
registerSkin({
  name:       'futbol',
  label:      'Fútbol',
  vsLayout:   'school',                    // layout VS que usar
  stylesheet: 'themes/futbol/skin.css',    // CSS propio (opcional)
  cssVars: {                               // tokens del contrato
    '--ww-bg': '#1a472a',
    '--key-radius': '50%',
    // …
  }
});
```

`applySkin('futbol', frame)`:
1. Aplica `cssVars` como estilos inline en el target (mayor prioridad que `:root`).
2. Agrega clase `skin-futbol` al target.
3. Si el manifiesto declara `stylesheet`, inyecta un `<link id="skin-css-futbol">`.

**Para agregar un skin sin tocar ningún archivo del core:**
1. Crear `themes/miskin/index.js` con `registerSkin({…})`
2. Crear `themes/miskin/skin.css` (opcional) con overrides CSS
3. Importar `themes/miskin/index.js` desde `themes/index.js`

### 5c. Token Contract — CSS vars del contrato

Las actividades leen **CSS vars con defaults** en lugar de valores hardcodeados.
Skins solo necesitan declarar lo que cambian. El contrato completo está documentado
como comentario al tope de `core/skins.js`.

| Grupo | Variables | Ejemplo |
|---|---|---|
| **Global** | `--ww-bg`, `--ww-fg`, `--ww-card-bg`, `--ww-shape-1..4`, `--ww-success/danger` | colores base + formas |
| **Keypad** | `--key-bg`, `--key-fg`, `--key-radius`, `--key-border`, `--key-cols`, `--key-shadow`, `--display-bg`… | teclado matemático |
| **VS Panel** | `--panel-bg`, `--panel-glow`, `--panel-radius`, `--bar-team-l/r`, `--badge-bg` | duelo VS |

### 5d. Layouts VS (`vsLayout`)

El skin declara qué estructura HTML usa el duelo VS:

| `vsLayout` | Descripción |
|---|---|
| `'classic'` (default) | Paneles laterales full-height, bar de 68px |
| `'school'` | Dispositivos flotantes, barra 80px estilo TV, CSS en `themes/colegios/skin.css` |

`vsView.js` lee `getSkin(skin)?.vsLayout \|\| 'classic'` — ningún nombre de skin
está hardcodeado en el código JS.

---

## 6. Router y lifecycle

```
location.hash  →  router.js (hashchange)
                     │
                     ├── matchRoute() → llama al handler de la ruta
                     │
                     └── disposeEverything() (lifecycle.js)
                              │
                              └── cada vista había registrado ctx.add(cleanup)
                                  → intervals, subscriptions, skins, eventos
```

Una vista típica:
```js
const ctx = acquire('miVista');        // limpia el montaje anterior
ctx.add(() => clearInterval(t));       // registra cleanup
ctx.add(unsubscribeRoom);
ctx.setInterval(tick, 1000);           // shorthand que auto-registra cleanup
applyScene(activity, ctx);             // tema + cleanup automático en teardown
```

---

## 7. Backend y adaptadores

```
adapters/index.js   (selector de backend)
    │
    ├── local      memoria RAM, offline-first, para desarrollo
    ├── pocketbase Raspberry Pi 5 en pb.lanube.uno (solo actividades, no Live)
    └── supabase   Producción: PostgreSQL + Realtime + Edge Functions
```

Selección automática:
1. `?backend=pocketbase` en la URL (persiste en localStorage)
2. `localStorage['ww.backend']`
3. `localhost` / `127.0.0.1` → `local`
4. Cualquier otro host → `pocketbase`

Cambio en runtime (consola): `ww.setBackend('local')`

---

## 8. Flujo: Crear actividad

```
Usuario                   App
  │                         │
  ├── click "+ Nueva"       │
  │   hash → #/new          │
  │                         ├── renderTemplateSelector()
  │                         │     muestra tarjetas de plantilla
  │
  ├── elige plantilla       │
  │   hash → #/edit-new/quiz│
  │                         ├── renderEditView(APP, { template: 'quiz' })
  │                         │     newActivity('quiz')       ← migrate.js / normalize()
  │                         │     Editor.render(root, a, onChange)
  │                         │        └── renderEditorShell(root, a, onChange, spec)
  │                         │              pestañas: Contenido · Puntuación · Modos
  │                         │                        En vivo · Presentación
  │                         │              ┌ tab Presentación:
  │                         │              │   mini-preview #pres-preview (scoped)
  │                         │              │   skin pickers → applySkin(name, preview)
  │                         │              └   bg pickers   → applyBackground(name, preview)
  │
  ├── escribe contenido     │
  │   (inputs, add-item…)   ├── onChange(a) → markDirty()
  │                         │                  autosave 2s → save(a)
  │                         │                    localStorage inmediato
  │                         │                    remoteSave(a) en background
  │
  ├── click Guardar         ├── doSave(false) → setState('Guardado')
  │
  └── click Probar          ├── doSave(true) → navigate('#/play/id')
                            └── (flujo de edición → flujo de juego)
```

### El autosave

```
onChange(a)
  → activity = a
  → markDirty()
      dirty = true
      setState('Cambios sin guardar')
      clearTimeout(autosaveTimer)
      autosaveTimer = ctx.setTimeout(doSave, 2000)

doSave()
  → save(activity)                 ← core/storage.js
      normalize({ ...a, updatedAt })
      localStorage.setItem(...)    ← inmediato, síncrono
      remoteSave(a)                ← async, en background
          getRemoteStore()         ← adapters/index.js elige backend
          rs.saveActivity(a)
      .then()  → quita _unsynced
      .catch() → pone _unsynced = true
```

---

## 9. Flujo: Editar actividad existente

```
Usuario                   App
  │                         │
  ├── click Editar (card)   │
  │   hash → #/edit/abc123  │
  │                         ├── renderEditView(APP, { id: 'abc123' })
  │                         │     get('abc123') → localStorage → migrate() → normalize()
  │                         │     getEditor('quiz') → QuizTemplate.renderEditor
  │                         │     mount barra superior (visibilidad, tags, idioma)
  │                         │     mount #editor-root
  │                         │     Editor.render(root, activity, onChange)
  │
  ├── cambia plantilla      ├── buildSwitchOptions(activity)
  │   (Cambiar formato)     │     compatibleTemplates() → mismo contentModel
  │                         │     kernel/content/switch.js → applySwitch()
  │                         │       direct: mismo contenido
  │                         │       convert: adoptContent() adapta los ítems
  │                         │     navigate('#/edit/abc123') → re-renderiza editor limpio
  │
  ├── cambia skin/fondo     │     editorShell click .skin-pick / .bg-pick
  │   (tab Presentación)    │       a.presentation.skin = name
  │                         │       onChange(a)  → autosave
  │                         │       applySkin(name, #pres-preview)  ← SCOPED, no toca página
  │
  └── descarga JSON         ├── downloadActivitiesJson([activity.id])
                            └── (botón en barra de guardado, también en Home)
```

---

## 10. Flujo: Jugar actividad (modo Solo / VS / Equipos)

```
hash → #/play/id  (o #/vs/id, #/teams/id)
  │
  └── renderPlayerView(APP, id, initialMode='solo')
        get(id) || getRemote(id)     ← storage.js
        acquire('playerPage')
        resetScene()                 ← page chrome neutral
        ctx.add(() => resetScene())  ← restaura al salir
        paint()
          mount(rootSel, html`...`)
          id="ww-frame"  (div con ratio)
          applyScene(activity, null, { target: frame })  ← scoped al frame
          selectMode('solo')
            runMode('solo', '#ww-player-widget', activity, ctx)
              runPlayer('#ww-player-widget', activity, { skipChrome: true })
                QuizTemplate.renderPlayer('#ww-player-widget', activity, opts)
                  lógica del juego, scoring local, resultScreen al terminar

  ── Cambiar modo ──────────────────────────────────────────────────────
  click .ww-mode[data-mode="vs"]
    selectMode('vs')
      currentDisposer.dispose()     ← limpia modo anterior
      runMode('vs', '#ww-player-widget', activity, ctx)
        vsView.mountVs(host, activity, ctx)
          createSession(activity, { format: FORMATS.VS })
          dos tableros, cada uno llama renderRound + scoreSubmission

  ── Cambiar skin/fondo en playerView ──────────────────────────────────
  click .skin-pick
    currentSkin = name
    applySkin(name, document.getElementById('ww-frame'))  ← SCOPED
  click .bg-pick
    currentBg = name
    applyBackground(name, document.getElementById('ww-frame'))  ← SCOPED
```

---

## 11. Flujo: Modo En vivo (Live — estilo concurso)

```
ANFITRIÓN (teacher.html)                  ALUMNOS (student.html)
──────────────────────────────────────    ────────────────────────────────
hash → #/launch/id
  renderHostLaunch(APP, id)
    createRoom(activity)                  hash → #/join
      liveTransport → getRealtime()         renderJoin()
      supabase: create session row            input PIN + apodo
      genera código PIN de 6 chars
    navigate('#/host/PIN')
                                            click Entrar
                                              joinSession(PIN, nick)
                                              navigate('#/play/PIN')
hash → #/host/PIN                                │
  renderHostByCode(APP, PIN)                     ▼
    findRoomByCode(PIN)                       renderPlay(APP, PIN)
    renderHost(rootSel, PIN, sessId, act)       acquire('studentLive')
      acquire('hostLive')                       applyScene(act, ctx, {defaultSkin:'velocidad'})
      applyScene(act, ctx, {defaultSkin:'velocidad'})
      body.classList.add('ww-stage')            subscribeRoom(sessId, onEvent)
      subscribeRoom(sessId, onEvent)            ─────────────────────────────────
      ──────────────────────────────            FASES (máquina de estados en livePhases.js):
      FASES (máquina de estados):
                                                  LOBBY: espera que el host inicie
      LOBBY: muestra PIN + QR
             listPlayers() polling
             botón Iniciar                        QUESTION: muestra pregunta/opciones
                │                                   submitAnswer() via submitQueue.js
                ▼
      startSession(sessId)                        REVEAL_OWN: muestra si acertó
      → supabase actualiza sessions.phase         (score delta, streak bonus si aplica)

      QUESTION: getRoundPayload(act, ctx)
                (template construye el payload    LEADERBOARD_PEEK: top 5 alumnos
                 con la pregunta SIN respuesta)
                setSessionState({phase:'question',
                  payload, item_index})           ENDED: pantalla final del alumno
                timer countdown

      LOCK: lockAnswersOn
              → setSessionState({phase:'lock'})

      REVEAL: settleItem(sessId, itemIdx)
        → Supabase Edge Function settle-item
          lee todas las respuestas de answers
          llama scoreSubmission() (server-side)
          escribe scores, actualiza leaderboard
        → hostPaintDecision(): muestra respuesta
                               correcta + scores

      LEADERBOARD: muestra top alumnos
                   botón Siguiente

      ENDED: endSession(sessId)
             podiumHtml() con top 3
             tabla de todos los jugadores
```

### Arquitectura del transporte Live

```
views/hostLive.js  ──┐
views/studentLive.js ─┤── core/liveTransport.js (facade)
                       │         │
                       │    adapters/index.js → getRealtime()
                       │         │
                       │    supabase/realtime.js   ← producción
                       │    local/realtime.js      ← desarrollo sin internet
                       │
                       └── supabase/functions/
                               settle-item    ← anti-cheat scoring
                               create-session ← genera PIN y sala
```

---

## 12. Flujo: Tarea asignada (modo Async)

```
PROFESOR                              ALUMNO
────────────────────────────────      ─────────────────────────────────
hash → #/tasks/id
  renderAssignmentsForActivity()
    crear tarea: código, fecha límite,
    máx intentos, nick
    assignmentsTransport.createTask()

                                      hash → #/join → introduce código
                                        findAssignmentByCode(code)
                                        navigate('#/task/CODE')
                                        renderStudentTask(APP, code)
                                          assignmentGate()  ← verifica reglas
                                          runPlayer(sel, activity_snap)
                                            (sin skipChrome → applyScene global)
                                          onFinish: recordAttempt()
```

---

## 13. Sistema de plantillas (plugins)

Cada plantilla es una **clase estática** que cumple `TemplateContract`:

```js
// templates/quiz/template.js
export class QuizTemplate {
  static meta = {
    name: 'quiz',
    label: 'Cuestionario',
    icon: 'bi-question-circle-fill',
    color: 'warning',
    contentModel: 'qa',          // compatibilidad con switch-template
    aspectRatio: '16/10',
    modes: { solo: true, live: true, async: true }
  };

  // Obligatorios
  static renderPlayer(rootSel, activity, opts) { … }
  static renderEditor(root, activity, onChange) { … }

  // Obligatorios si modes.live = true
  static getRoundPayload(activity, ctx)         { … }  // sin respuesta correcta
  static scoreSubmission({ value, item, … })    { … }  // puro, testeable

  // Opcionales
  static renderRound(host, item, activity, opts) { … } // para VS y Equipos
  static migrateContent(content, fromVersion)    { … } // migraciones de esquema
  static adoptContent(content, fromTemplate)     { … } // para switch-template
}
```

**Alta de una nueva plantilla:** solo hay que:
1. Crear `templates/miPlantilla/` con los archivos necesarios
2. Importar y registrar en `main.teacher.js`: `import './templates/miPlantilla/index.js'`
3. `index.js` llama `registerTemplate(MiPlantilla)` → validación automática al boot

---

## 14. Módulos clave y sus contratos

| Módulo | Exporta | Rol |
|---|---|---|
| `core/presentation.js` | `applyScene`, `resetScene` | Único punto para aplicar temas |
| `core/lifecycle.js` | `acquire(key)` | Cleanup automático al navegar |
| `core/storage.js` | `save`, `get`, `list`, `sync` | Persistencia + sync remoto |
| `core/registry.js` | `registerTemplate`, `getTemplate`, `compatibleTemplates` | Catálogo de plugins |
| `core/modes.js` | `runMode`, `availableModes`, `getMode` | Gating y ejecución de modos |
| `core/player.js` | `runPlayer` | Wrapper de juego con tema opcional |
| `kernel/session/engine.js` | `createSession`, `FORMATS` | Cerebro puro de todos los modos |
| `core/liveTransport.js` | `createRoom`, `joinSession`, `subscribeRoom`, … | Facade del transporte Live |
| `adapters/index.js` | `getRemoteStore`, `getRealtime`, `getAssignments` | Selector de backend |
| `core/editorShell.js` | `renderEditorShell` | Chasis compartido del editor |
| `core/activityThumb.js` | `mountThumb` | Miniatura live en tarjeta de home |
| `core/migrate.js` | `migrate`, `normalize` | Esquema de actividad v1→v4 |

---

## 15. Tests

```
node tests/run.mjs        ← corre los 26 suites (todos en Node, sin DOM)
```

Suites por área:
- **Presentación:** `presentation.test.mjs` — invariante de no-leak de temas
- **Estabilidad:** `stability.test.mjs` — ls.js, html.js, pbFetch
- **Motor de sesión:** `sessionEngine.test.mjs`, `simPlay.test.mjs`
- **Modos:** `modes.test.mjs`, `modeMatrix.test.mjs`
- **Live:** `live.test.mjs`, `liveEngine.test.mjs`, `liveLocal.test.mjs`, `liveText.test.mjs`
- **Contenido:** `content.test.mjs`, `qaAdapt.test.mjs`, `render.test.mjs`
- **Adaptadores:** `adapters.test.mjs`, `storageMerge.test.mjs`
- **Específicos:** `wheel.test.mjs`, `memory.test.mjs`, `teams.test.mjs`, `solo.test.mjs`, `scoring.test.mjs`, `textMarks.test.mjs`, `assignments.test.mjs`

---

## 16. Deuda técnica pendiente

| Tema | Detalle |
|---|---|
| PocketBase — campo `preview` | Borrar campo `preview` y archivos `preview_*.jpg` de la colección en la UI de admin de PB (pb.lanube.uno) |
| PocketBase — Live | El transporte LIVE solo funciona con backend `supabase` o `local`; PocketBase aún no implementa `getRealtime()` |
| CSS system | Token Contract implementado en math.css (--key-*, --display-*), froggy.css y live.css (--ww-shape-*). Pendiente: extender a quiz.css, match.css, memory.css |
| Sistema de usuarios | `activity.likes` es un placeholder; el sistema de perfiles/likes está pendiente de implementar |
| `reapply*` | Eliminados en v1.43.0. Si se necesita "restaurar el tema actual sin conocer el nombre", basta con guardar el nombre al aplicar y volver a llamar `applyScene` |

---

*Actualizado: 2026-06-22 · v1.51.9*
