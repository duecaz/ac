# Mapa de módulos — GENERADO, no editar a mano

> Lo produce `node tools/module-map.mjs` del grafo de imports REAL del repo.
> Si editas este archivo a mano, el siguiente `node tests/run.mjs` lo revierte
> (la suite `layers` comprueba que está al día). Para cambiar el dibujo, cambia
> el código — que es justo el punto.
>
> **243 módulos · 875 imports internos.**

## Las capas y cómo dependen unas de otras

Cada flecha va de quien importa a quien es importado, con cuántos imports hay.
La dirección legítima es siempre hacia abajo: **lo de arriba sabe de lo de
abajo, nunca al revés** (ley §0). Lo vigila `tests/layers.test.mjs`.

```mermaid
graph TD
  A["<b>arranque</b><br/><small>cablea cada página (main.*.js, sw.js)</small><br/><small>3 módulos</small>"]
  V["<b>vistas</b><br/><small>el chrome: navegación, setup, informes</small><br/><small>28 módulos</small>"]
  AD["<b>adaptadores</b><br/><small>el transporte: PocketBase | local</small><br/><small>7 módulos</small>"]
  C["<b>core</b><br/><small>el arreglo social (modos, shells) + utilidades</small><br/><small>116 módulos</small>"]
  K["<b>kernel</b><br/><small>el motor de sesión: cuándo se liquida</small><br/><small>8 módulos</small>"]
  T["<b>plantillas</b><br/><small>UNA mecánica: scorer + render + meta.play</small><br/><small>75 módulos</small>"]
  CO["<b>contenido</b><br/><small>modelos y migración del JSON del usuario</small><br/><small>5 módulos</small>"]
  CF["<b>config</b><br/><small>solo datos</small><br/><small>1 módulos</small>"]
  V -->|240| C
  T -->|188| C
  A -->|28| C
  AD -->|26| C
  A -->|17| V
  C -->|9| K
  CO -->|9| C
  K -->|9| C
  V -->|8| K
  C -.->|6 · excepción| AD
  C -->|5| CF
  V -->|5| T
  C -.->|4 · excepción| V
  AD -->|3| CF
  AD -->|3| K
  T -->|2| CO
  V -->|2| CO
  C -.->|1 · excepción| T
  C -->|1| CO
  CO -->|1| K
  T -.->|1 · excepción| K
  V -->|1| AD
  V -->|1| CF
```

## Qué puede importar cada capa

| Capa | Puede importar | PROHIBIDO |
|---|---|---|
| **contenido** | core · kernel | plantillas · vistas · adaptadores |
| **plantillas** | core · contenido · kernel | vistas · adaptadores (una plantilla no sabe en qué modo corre) |
| **kernel** | core · contenido · config | vistas · adaptadores · plantillas concretas (el motor es puro) |
| **core** | kernel · contenido · config | vistas (salvo `import()` dinámico al montar un modo) · adaptadores concretos (solo la fachada `adapters/index.js`) |
| **adaptadores** | core · kernel · contenido · config | vistas · plantillas |
| **vistas** | todo lo de abajo | — |
| **config** | nada | es un fichero de datos |

## Dónde se acumula el tamaño (líneas)

