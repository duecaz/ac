# Sistema de plantillas — mapa vivo

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> **Cómo se crea, valida y juega una actividad.** Una plantilla es *contenido +
> mecánica + presentación* por ejes separados: por eso muchas actividades son el
> **mismo contenido con distinta mecánica** (el modelo Wordwall). Este documento
> mapea las piezas y quién interviene en cada momento.
>
> Documentos hermanos: cómo AÑADIR una (paso a paso) → `templates/HOW_TO_ADD.md` ·
> contrato de modos → `docs/modos-de-juego.md` · contrato de CSS →
> `docs/estilos-de-actividad.md` · catálogo → `docs/panorama-actividades.md` ·
> testeo → `docs/testing.md`. La fuente de verdad del estado vive en `CLAUDE.md`.

## 1. La idea: contenido, mecánica, presentación son EJES

- **Contenido** = un dato (`contentModel`). Ocho modelos registrados en
  `kernel/content/models.js`: `qa`, `pairs`, `words`, `items`, `textCorrection`,
  `ballsort`, `diagram` (+ `entries`, huérfano). Dos plantillas del MISMO modelo
  se juegan con el mismo contenido → "cambiar de formato" es gratis
  (`kernel/content/switch.js` + `convert.js`).
- **Mecánica** = lo ÚNICO que escribe el autor: `player.js` (cómo se juega) y su
  `styles/<name>.css`. Todo lo demás lo aporta el sistema.
- **Presentación** = skin (tokens `--ww-*`) + fondo, transversal a todas.

Ejemplo real: **Quiz** y **Explota Globos** comparten modelo `qa`, editor y
scorer; solo cambia el `player.js`. Cambiar un Quiz a Globos es directo.

## 2. El contrato de una plantilla (`templates/base.js`)

Cada `templates/<name>/` tiene: `template.js` (la clase), `player.js`,
`editor.js`, `scorer.js` (si autopuntúa), `index.js` (auto-registro).

**Obligatorio** (lo exige el registro al arrancar + el contrato ejecutable):

| Miembro | Qué es |
|---|---|
| `meta` | `name, label, icon, color, contentModel, templateVersion, instructions, panelFit, aspectRatio, modes, needs*Upload, default{Rules,Scoring,Live,Content}` |
| `renderPlayer(rootSel, activity, opts)` | El juego SOLO (+ async). Se monta vía `runMode`, nunca solo. |
| `renderEditor(root, activity, onChange)` | El editor — SIEMPRE sobre `core/editorShell.js`. |
| `previewHtml(act)` | La miniatura de la tarjeta del home (markup estático). |
| `scoreSubmission({value,item,...})` | Devuelve `{correct, points}` — SIEMPRE esa forma. |

**Opcional** (desbloquea modos): `getRoundPayload` + `renderRound` → VS/Equipos-auto;
`meta.modes.live` + los dos anteriores → En vivo; `migrateContent` → subir de versión;
`adoptContent` → adaptar al convertir hacia esta plantilla.

## 3. Quién interviene al CREAR una actividad

```
tools/new-template.mjs  (el generador)
  ├─ kernel/content/models.js   valida --model y trae newEmpty()
  ├─ core/registerTemplates.js  punto ÚNICO — le añade el import
  ├─ core/previewKit.js         helpers del preview (STAGE_W/H, headHtml, emptyHtml)
  ├─ core/ids.js                rid(prefijo) para los ids
  └─ emite  template · player · editor · scorer · index · styles/<name>.css

En cuanto se registra e importa:
  core/registry.js            registra + VALIDA el contrato al arrancar (falla ruidoso)
  core/editorShell.js         el editor hereda las pestañas (Contenido/Puntuación/Modos/Presentación)
  core/modes.js               deriva qué modos ofrece (solo/vs/teams por capacidad; live/async por meta)
  core/templateCapability.js  canAutoScoreRound(T) — el predicado ÚNICO "¿VS/Equipos-auto?"
  kernel/content/switch.js    "cambiar de formato" (usa convert.js entre modelos)
```

El autor toca **dos ficheros de verdad**: `player.js` y `styles/<name>.css`. El
resto son huecos rellenos por el generador.

