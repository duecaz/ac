# WW Actividades — Guía para Claude

## Reglas obligatorias (SIEMPRE)

### 1. Versión — en CADA commit y en CADA respuesta
- **SIEMPRE** sube `VERSION` en `core/constants.js` en cada commit (incremento de patch:
  `1.51.49` → `1.51.50`). Nunca bajar la versión, siempre hacia adelante (la caché y el
  service worker dependen de que la versión avance).
- **SIEMPRE** indica el número de versión en la respuesta del chat cuando termines un
  cambio, en formato `(vX.Y.Z)`, para poder referenciar exactamente por versión.
- El número de versión del commit y el de la respuesta deben coincidir.

### 2. TODO AL MAIN — `main` sirve la web (permiso permanente)
**`main` es la rama que sirve GitHub Pages (dos.pe)** — es LA rama de producción. El
usuario da permiso PERMANENTE y explícito para commitear y hacer push a `main`
directamente (fast-forward simple, sin force), aunque una herramienta/harness obligue a
trabajar primero en una rama `claude/*`: en ese caso, trabaja en la rama que toque y al
terminar **propaga el commit a `main`** para que el usuario vea la última versión.
Si algún guardarraíl lo impide, pídele que lo reafirme, pero por defecto: TODO AL MAIN.

Tras commitear, hacer push (rama de trabajo si la hay, y SIEMPRE `main`):
```
git push -u origin <rama-de-trabajo>                 # si el harness fija una
git push origin <rama-de-trabajo>:main               # ← imprescindible: sirve la web
git push origin <rama-de-trabajo>:ACTIVIDAD2         # legado, opcional (ya no sirve la web)
```
- `main` **debe quedar siempre al día**: es lo que ve el usuario en dos.pe y lo que otros
  proyectos consultan. Se dejó desincronizada 154 commits una vez y "el otro proyecto no
  encontraba nada". No vuelva a pasar.
- `ACTIVIDAD2` fue la rama de Pages; **ya NO sirve la web** (se movió a `main`). Se
  mantiene sincronizada por inercia/legado, pero lo crítico es `main`.

### 3. Entorno del usuario
- El usuario trabaja en **Windows (PowerShell)** y tiene **GitHub CLI (`gh`) instalado y
  autenticado**: para acciones sobre sus repos fuera del alcance de la sesión (p.ej.
  `duecaz/ww-assets`), pásale los comandos `gh`/PS listos para pegar y él los ejecuta.

## MAPA — dónde mirar (lee ESTO antes de cargar medio repo)

Este archivo es el índice. **No leas todos los MD ni todo el código de golpe**: identifica
la tarea, abre SOLO el doc/módulo que corresponde. Regla de oro del proyecto: *si es norma,
es test* — antes de dudar de una convención, mira si hay un test que la fija.

| Quiero… | Voy a… |
|---|---|
| **Ver TODAS las leyes/normas del proyecto** (px/token del juego, PB, XSS, versión…) | **`docs/leyes.md`** (índice único: qué · dónde · qué test la vigila) |
| Entender el sistema de plantillas (crear/validar/jugar, qué módulo hace qué) | **`docs/sistema-de-plantillas.md`** (mapa vivo) |
| **Crear una actividad nueva** | `node tools/new-template.mjs <name> --model qa [--vs] [--live]` + `templates/HOW_TO_ADD.md` |
| **Diagnosticar** una plantilla existente | `node tools/check-template.mjs [name]` (contrato + normas) |
| Contrato de CSS + **responsive / andamio de regiones** (ww-scaffold/rail/stage) | `docs/estilos-de-actividad.md` (§3b andamio) |
| Contrato de **modos** (Solo/VS/Equipos/Live/Tarea) y su gateo | `docs/modos-de-juego.md` · `core/modes.js` |
| **Modelo de contenido** JSON por plantilla | `docs/ESTRUCTURA.md` · modelos en `kernel/content/models.js` |
| Catálogo: qué hace cada actividad y en qué modos | `docs/panorama-actividades.md` |
| **Probar** (suites Node + panel admin + headless Playwright) | `docs/testing.md` |
| **Prueba de CARGA** (N alumnos concurrentes live+tareas contra PB real) | `core/stressTest.js` · botón `#/admin` "Simular carga" · `node tools/stress-live.mjs [N]` |
| Modo SOLO (Wordwall) por dentro · identidad/auth · dev local | `docs/modo-wordwall.md` · `docs/identidad.md` · `docs/dev-local.md` |
| Índice completo de docs | `docs/README.md` (lo histórico vive en `docs/historico/`) |
| **Cómo se puntúa CADA actividad** (mapa de los 7 sitios que deciden puntos + plan) | **`docs/handoff-puntuacion.md`** |
| **Centralizar decisiones repartidas en vistas** (fase→pantalla, payload, meta, prompt…) | **`docs/handoff-centralizacion.md`** |
| **Bugs abiertos / deuda** | la sección "Deuda técnica registrada" (abajo) + notas `docs/handoff-*.md` |
| **Plan biblioteca pública** (portada, likes, gate de login, admin) | **`docs/handoff-biblioteca-publica.md`** (+ `handoff-google-classroom.md` y `handoff-seguridad-pb.md`) |
| **Cómo está la BD/Pi de VERDAD** (PocketBase, Docker, backups, OAuth Google, quirks) | **`docs/infraestructura-pb.md`** (fuente de infra; actualizar si cambia el servidor) |
| **Plan de usuarios/acceso docente** (endurecer reglas, PIN, NFC, pizarras, panel profes) | **`docs/handoff-acceso-docente.md`** (incluye auditoría del sistema de usuarios) |

