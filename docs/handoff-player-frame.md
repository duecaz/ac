# HANDOFF — Separación PLAYER ↔ PÁGINA (escena por fase → frame estilo Wordwall)

> Problema (recurrente): el fondo/skin de la ACTIVIDAD se aplica al `<body>` en los
> modos live al MONTAR la vista, así que se come pantallas que NO son juego: el
> LOBBY del host (PIN/QR — la captura del usuario), el podio, el resultado del
> alumno, las esperas. Wordwall no hace esto: el juego vive en un marco; la página
> alrededor es neutra. Estado: **P0 hecho** (parches resetScene en podio/resultado),
> **Etapa 1 y 2 pendientes** — este es el plan para "volver a este problema".

## Hechos verificados (anclas de código)
- `views/hostLive.js:84` y `views/studentLive.js:99`: `applyScene(activity, ctx, …)`
  al montar → tematiza el `<body>` para TODA la vida de la vista (incluido el lobby).
- **Ambas vistas tienen UN enrutador de fases `paint()`** (hostLive ~línea 153,
  studentLive ~122) que decide qué pantalla pintar. Esa es LA costura: ahí se sabe
  si lo que viene es juego o chrome.
- El modo **solo** (`views/playerView.js`) ya hace lo correcto: aplica skin/fondo al
  frame `#ww-frame`, no al body. `styles/backgrounds.css` ya define `body.bg-*` **y**
  `.ww-player-frame.bg-*`. `applyScene(activity, null, {target})` ya acepta target.

## Clasificación de pantallas (la tabla de la verdad)

| Vista | Pantalla | ¿Juego o chrome? | Fondo |
|---|---|---|---|
| host | `paintLobby` (PIN/QR) | **chrome** | neutro |
| host | `paintQuestion` / `paintReveal` / `paintRace` / `paintLiveBoardHost` / `paintQuestionLive` | juego | actividad |
| host | `paintLeaderboard` (entre preguntas) | juego (flujo Kahoot) | actividad |
| host | `paintPodium` (ended) | **chrome** | neutro |
| alumno | `paintLobby` / `paintWaiting` / `paintEnded` | **chrome** | neutro |
| alumno | `paintQuestion` / `paintRevealOwn` / `paintRace` / `paintLiveBoard` / `paintQuestionLive` | juego | actividad |

## Etapa 1 — Escena POR FASE (quirúrgica, bajo riesgo) ← empezar aquí
Sin tocar maquetación: mover la decisión de escena al enrutador `paint()`.
1. Quitar el `applyScene` del montaje (hostLive:84 / studentLive:99).
2. Helper local en cada vista:
   ```js
   let sceneOn = null; // evita re-aplicar en cada repaint
   function scene(game) {
     if (game === sceneOn) return; sceneOn = game;
     if (game) applyScene(activity, null, { defaultSkin: 'kahoot' });
     else resetScene();
   }
   ```
   `paint()` llama `scene(false)` en las filas "chrome" de la tabla y `scene(true)` en
   las de juego (una línea por rama; el short-circuit de repaints ya existe).
3. El teardown (`ctx.add`) mantiene `resetScene()` (ya está por P0).
4. Quitar los parches P0 puntuales (quedan absorbidos por el helper).
- **Resultado**: lobby con PIN/QR, podio, esperas y "¡Ganaste!" SIEMPRE neutros; el
  juego conserva su fondo inmersivo a pantalla completa. Cero cambio de layout.
- **Verificación**: headless (Playwright): en lobby/podio `document.body.className`
  NO contiene `bg-*` de actividad; en fase question sí. + juego manual 2 ventanas.

## Etapa 2 — Frame real `.ww-player-frame` (estructural, el modelo Wordwall)
Para que NI SIQUIERA durante el juego el body lleve el fondo (página crema alrededor,
juego enmarcado), como en solo:
1. Las ramas de juego montan su contenido dentro de `<div id="ww-frame" class="ww-player-frame">`
   y la escena se aplica `{ target: frame }`. Las de chrome montan como hoy.
2. `.ww-livestage` (tipografía de proyector, touch.css) se mueve del body al frame.
3. CSS: `.ww-player-frame` llena el alto disponible bajo la barra (flex column en
   `#app`), `position:relative` (capas del andamio ya lo esperan).
4. Deprecar `applyScene` page-level (core/player.js incluido) + **ley en
   `docs/leyes.md`**: "el fondo/skin de actividad va al frame, nunca al body" + check
   en tests/norms (grep: ningún `applyScene(` sin `target` fuera de presentation.js).
- **Verificación**: headless con capturas 16:9 y 9:16 de host+alumno en las 4 fases;
  confirmar reflow del proyector intacto (fuentes grandes, sin scroll fantasma).

## Orden y tamaño
| Paso | Tamaño | Riesgo |
|---|---|---|
| Etapa 1 host + alumno (escena por fase) | S | bajo (solo llamadas, sin layout) |
| Etapa 2 alumno (frame) | M | medio |
| Etapa 2 host (frame + livestage al frame) | M | medio (proyector) |
| Ley + test norms + deprecación page-level | S | bajo |

La Etapa 1 elimina el 100% del bug VISIBLE (fondo en pantallas de chrome). La 2 es la
arquitectura correcta a largo plazo; puede esperar a una sesión tranquila con
verificación headless.
