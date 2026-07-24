# HANDOFF — Separación PLAYER ↔ PÁGINA (frame de juego, estilo Wordwall)

> Problema raíz (repetido): el fondo/skin de la ACTIVIDAD se aplica a la **página
> entera** (`<body>`) en los modos live (host y alumno), así que "se apropia" del
> chrome, del podio, del resultado y de los menús. Wordwall no hace esto: el juego
> vive en un **marco** con su propio fondo; la página alrededor es neutra. Esa
> frontera es lo que falta. Parche puntual ya aplicado (resetScene en podios/
> resultado); este doc es el arreglo LIMPIO y definitivo.

## Estado real (verificado)
- **Solo** (`views/playerView.js`): YA lo hace bien → aplica skin/fondo al FRAME
  `#ww-frame` (`applySkin(skin, frame)` / `applyBackground(bg, frame)`), no al body.
  El CSS ya soporta ambos objetivos: `styles/backgrounds.css` define `body.bg-*` **y**
  `.ww-player-frame.bg-*`.
- **Live host** (`views/hostLive.js:84`) y **Live alumno** (`views/studentLive.js:99`):
  `applyScene(activity, ctx, {defaultSkin:'kahoot'})` → tematiza el `<body>`. FUGA.
- **core/player.js:17**: `applyScene(activity, ctx)` (page-level) — revisar quién lo usa.
- `applyScene(activity, null, { target })` YA existe para tematizar UN elemento
  (presentation.js) → la pieza para scoping ya está, solo falta USARLA en live.

## Principio (la "ley" nueva)
**El fondo/skin de la actividad SOLO se aplica al frame del juego, NUNCA al `<body>`.**
- El `<body>`/chrome (barra, menús) = paleta de la app (crema), siempre.
- El JUEGO (y solo el juego) vive dentro de `.ww-player-frame` y lleva su fondo/skin.
- Pantallas que NO son juego (lobby, pregunta-host con marcador, podio, resultado,
  "¡Ganaste!") = fuera del frame → fondo neutro automáticamente.

## Diseño
### 1. Un frame único de juego
Contrato: el área jugable se envuelve en `<div class="ww-player-frame" id="ww-frame">`.
`applyScene`/`applySkin`/`applyBackground` reciben SIEMPRE `target = ese frame`.
`resetScene()` global deja de ser necesario para "limpiar fugas" (ya no las hay), pero
se mantiene por robustez.

### 2. Migrar los 3 full-screen a frame
- **Solo** (playerView): ya está — es el modelo a copiar.
- **Live host** (hostLive):
  - `renderHost` deja de hacer `applyScene(...ctx...)` sobre el body.
  - La vista de PREGUNTA (renderRoundHost) se monta dentro de `#ww-frame` y ahí se
    aplica la escena; lobby/podio se montan FUERA del frame (chrome neutro).
  - `.ww-livestage` (fuentes grandes de proyector, touch.css) se aplica AL FRAME.
- **Live alumno** (studentLive): igual — el juego dentro del frame; lobby/resultado
  fuera. `ww-play-noscroll` puede quedarse en body (es scroll, no color).

### 3. CSS
- `.ww-player-frame`: ocupa el área de juego (flex:1 / min-height), `position:relative`
  para las capas del andamio, y hereda `bg-*` (ya definido). En proyector (host)
  ocupa casi todo el viewport bajo la barra; en alumno, el área bajo la barra.
- Quitar del recorrido cualquier `body.bg-*` en live (ya no se pone).

### 4. Limpieza
- `applyScene(activity, ctx)` sin target (page-level) → deprecar en favor de
  `{ target: frame }`. Dejar `resetScene()` como salvaguarda.
- Actualizar `docs/leyes.md` (§ maquetación): "el fondo de actividad va al frame, no
  al body" + test si se puede (un check de que hostLive/studentLive no llaman
  applyScene sin target).

## Fases
| Fase | Qué | Riesgo |
|---|---|---|
| **P0** (hecho) | `resetScene()` en podio host + resultado alumno (parche) | nulo |
| **P1** | Frame en **live alumno**: juego en `#ww-frame`, lobby/resultado fuera; escena al frame | medio (maquetación) |
| **P2** | Frame en **live host**: pregunta-proyector en `#ww-frame`, lobby/podio fuera; `.ww-livestage` al frame | medio |
| **P3** | Deprecar applyScene page-level (core/player.js) + ley + test | bajo |

Verificación (headless Playwright, como el bug de emparejar): cargar host y alumno,
comprobar que `document.body` NO tiene `bg-notebook` en lobby/podio/resultado y que el
frame SÍ lo tiene durante el juego; capturas en 16:9 y 9:16.

## Nota de alcance
La migración a frame es la correcta pero toca la maquetación de hostLive/studentLive
(riesgo de romper el reflow del proyector). Por eso va por fases con verificación
headless. El parche P0 ya evita la fuga visible mientras tanto.