Verificar SIEMPRE antes de commitear: `node tests/run.mjs` (todas las suites). El contrato,
las normas, los skins y el CSS se auto-verifican ahí Y en `#/admin` → "Ejecutar tests".

## Arquitectura (resumen)
- Vanilla JS, ES modules, sin framework. Routing por hash.
- Backend: **PocketBase** en `pb.lanube.uno` (Pi 5, Docker). **Solo PocketBase** — Supabase RETIRADO.
  - En PB: activities, results, live sessions, tareas (assignments), reportes, explorar, auth
    (email/password en `core/auth.js`), imágenes (inline), logs (local).
  - Backends válidos: `local` (dev offline) y `pocketbase` (prod). El antiguo fallback
    `?backend=supabase` y `adapters/supabase/*` fueron eliminados.
- Imágenes inline como data-URL en el JSON de la actividad (límite 200 KB). **No subir a storage externo**
  (`core/upload.js` convierte a data-URL; nunca a un bucket).
- Live: una sola sala PocketBase (`live_sessions`), PIN/QR, `subscribeRoom`, fase de máquina de estados.
  - Pregunta Live y Ruleta Live reutilizan ese mismo live con la fase `'question-live'` y campos `ql_*`.

## Notas de plantillas
- `sessionItems(activity)` lee `items ?? entries ?? pairs ?? groups ?? words ?? passages ?? []`.
- Plantillas con `modes.live: true` deben declarar `getRoundPayload` y `scoreSubmission` (aunque sean stubs).
- Las columnas de rejillas se ponen inline (`grid-template-columns: repeat(N, 1fr)`); las variables CSS se ignoran en algunos móviles.
- **`meta.instructions` es obligatorio** (frase corta de cómo se juega): lo muestra la pantalla de inicio.
- **`meta.panelFit`** declara la maquetación del panel VS: `'fill'` (defecto, llena y escala) ·
  `'block'` (bloque único con tope, p.ej. la calculadora) · `'center'`. Ver docs/modos-de-juego.md §5c.

## Chrome del panel Profesor (NO es "el juego")
- La barra superior y la home "Mis actividades" (`views/home.js` + `teacher.html <nav>`) usan
  **`styles/home.css`** (chrome propio, paleta crema/navy del mockup, fuente del sistema). NO usa
  tokens `--ww-*` ni skins (eso es del juego). Al ser chrome, va en la lista `EXCLUDED` del ratchet
  `tests/styles.test.mjs` — si añades otro CSS de chrome, súmalo ahí o el "completeness gate" falla.
- El preview de cada tarjeta del HOME lo pinta **`core/homePreview.js`** (`homePreviewHtml`):
  un dibujo LIGERO y estático por tipo de plantilla (sin render del juego), MEMOIZADO por
  `id:updatedAt`. Cubre las **13** plantillas (0 respaldos genéricos) — lo garantiza
  `tests/homePreview.test.mjs` (si añades plantilla y olvidas su esquema en el switch
  `build()`, falla en CI). Es distinto de `mountThumb`/`core/activityThumb.js` (render real
  escalado 1280×800), que sigue existiendo para otros usos — el home dejó de usarlo por
  rendimiento. Pendiente: que el preview respete tema/fondo de la actividad (ver
  `docs/handoff-previews-home.md` Fase 2b).
- En móvil (≤640px) la barra superior colapsa en un **menú hamburguesa** (`.ww-topbar__burger`
  → clase `.open`); las acciones (incl. `#ww-mute-slot`/`#ww-auth-slot`) caen en el desplegable.

## Estándares transversales (no romper)
- **Pantalla de inicio** (`views/startScreen.js`): todo modo Individual pasa por ella (título +
  instrucciones + ajustes + Iniciar→fullscreen). El ejercicio queda oculto hasta Iniciar.
