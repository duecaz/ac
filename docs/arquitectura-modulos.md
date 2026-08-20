# Mapa de módulos — GENERADO, no editar a mano

> **Tipo**: generado · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/layers.test.mjs` (regenerar: `node tools/module-map.mjs`)

> Lo produce `node tools/module-map.mjs` del grafo de imports REAL del repo.
> Si editas este archivo a mano, el siguiente `node tests/run.mjs` lo revierte
> (la suite `layers` comprueba que está al día). Para cambiar el dibujo, cambia
> el código — que es justo el punto.
>
> **266 módulos · 1025 imports internos.**

### Ir a otro documento

| Documento | Qué responde |
|---|---|
| [`norte.md`](norte.md) | para quién es la app, la escena real y cómo se decide (**manda sobre el resto**) |
| [`leyes.md`](leyes.md) | TODAS las leyes, cada una con el test que la vigila |
| [`modos-de-juego.md`](modos-de-juego.md) | contrato de los 5 modos y los 4 bucles en vivo |
| [`decisiones-pendientes.md`](decisiones-pendientes.md) | lo aplazado, con su condición para reabrirlo |
| [`estudio-bucles-live.md`](estudio-bucles-live.md) | por qué el vivo es como es (estudio medido) |
| [`testing.md`](testing.md) | las suites y las redes de seguridad del preflight |
| [`guia-testeo-companero.md`](guia-testeo-companero.md) | guía de pruebas paso a paso, para alguien no técnico |
| [`../CLAUDE.md`](../CLAUDE.md) | el mapa de entrada del repo: "quiero X → voy a Y" |

## Dónde está el esfuerzo, y dónde pasa el profesor

La pregunta que ninguna métrica neutra puede responder: **¿el código y los tests
están donde el profe pasa?** El uso de cada tramo sale de la escena real
(`docs/norte.md` §1); el reparto, del repo.

| Tramo del viaje | Cuánto se usa | Módulos · líneas | Suites · líneas | Test/código |
|---|---|---|---|---|
| **buscar/crear** | **siempre** — toda clase empieza aquí | 14 · 1780 | 7 · 859 | 0.48 |
| **jugar en pizarra** | **lo habitual** — solo · VS · equipos, sin móviles | 12 · 2722 | 12 · 1242 | 0.46 |
| **jugar en vivo** | algunos colegios (alumnos con su propio móvil) | 19 · 3975 | 19 · 3001 | 0.75 |
| **informes/tareas** | después de clase | 10 · 1056 | 4 · 466 | 0.44 |
| **plantillas (mecánicas)** | siempre (es el contenido jugado) | 71 · 5709 | 13 · 1643 | 0.29 |
| **infra/común** | todo lo anterior | 140 · 16793 | 54 · 6314 | 0.38 |

> **OJO con el ratio de plantillas**: aquí solo se cuentan las suites de
> `tests/`. Las 13 mecánicas las juega de verdad `tools/matrix-smoke.mjs` (30/30
> con gesto real) y las teclea `tools/edit-audit.mjs`, que son ~600 líneas que
> esta tabla NO ve. El 0,18 es el suelo, no la cobertura real.
>
> Un ratio bajo en un tramo muy usado es deuda de PRIORIDAD, no de calidad: ese
> código funciona, pero si se rompe nadie se entera hasta que hay 33 críos
> delante. El mapeo módulo→tramo está declarado en
> `tests/helpers/journeyTracks.mjs` — explícito y revisable, no adivinado.

## Las capas y cómo dependen unas de otras

Cada flecha va de quien importa a quien es importado, con cuántos imports hay.
La dirección legítima es siempre hacia abajo: **lo de arriba sabe de lo de
abajo, nunca al revés** (ley §0). Lo vigila `tests/layers.test.mjs`.

```mermaid
graph TD
  A["<b>arranque</b><br/><small>cablea cada página (main.*.js, sw.js)</small><br/><small>6 módulos</small>"]
  V["<b>vistas</b><br/><small>el chrome: navegación, setup, informes</small><br/><small>29 módulos</small>"]
  AD["<b>adaptadores</b><br/><small>el transporte: PocketBase | local</small><br/><small>7 módulos</small>"]
  C["<b>core</b><br/><small>el arreglo social (modos, shells) + utilidades</small><br/><small>137 módulos</small>"]
  K["<b>kernel</b><br/><small>el motor de sesión: cuándo se liquida</small><br/><small>6 módulos</small>"]
  T["<b>plantillas</b><br/><small>UNA mecánica: scorer + render + meta.play</small><br/><small>75 módulos</small>"]
  CO["<b>contenido</b><br/><small>modelos y migración del JSON del usuario</small><br/><small>5 módulos</small>"]
  CF["<b>config</b><br/><small>solo datos</small><br/><small>1 módulos</small>"]
  V -->|289| C
  T -->|209| C
  A -->|28| C
  AD -->|27| C
  A -->|18| V
  V -->|11| K
  CO -->|10| C
  K -->|10| C
  C -->|9| K
  C -->|7| CF
  C -.->|6 · excepción| AD
  C -.->|4 · excepción| V
  AD -->|3| CF
  AD -->|3| K
  T -->|3| CO
  V -->|3| T
  C -->|2| CO
  V -->|2| CO
  C -.->|1 · excepción| T
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
| **arranque** | `pb_hooks/aulareto-lib.js` (354) · `pb_hooks/aulareto.pb.js` (354) · `qa/hoja.js` (254) · `main.teacher.js` (168) · `main.embed.js` (68) |
| **vistas** | `views/adminView.js` (1344) · `views/hostLive.js` (1110) · `views/studentLive.js` (922) · `views/playerView.js` (504) · `views/vsView.js` (492) |
| **adaptadores** | `adapters/pocketbase/realtime.js` (1187) · `adapters/local/realtime.js` (324) · `adapters/pocketbase/remoteStore.js` (252) · `adapters/pocketbase/assignments.js` (167) · `adapters/index.js` (127) |
| **core** | `core/textCorrectionRound.js` (455) · `core/normsCheck.js` (392) · `core/aiContent.js` (369) · `core/skins.js` (355) · `core/selftest.js` (345) |
| **kernel** | `kernel/session/engine.js` (559) · `kernel/session/memory.js` (102) · `kernel/contracts/template.js` (75) · `kernel/contracts/contentModel.js` (33) · `kernel/contracts/dataPort.js` (28) |
| **plantillas** | `templates/crossword/player.js` (481) · `templates/wordsearch/player.js` (397) · `templates/match/player.js` (292) · `templates/diagram/player.js` (235) · `templates/quiz/editor.js` (225) |
| **contenido** | `kernel/content/qaAdapt.js` (126) · `kernel/content/switch.js` (117) · `kernel/content/convert.js` (95) · `kernel/content/models.js` (83) · `kernel/content/index.js` (5) |
| **config** | `pocketbase.config.js` (13) |