| Capa | Módulos más grandes |
|---|---|
| **arranque** | `main.teacher.js` (156) · `main.embed.js` (68) · `main.student.js` (45) |
| **vistas** | `views/hostLive.js` (1031) · `views/adminView.js` (942) · `views/studentLive.js` (808) · `views/vsView.js` (475) · `views/playerView.js` (348) |
| **adaptadores** | `adapters/pocketbase/realtime.js` (1101) · `adapters/local/realtime.js` (321) · `adapters/pocketbase/remoteStore.js` (252) · `adapters/pocketbase/assignments.js` (167) · `adapters/index.js` (127) |
| **core** | `core/selftest.js` (331) · `core/skins.js` (327) · `core/textCorrectionRound.js` (325) · `core/auth.js` (307) · `core/vsAnimations.js` (269) |
| **kernel** | `kernel/session/engine.js` (502) · `kernel/session/memory.js` (102) · `kernel/contracts/template.js` (75) · `kernel/contracts/contentModel.js` (33) · `kernel/contracts/realtimePort.js` (31) |
| **plantillas** | `templates/crossword/player.js` (464) · `templates/wordsearch/player.js` (405) · `templates/match/player.js` (296) · `templates/quiz/editor.js` (283) · `templates/diagram/player.js` (233) |
| **contenido** | `kernel/content/qaAdapt.js` (104) · `kernel/content/convert.js` (95) · `kernel/content/switch.js` (82) · `kernel/content/models.js` (79) · `kernel/content/index.js` (5) |
| **config** | `pocketbase.config.js` (13) |

## Los módulos más importados (fan-in)

Un cambio aquí toca a mucha gente: son los que más test necesitan.

| Módulo | Lo importan |
|---|---|
| `core/html.js` | 80 |
| `core/events.js` | 45 |
| `core/registry.js` | 40 |
| `core/ids.js` | 22 |
| `core/storage.js` | 22 |
| `core/clock.js` | 21 |
| `core/toast.js` | 20 |
| `core/ls.js` | 17 |
| `core/gameEvents.js` | 17 |
| `kernel/session/engine.js` | 16 |

## Los módulos más grandes (candidatos a partir)

El tamaño no es un defecto por sí solo, pero es donde han caído las regresiones:
`views/hostLive.js` concentra lobby + los cuatro bucles + podio + tabla + CSV.

| Módulo | Líneas | Lo importan |
|---|---|---|
| `adapters/pocketbase/realtime.js` | 1101 | 0 |
| `views/hostLive.js` | 1031 | 1 |
| `views/adminView.js` | 942 | 1 |
| `views/studentLive.js` | 808 | 1 |
| `kernel/session/engine.js` | 502 | 16 |
| `views/vsView.js` | 475 | 2 |
| `templates/crossword/player.js` | 464 | 1 |
| `templates/wordsearch/player.js` | 405 | 1 |

## El mapa de DATOS: quién escribe cada colección

Ley §21 (una colección, un dueño) y §22 (quién puede escribir, según las reglas
REALES de `core/pbRules.js`). El panel `views/adminView.js` no se lista: es el
dueño del ESQUEMA y por eso las nombra todas.

| Colección | Módulo dueño | Quién puede CREAR |
|---|---|---|
| `activities` | `adapters/pocketbase/remoteStore.js` | con sesión, y solo como dueño |
| `results` | `adapters/pocketbase/remoteStore.js` | cualquiera, sin cuenta |
| `live_sessions` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` | solo con sesión de profe |
| `live_answers` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` | el alumno, **atado a su dispositivo** (§22-4) |
| `live_players` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` | cualquiera, sin cuenta |
| `live_keys` | `adapters/pocketbase/realtime.js` | solo con sesión de profe |
| `live_claims` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` | cualquiera, sin cuenta |
| `assignments` | `adapters/pocketbase/assignments.js` · `core/stressTest.js` · `adapters/index.js` | solo con sesión de profe |
| `assignment_attempts` | `adapters/pocketbase/assignments.js` · `core/stressTest.js` | regla propia (ver `core/pbRules.js`) |
| `reports` | `core/reports.js` | solo con sesión de profe |
| `activity_likes` | `core/likes.js` | con sesión, o el alumno bajo condiciones |
| `profiles` | `core/profile.js` | con sesión, y solo como dueño |
| `users` | `core/auth.js` · `core/teachers.js` | **nadie** (cerrado por API) |
| `_superusers` | — | **nadie** (cerrado por API) |

> Un módulo que necesite datos no hace fetch a la colección: **le pide un método
> al dueño**. Lo vigila la regla `pb-dueno` de `tests/norms.test.mjs`.