- **Registro de plantillas y arranque**: `core/registerTemplates.js` (las 13, punto único) +
  `core/boot.js` (sonidos/efectos al bus, versión, mute). Las 3 `main.*.js` NO repiten ese wiring.
- **Gama baja** (`core/perf.js`): `ww-lite` en `<html>` si ≤4 núcleos o ≤2GB → sin bucles de
  animación en reposo (cuerda Lottie estática, marquesina arcade quieta). El VS debe ser fluido en
  pizarras A55; nunca añadir bucles rAF continuos en el hilo principal sin gate `ww-lite`.
- **Filtros PocketBase**: SIEMPRE `pbEscape`/`pbFilterParam` (`core/pbFilter.js`), nunca
  `encodeURIComponent` a pelo (no escapa la comilla simple).
- **Puntos**: convención en `core/scoring/` (basePoints/wrongPoints/useKahoot/awardPoints); Tildes/Comas
  puntúan **`pointsPerCorrect` por marca buena** (`scoreMarksPerHit`, default 1): el puntaje = nº de
  aciertos × ppc, las marcas de más NO restan (se registran en `over` para desempate/corrección;
  `perfect` = todas y ninguna de más). Así `player.score`, la tabla y el podio muestran el MISMO número.
  **Regla inherente = un solo scorer por plantilla**: TODOS los modos (Solo, Tarea, VS, Equipos, Live
  y cualquier modo futuro) puntúan vía `T.scoreSubmission` (que envuelve `scoreMarksPerHit`); NUNCA
  se reimplementa el conteo en la vista/runner de un modo. Los PARÁMETROS (`scoring.pointsPerCorrect`)
  viven en la propia actividad; la LÓGICA vive en la plantilla → imposible que un modo desincronice.
  El runner Solo (`runTextCorrectionSolo`) también llama a `scoreMarksPerHit` (no tiene copia propia).
- **Maquetación del PLAYER: NADA con tamaño fijo** — todo relativo (unidades de
  contenedor `cq*` o `%`, o cálculo JS tipo `fitLayout`/`fitPassage`), para que el
  juego se vea bien en 4K, 600×800, 9:16 y 16:9. Prohibido `px`/`rem` fijos que
  congelen el crecimiento (un `clamp(...,...,.95rem)` con tope bajo NO escala). Los
  `max(12px, Xcqmin)` son OK como PISO de legibilidad, nunca como techo. (El editor
  sí puede usar px: es un formulario, no el juego.) **Además, colores pintables**
  (`color`/`background`) del juego **por token `var(--ww-*)`** para que los skins
  recoloreen — nunca `#hex` a pelo (salvo neutros y estado acierto/error). Contrato
  completo + ejemplares (`math.css`/`quiz.css`) en **`docs/estilos-de-actividad.md`**;
  lo protege el ratchet `tests/styles.test.mjs` (una actividad nueva debe nacer limpia).
- **ResizeObserver en players**: NUNCA `new ResizeObserver(cb)` directo si el callback
  muta layout — usar `observeResize()` (`core/observeResize.js`, rAF-debounced). Un RO
  directo dispara el aviso benigno "ResizeObserver loop…" que el boot-guard de los HTML
  trataba como crash (ya filtrado, pero el helper es la norma).
- **Handlers delegados y cambio de ruta**: todas las vistas montan en la MISMA raíz
  compartida `#app` y registran sus handlers con `on(APP, ...)` (delegación en
  `core/events.js`). Esos listeners viven en el elemento `#app` (estable), así que
  SOBREVIVEN al `innerHTML` de la vista siguiente. Por eso el router llama
  `clearListeners(APP)` antes de renderizar cada ruta (`setBeforeResolve` en las
  `main.*.js`): sin ello, los handlers `.skin-pick`/`.bg-pick` del player seguían vivos
  al entrar al editor (mismas clases) → `mount: root not found` y el tema saltaba a
  `<body>`. NUNCA quites ese `setBeforeResolve`, y si una vista necesita que un handler
  persista entre rutas, NO lo cuelgues de `#app`. Cubierto por `tests/events.test.mjs`.
- **Contrato y normas EJECUTABLES**: `tests/templateContract.test.mjs` (contrato completo de
  plantilla: `instructions`, modelo registrado, scorer `{correct,points}`, migrate idempotente,
  carpeta↔registro), `tests/norms.test.mjs` (RO directo, filtros PB, kernel sin `Date.now()`) y
  `tests/skins.test.mjs` (cada skin define el set COMPLETO de tokens de `default`, sin caer al
  fallback `:root`). Los tres corren también en el panel `#/admin` (grupos *Contrato*, *Normas*,
  *Skins*) vía los checkers compartidos `core/templateContract.js` / `core/normsCheck.js` /
  `core/skinContract.js`. Una plantilla o skin nuevo queda cubierto solo — no escribas estas
  reglas solo en un MD: si es norma, es test.