**Y su player nace con los CUATRO ROLES** (`docs/estilos-de-actividad.md` §3b0):
`hudHtml({...})` como primer hijo (los indicadores flotan, nunca crean franja),
al menos una sección de juego con nombre (`edu-sec edu-sec--tablero`),
`edu-topbar` SOLO si hay herramienta que tocar, y `edu-send` si el envío se
construye y confirma. No es cosmética: `tools/matrix-smoke.mjs` lo comprueba
montando la plantilla, así que una nueva que se los salte rompe CI.

## 4. Quién interviene al JUGARLA

```
views/playerView.js     monta el modo elegido; ficha modeToken anti-carrera
views/startScreen.js    título + meta.instructions + ajustes + Iniciar→fullscreen
core/soloPlayer.js      SHELLS: runSequentialPlayer (ítem a ítem) / runFreeformPlayer (tablero)
                        → bucle, idx, finish, trySaveResult, emite QUESTION_SHOWN/PODIUM
core/soloTimer.js       createCountdown (scheduler inyectable)
core/gameEvents.js      el BUS → core/sounds.js (mp3 autoalojados) + core/effects.js (confeti)
core/scoring/           basePoints / wrongPoints / usaBonusVelocidad / awardPoints (convención de puntos)
core/skins.js           aplica los tokens --ww-*; el CSS de la actividad los consume
core/activityThumb.js   la miniatura del home → llama al previewHtml de la plantilla
```

**Eventos del bus** (los emite el `player.js`, y el sistema los convierte en
sonido/efecto sin que la plantilla sepa nada): `QUESTION_SHOWN`, `ANSWER_CORRECT`,
`ANSWER_WRONG`, `STREAK`, `REVEAL`, `TICK`, `PODIUM`.

## 5. Los guardianes (el contrato es EJECUTABLE)

Cinco checkers puros, reutilizados por CI **y** el panel `#/admin` (grupos
*Contrato/Normas/Skins*) — no hay lógica duplicada:

| Módulo checker | Test CI | Qué garantiza |
|---|---|---|
| `core/templateContract.js` | `tests/templateContract.test.mjs` | meta completa, modelo registrado, defaultContent jugable, scorer `{correct,points}`, `previewHtml`, migrate idempotente, carpeta↔registro |
| `core/normsCheck.js` | `tests/norms.test.mjs` | sin `new ResizeObserver` directo, sin filtro PB con `encodeURIComponent`, `kernel/` sin `Date.now()` |
| `core/skinContract.js` | `tests/skins.test.mjs` | cada skin define el set COMPLETO de tokens |
| (ratchet de estilos) | `tests/styles.test.mjs` | CSS relativo + tokenizado; deuda congelada, no crece; todo `styles/*.css` clasificado |
| (self-test del generador) | `tests/newTemplate.test.mjs` | el generador emite algo que PASA el contrato — si el contrato crece y el esqueleto se queda viejo, falla aquí |

Diagnóstico manual de una plantilla existente: `node tools/check-template.mjs [name]`.

## 6. Estado (importante — leer)

**Las 13 actividades PASAN el contrato ejecutable** (`node tools/check-template.mjs`
→ todas ✓). Eso significa que **ninguna puede romper el contrato en silencio** y
que una nueva nace conforme.

**"Pasar el contrato" ≠ "pulida al 100%".** Varias actividades siguen en trabajo
de **diagramación y funciones** (maquetación fina, mecánicas a medio pulir). El
contrato garantiza la ESTRUCTURA (que exista, valide, puntúe, tenga preview y no
viole normas), no que la experiencia esté terminada. La deuda cosmética conocida
(baseline de estilos de `vs.css`/`teams.css`, bloque keypad-fit duplicado, etc.)
está **congelada** por el ratchet: no puede crecer, pero existe — ver la sección
"Deuda técnica registrada" de `CLAUDE.md`.

## 7. Regla de oro

Si algo es una **norma** del sistema, es un **test** — no vive solo en un MD.
Por eso este documento puede quedarse corto, pero no puede MENTIR: el código lo
contradiría en CI. Al añadir una capacidad al contrato, actualiza el checker y el
generador en el mismo commit (el self-test del generador te obliga).