## Los módulos más importados (fan-in)

Un cambio aquí toca a mucha gente: son los que más test necesitan.

| Módulo | Lo importan |
|---|---|
| `core/html.js` | 87 |
| `core/events.js` | 47 |
| `core/registry.js` | 46 |
| `core/ids.js` | 26 |
| `core/toast.js` | 24 |
| `core/clock.js` | 23 |
| `core/storage.js` | 23 |
| `core/auth.js` | 19 |
| `kernel/session/engine.js` | 19 |
| `core/ls.js` | 16 |

## Los módulos más grandes (candidatos a partir)

El tamaño no es un defecto por sí solo, pero es donde han caído las regresiones:
`views/hostLive.js` concentra lobby + los cuatro bucles + podio + tabla + CSV.

| Módulo | Líneas | Lo importan |
|---|---|---|
| `views/adminView.js` | 1344 | 1 |
| `adapters/pocketbase/realtime.js` | 1187 | 0 |
| `views/hostLive.js` | 1110 | 1 |
| `views/studentLive.js` | 922 | 1 |
| `kernel/session/engine.js` | 559 | 19 |
| `views/playerView.js` | 504 | 1 |
| `views/vsView.js` | 492 | 2 |
| `templates/crossword/player.js` | 481 | 1 |

## El mapa de DATOS: quién escribe cada colección

Ley §21 (una colección, un dueño) y §22 (quién puede escribir, según las reglas
REALES de `core/pbRules.js`). El panel `views/adminView.js` no se lista: es el
dueño del ESQUEMA y por eso las nombra todas.

| Colección | Módulo dueño | Quién puede CREAR |
|---|---|---|
| `activities` | `adapters/pocketbase/remoteStore.js` | con sesión, y solo como dueño |
| `results` | `adapters/pocketbase/remoteStore.js` | cualquiera, sin cuenta |
| `live_sessions` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` · `core/raceE2e.js` | solo con sesión de profe |
| `live_answers` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` · `core/raceE2e.js` | el alumno, **atado a su dispositivo** (§22-4) |
| `live_players` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` · `core/raceE2e.js` | cualquiera, sin cuenta |
| `live_keys` | `adapters/pocketbase/realtime.js` | solo con sesión de profe |
| `live_claims` | `adapters/pocketbase/realtime.js` · `core/stressTest.js` · `core/raceE2e.js` | cualquiera, sin cuenta |
| `assignments` | `adapters/pocketbase/assignments.js` · `core/stressTest.js` · `adapters/index.js` | solo con sesión de profe |
| `assignment_attempts` | `adapters/pocketbase/assignments.js` · `core/stressTest.js` | regla propia (ver `core/pbRules.js`) |
| `reports` | `core/reports.js` | solo con sesión de profe |
| `activity_likes` | `core/likes.js` | con sesión, o el alumno bajo condiciones |
| `profiles` | `core/profile.js` | con sesión, y solo como dueño |
| `users` | `core/auth.js` · `core/teachers.js` | **nadie** (cerrado por API) |
| `ia_config` | `core/iaKeys.js` | **nadie** (cerrado por API) |
| `_superusers` | — | **nadie** (cerrado por API) |

> Un módulo que necesite datos no hace fetch a la colección: **le pide un método
> al dueño**. Lo vigila la regla `pb-dueno` de `tests/norms.test.mjs`.