- **Plantilla nueva = generador**: `node tools/new-template.mjs <name> --model qa [--vs] [--live]`
  crea la carpeta completa cumpliendo el contrato (default: SOLO-Individual — una mecánica a
  medias nunca aparece en VS/Equipos) y la registra. Diagnóstico: `tools/check-template.mjs`.
  El esqueleto lo vigila `tests/newTemplate.test.mjs` (genera en scratch + checkers reales).
  IDs SIEMPRE con `rid()` de `core/ids.js` (prefijos: `q_ p_ it_ w_ ps_ pin_`), nunca
  `Math.random().toString(36)` a mano. Mapa completo del sistema (crear/validar/jugar,
  qué módulo interviene en cada momento) en **`docs/sistema-de-plantillas.md`**.
- **Testeo**: mapa de suites + receta headless (Playwright) en `docs/testing.md`.

## Deuda técnica registrada

### ✅ RESUELTO (v1.51.217 → v1.51.235) — Sistema de usuarios + biblioteca pública
Biblioteca tipo Wordwall + cuentas de profe, ejecutado y verificado en real:
- **S1-S3** (gate/claim/almacén por usuario · portada+explore+likes+publicar · reglas duras
  + admin + reportes) → `docs/handoff-biblioteca-publica.md`.
- **U1**: reglas PB ENDURECIDAS (crear exige sesión+owner; sin `owner=''`), signup público
  cerrado (alta = Google o admin), `createTeacher` firma con token, "Probar" ya no clona a PB.
- **U5**: panel Profesores en `#/admin` (listar, dar/quitar admin) — `core/teachers.js`.
- **S4**: enviar tareas a **Google Classroom** (`core/classroom.js` + GIS en
  `core/classroomAuth.js`) → `docs/handoff-google-classroom.md`. Requiere habilitar la
  Classroom API + scopes en Google Cloud (paso del usuario).
- **Perfil del profe**: colección pública `profiles` (colegio/frase/avatar de Google),
  separada de `users` (email privado) — `core/profile.js`, `views/author.js`.
- **Editor**: botones claros "Guardar borrador" / "Publicar".
- **OAuth**: redirect canónico `/teacher`→`/teacher.html` + volver a donde estabas.
- **Infra**: `docs/infraestructura-pb.md` (estado REAL de PB/Pi) + `tools/check-pb.sh`
  (smoke-test) + `docs/leyes.md` (índice de todas las normas).
- **Pendiente (futuro, pedido por el usuario)**: PIN/NFC para pizarras (U2-U4) →
  `docs/handoff-acceso-docente.md`.

### 🔴 AUDITORÍA INTEGRAL (Fable, 2026-07) — PENDIENTE DE EJECUTAR → `docs/handoff-auditoria-fable.md`
4 agentes en paralelo (datos/sync · live · seguridad · UI), hallazgos verificados en
código. Lo más grave: **reglas de PocketBase 100% abiertas** (un alumno puede
auto-puntuarse/borrar actividades ajenas), **las respuestas correctas viajan al móvil
del alumno**, XSS vía `backgroundImage`, borrados que resucitan (sin tombstones),
fallo silencioso con localStorage lleno, y fullscreen denegado que mata la app con la
pantalla roja. El handoff tiene 30+ ítems priorizados (P0 seguridad → P3 UI) con
archivo:línea, escenario y fix; empezar por los "quick wins" listados al final.

### ✅ RESUELTO (v1.51.178 → v1.51.180) — Emparejar no conectaba en VERTICAL → `docs/handoff-emparejar-vertical.md`
**Eran DOS causas encadenadas + 1 mejora de layout** (cada una tapaba a la siguiente):
- **v1.51.180 — las cuerdas se SOLAPABAN con las tarjetas en vertical.** Al reordenar el
  andamio a filas arriba/abajo (rejilla 2×2 por grupo), una cuerda entre dos tarjetas de la
  MISMA columna era vertical y pasaba por encima de las tarjetas intermedias. Fix:
  Emparejar NO se reordena a filas en portrait — mantiene DOS COLUMNAS laterales en ambas
  orientaciones (`styles/match.css` portrait + rama portrait de `fitLayout`), así las
  cuerdas cruzan el pasillo central en horizontal y nunca pisan otra tarjeta.
- **v1.51.179 — la cuerda VERTICAL no se dibujaba (frente a frente).** El motor de
  cuerdas (`core/connectRope.js`) daba la sombra con un filtro SVG `feDropShadow` cuya
  región va en % del BOUNDING BOX; una cuerda vertical (dos tarjetas alineadas → mismos x)
  tiene bbox de ANCHO 0 → el filtro colapsaba y borraba la cuerda ENTERA (las diagonales
  cruzadas sí se veían). El `SAG` solo cubría el caso horizontal (alto 0), no el vertical.
  Fix: fuera el filtro; la sombra es ahora un trazo desplazado (`ropeHtml`), que se pinta
  en cualquier orientación. Afecta a Emparejar y Etiqueta-el-diagrama (motor compartido).
  Logs `[match]` restaurados como TEMPORALES (confirmar en dispositivo → quitar).

Causa REAL (reproducida headless con toque real vía CDP, no PointerEvents sintéticos):
en portrait el `.ww-stage` (corredor central, `flex:1` del andamio) se estiraba a ~1000px
de HUECO MUERTO en marcos muy altos, empujando los dos grupos a los extremos. Al arrastrar
entre ellos se soltaba en ese vacío y `targetCard` cancelaba por su regla "más cerca del
origen que del destino → cancela" (con un corredor así, medio arrastre legítimo cae ahí).
Fix (dos partes): (1) `styles/match.css` portrait — corredor fino + `justify-content:center`
(grupos juntos, cuerdas cortas); (2) `templates/match/player.js targetCard` — se quitó la
comparación frágil origen-vs-destino; ahora todo arrastre al grupo opuesto conecta con la
tarjeta más cercana, y solo cancela si se suelta sobre la propia tarjeta. Logs `[match]`
temporales retirados.

### 🔴 DEUDA DETECTADA EN REVISIÓN (caza de bugs live/session) — PENDIENTE

#### A. ✅ RESUELTO (v1.51.272) — Lost-update en el blob `state` de `live_sessions` → `docs/handoff-deuda-a.md`
- **Qué era**: las respuestas ya vivían en `live_answers`; quedaba `joinSession` (load→push a
  `players[]`→PATCH del blob completo) → 30 entradas a la vez se pisaban ("un alumno no entra y hay
  que refrescarle").
- **Fix (A1-A4)**: colección **`live_players`** (fila por jugador, `playerId` = id de fila, índice
  ÚNICO (session,name) → apodos atómicos vía retry del 400). Adaptador PB dual (`playersReady()`
  cacheado): join = POST fila; listPlayers/kickPlayer sobre filas; `subscribeRoom` añade el topic
  `live_players`; `userId` = anon id estable. **`leaderboard()` DERIVADO** de `live_answers.points` +
  nombres (misma fuente que el podio). El blob quedó host-only → cerrada POR DISEÑO. Test:
  `tests/liveJoin.test.mjs` (retry de apodo con fetch inyectado). Aceptación real: `tools/stress-live.mjs`.
- **PASO DEL USUARIO**: `#/admin` → "Crear colecciones" (añade `live_players`); luego
  `node tools/stress-live.mjs <PIN> 30` contra la Pi. Ver el handoff.

#### B. ✅ RESUELTO (v1.51.277) — Doble puntuación en modo carrera (`'race'`)
- **Qué era**: en fase `'race'` el candado de primera respuesta se omitía por completo, así que
  re-enviar una respuesta YA CORRECTA la reseteaba a `{correct:null}` y un `settle` posterior la
  re-puntuaba (doble conteo). El reintento de un FALLO sí es legítimo (la carrera re-encola).
- **Fix**: el candado en `kernel/session/engine.js submit()` ahora cubre en carrera las respuestas ya
  CORRECTAS (`if (prev && (!isRace || prev.correct === true)) return;`) — una correcta no se pisa; una
  incorrecta sí se puede reintentar. Test: `tests/sessionEngine.test.mjs` (carrera: correcta no dobla,
  fallo sí reintenta).

#### B-bis. ✅ RESUELTO (v1.51.267) — Respuestas REZAGADAS sin puntuar
- **Qué era**: una respuesta que llegaba DESPUÉS del settle de su pregunta (rescate del trazo al
  avanzar, reintento de la cola offline, red lenta) se quedaba `scored:false` → 0 puntos para
  siempre. También las pendientes cuando el profe cerraba sin revelar la última pregunta.
- **Fix**: `engine.settle(i, { keepPhase })` (kernel) + `settlePending(sessionId)` en el adaptador
  PocketBase, que **`endSession` llama antes de marcar `ended`**: cerrar la sala liquida todo lo
  pendiente en UNA pasada (1 lectura + 1 PATCH por fila nueva + 1 guardado). `keepPhase` evita que
  la fase salte a `reveal` encima del podio; preservar el veredicto de las ya puntuadas evita el
  doble conteo. Espejado en el driver `local`. Test: `tests/liveLocal.test.mjs` (incl. cerrar dos
  veces = idempotente).

#### C. `autoScore` colapsa `correct: null` → `false` (medio)
- **Qué**: `engine.js autoScore` hace `correct: !!r.correct`; un ítem sin clave de respuesta
  (`scoreSubmission` devuelve `null`) marca a TODA la clase como incorrecta en vez de tratarse como
  no puntuable. Riesgo de cambiarlo: el `null` fluye a UI (✓/✗); requiere verificación visual.

#### D. Menores: ~~filtros PB sin escapar comilla simple~~ ✅ RESUELTO (`core/pbFilter.js`, todos los
  llamadores lo usan — `views/explore.js` era el último rezagado con `encodeURIComponent` a pelo,
  cerrado en la auditoría de estructura). Quedan: `saveResult` remoto sin cola propia (un resultado
  final puede perderse en blip; la cola de `results.js` cubre el caso local) y sin idempotency key
  en resultados (posibles filas duplicadas si se pierde el ACK).

#### F. ✅ RESUELTO (v1.51.277) — `submitProgress` (tablero de Ordena las Pelotas) no atómico
- **Qué era**: `submitProgress` hacía GET-then-POST/PATCH sin candado → dos progresos concurrentes
  veían "sin fila" y ambos POST → DOS filas `live_answers` del mismo alumno/ítem; el desempate por
  `ms` (siempre ~0) era arbitrario y el tablero del profe podía mostrar/puntuar un estado VIEJO.
- **Fix (mismo patrón que la deuda A)**: índice **ÚNICO (session, player, item)** en `live_answers` →
  una fila por celda garantizada por la BD. `submitAnswer`/`submitRaceAttempt`/`submitProgress`
  refactorizados a **upsert atómico** vía `postAnswer()` (POST; si choca con 400, re-lee y PATCHea la
  fila existente — helper compartido). Adiós al read-then-write que duplicaba. El desempate por `ms`
  deja de importar (no hay duplicados). Tests: `tests/liveAnswers.test.mjs` (conflicto → PATCH, sin
  2ª fila). **PASO DEL USUARIO**: re-correr "Crear colecciones" (añade el índice) + `stress-live`.

#### E. Hallazgos de la auditoría v2 — restantes (los demás ya aplicados)
- ✅ Aplicado: `SYNCED_KEY` con tope+LRU vía ls.js · podium/scoreboard de Equipos unificado en
  core/teams.js (`teamsScoreboardHtml`/`teamsPodiumHtml`) · `.vs-done` por tokens
  `--vs-done-fg/muted` (una regla base, skins solo definen tokens) · ritmo de juego con nombre
  en `core/timings.js` (FLASH_MS/COVER_MS/RACE_FLASH_MS/WIN_HOLD_MS/CONFETTI_ENCORE_MS).
  · `catch {}` de settle en hostLive → warn+toast al docente (los best-effort quedan comentados)
  · crossword.css tokenizado a paleta local `--cw-*` y SIN los 6 `!important` (prioridad por
  especificidad `.cw-cell.X`, verificado headless) · `myScore` de studentLive documentado como
  estimación de respaldo (autoritativo = leaderboard) y su `catch {}` ahora avisa.
- **DEUDA restante (pase propio)**:
  - **CSS**: bloque "keypad-fit" duplicado 4× (vs.css, teams.css, tv-show, colegios — ya derivan;
    extraer `.ww-keypad-fit` con verificación visual VS/Equipos × 3 skins × 2 orientaciones);
    scaffolding portrait del scoreboard copiado en los 3 skins.
  - **Vistas**: timer de carrera + poll-fallback duplicados dentro de hostLive (paintRace ↔
    paintLiveBoardHost); los pacing internos de hostLive siguen como literales.
  - **Core**: deadlines de hostLive/studentLive aún con `Date.now()`; load-guard + wiring 'online'
    duplicado entre submitQueue y results (absorber en la factory de offlineQueue; NO fusionar las
    colas — identidad/evicción distintas es correcto).
  - La fusión real de `raceQueue`/scoring de studentLive va con la deuda A (lost-update): mismo flujo.

#### G. Auditoría de estructura (motor/plantillas/vistas/docs) — RESUELTO
Auditoría con 4 agentes en paralelo (motor de sesión, contrato de plantillas, capa de vistas,
frescura de docs). Arreglado:
- **`submit()` des-puntuaba respuestas ya calificadas** (`kernel/session/engine.js`): el candado de
  primera respuesta solo bloqueaba mientras estaba SIN puntuar (`correct === null`); un reintento
  tardío (submitQueue, o un hidratado más viejo desde el adaptador PocketBase) que llegaba DESPUÉS de
  `settle()` pasaba el candado y pisaba el registro ya puntuado con `{correct:null, points:0}` — los
  puntos quedaban en `player.score` pero la respuesta se veía sin puntuar (y un settle posterior la
  volvería a sumar). Ahora el candado cubre cualquier respuesta existente, puntuada o no (test:
  `tests/sessionEngine.test.mjs` "submit() tardío…"). Distinto de la deuda B (esta SÍ se corrigió).
- **Tres criterios distintos de "¿puede esta plantilla auto-puntuar en Equipos?"**: `core/modes.js`
  exigía solo `renderRound`, `kernel/session/engine.js` (`createTeamsSession`) exigía solo
  `scoreSubmission`, `views/teamsView.js` exigía `scoreSubmission`+`getRoundPayload` (sin
  `renderRound`) — con ese último criterio, una plantilla con scorer+payload pero sin `renderRound`
  (Crucigrama/Ruleta/Abre-Cajas) podía habilitar "Automática" en Equipos y dejar el botón "Revelar"
  deshabilitado para siempre (`roundBody()` exige `renderRound` para pintar). Hoy no era alcanzable
  (`core/modes.js` ya oculta "Equipos" antes de llegar ahí), pero los tres criterios divergían.
  Unificado en `core/templateCapability.js` (`canAutoScoreRound`), usado por los tres.
- **`scoreCrossword` devolvía `{score,maxScore}`** en vez del contrato `{correct,points}` que leen
  TODOS los llamadores de `scoreSubmission` — inofensivo hoy (Crucigrama no tiene `renderRound`, así
  que nunca se invoca en un flujo real), pero una mina para el día en que sume `renderRound` (ya tiene
  `getRoundPayload`). Corregido a la forma estándar.
- **Condición de carrera en `views/playerView.js`** (`selectMode`/`mountSoloStart`, ambos async):
  cambiar de modo dos veces rápido (o pulsar "Iniciar" y luego otro modo antes de que el player
  terminara de montar) podía dejar el `disposer` del modo NUEVO huérfano (nunca se le llama
  `dispose()`) y el DOM del modo viejo pintado encima. Fix: ficha de generación (`modeToken`) — un
  `runMode()`/`mountSoloStart()` que resuelve tarde se descarta si ya no es la selección vigente.
- **`views/explore.js`** construía el filtro PB con `encodeURIComponent` a pelo (no escapa la comilla
  simple) — el único rezagado tras el fix de `core/pbFilter.js`; migrado a `pbEscape`/`pbFilterParam`.
- **`views/studentLive.js paintRace`**: el reintento tras responder (`setTimeout(paintRace, …)`) no
  comprobaba `session.phase` — si el profesor terminaba la carrera en esa ventana, repintaba una
  pregunta de carrera sobre el resultado/podio ya mostrado. Ahora guarda `session.phase === 'race'`.
- **Metadata**: `wheel.needsImageUpload` decía `false` pese a tener subida de imagen por entrada en
  su editor → `true`. `registerTemplates.js`/`CLAUDE.md`/`modos-de-juego.md` decían "las 11" → 12.
- **Docs**: `docs/arquitectura.md` y `docs/ESTADO.md` (snapshots ANTERIORES a PocketBase, con su
  propio aviso) movidos a `docs/historico/` — `docs/historico/README.md` ya declaraba que la
  documentación viva vivía fuera de ahí, pero ambos seguían sueltos en `docs/`, contradiciéndolo.
  README.md/testing.md/panorama-actividades.md actualizados con las 12 actividades + suites `diagram`
  y `styles` + referencias cruzadas a `docs/estilos-de-actividad.md`.
- **Documentado como deuda NUEVA** (no arreglado, ver F arriba): `submitProgress` no atómico en el
  tablero compartido de Ordena las Pelotas en vivo.

### 🟢 DEUDA IMPORTANTE — RESUELTA

#### 1. ✅ Retiro de Supabase — RESUELTO
- **Estado**: RESUELTO. Supabase ya no se usa en ninguna ruta. Eliminados: `core/supabase.js` (stub),
  `core/transport/assignments.js`, `supabase.config.js` y `adapters/supabase/*` (live, room, remoteStore,
  realtime, assignments). `adapters/index.js` solo conoce `local` y `pocketbase`.
- **Auth**: `core/auth.js` ya estaba en PocketBase (email/password). `core/identity.js` devuelve el anon id
  en cualquier backend; los mains usan `ensureIdentity()` (antes `ensureAuth` del stub Supabase).
- **Reportes/explorar**: `views/reports.js` y `views/explore.js` ya consultaban `PB_URL` directamente.
- **Bonus**: `core/connection.js` (banner de reconexión) había quedado huérfano al retirar el adaptador
  Supabase que lo alimentaba → re-cableado en `adapters/pocketbase/realtime.js` (`reconnecting` en backoff,
  `connected` tras el handshake PB_CONNECT). El banner vuelve a funcionar.

#### 2. ✅ `Date.now()` no determinista en lógica de dominio — RESUELTO
- **Estado**: RESUELTO. `core/clock.js` expone `clock.now()` (= `Date.now()` en prod). Migrados:
  `core/effects.js` (cooldowns), `core/textCorrectionRound.js` (startedAt/timeUsed),
  `core/assignmentRules.js` (defaults `now`), `core/submitQueue.js` (ts), `core/results.js`
  (`_queuedAt`), `core/sounds.js` (cooldown), `core/errorLog.js` (throttle).
- **Tests**: `tests/clock.test.mjs` (4) — congelar `clock.now` hace `isPastDue`/`assignmentGate` deterministas.
- **✅ Cerrado en auditoría**: los players (quiz/math `t0`), `core/soloPlayer.js` y `studentTask`
  ya usan `clock.now()`. Solo quedan los deadlines de hostLive/studentLive (pase aparte, mayor superficie).

### 🟢 DEUDA ARQUITECTÓNICA — RESUELTA (✅ players estandarizados)

#### 3. ✅ Players sin contrato uniforme → pérdida silenciosa de datos
- **Estado**: RESUELTO. Las tres capas (Contrato / Shells / Cores) están en producción.
  - `core/soloTimer.js` (`createCountdown`) cierra los 3 timers divergentes (Quiz, Froggy, Wordsearch).
  - `core/soloPlayer.js` expone `runFreeformPlayer` y `runSequentialPlayer`.
  - **FreeformShell** activo en Wheel y Question-Live → ya guardan resultado (`trySaveResult`).
  - **SequentialShell** activo en Math, Quiz y Froggy → loop/timer/finish/trySaveResult unificados.
- **Cosmética COMPLETADA**: Memory, Match, Wordsearch y Crossword ya usan `runFreeformPlayer`.
  Crossword ahora guarda puntos reales (`solvedIds.size · pointsPerCorrect`), no el conteo crudo de palabras.
  `runFreeformPlayer.finish()` acepta `lead`/`stats` como función de `{ timeUsed, score, maxScore }` y
  devuelve esos valores (para overlays propios con `skipResultScreen`, p.ej. la celebración de Crossword).
- **Tests**: `tests/soloTimer.test.mjs` (5) + `tests/soloPlayer.test.mjs` (5, incl. submit idempotente, avance manual y finish temprano).

## Arquitectura de Players (plan de estandarización)

Tres capas, sin herencia forzada:

```
CONTRATO  (templates/base.js)      — qué DEBE hacer cada player
SHELLS    (core/soloPlayer.js)     — cuándo: timer, avance, finish, trySaveResult
CORES     (templates/*/player.js)  — cómo: drag, click, tipo, animación (único por plantilla)
```

**Shell Secuencial** `runSequentialPlayer(rootSel, activity, opts, callbacks)` ✅:
- Maneja: `state` (`idx`/`score`/`startedAt`/`answers`), timer opcional, `idx++`, `finish()`, `trySaveResult()`, `onFinish()`, emits `QUESTION_SHOWN`/`PODIUM`, `maxScore`.
- El core provee `renderItem(ctx)` y, opcionalmente, `maxScore`, `onFinish` (teardown), `resultScreen`.
- `ctx`: `{ item, idx, total, score, state, timerSecs, submit, next, finish, startTimer }`.
  - `submit(record, { auto=true, delay })` — registra la respuesta UNA vez (idempotente: timeout+clic registran una). `auto:true` avanza tras `delay`; `auto:false` para pacing propio.
  - `next()` / `finish()` — para cores con avance dirigido por animación (Froggy salta y avanza en `onfinish`, o termina al llegar a la meta).
- Callers EN PRODUCCIÓN: Math, Quiz, Froggy.

**Shell Libre** `runFreeformPlayer(rootSel, activity, opts)` → devuelve `ctx` ✅:
- El player llama `ctx.finish({score, maxScore, lead, stats, skipResultScreen})` al terminar.
- Shell garantiza: `resultScreenHtml()` (salvo `skipResultScreen`), `trySaveResult()`, `onFinish()`.
- Callers EN PRODUCCIÓN: Wheel, Question-Live. Pendientes (cosméticos): Memory, Match, Wordsearch, Crossword.

**Timer único** `core/soloTimer.js` — `createCountdown(secs, {onTick, onTimeout, setIntervalFn?, clearIntervalFn?})` ✅:
- Cierra 3 implementaciones divergentes (Quiz, Froggy, Wordsearch). Scheduler inyectable → tests deterministas.

**Orden de migración** — COMPLETADO:
1. ✅ `core/soloTimer.js` + migrar Quiz/Froggy/Wordsearch
2. ✅ `FreeformShell` — cerró bug trySaveResult en Wheel/Question-Live
3. ✅ Migrar Math al SequentialShell
4. ✅ Migrar Quiz al shell
5. ✅ Migrar Froggy al shell (todas sus animaciones intactas)
