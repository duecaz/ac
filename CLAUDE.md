# WW Actividades — Guía para Claude

## Reglas obligatorias (SIEMPRE)

### 1. Versión — en CADA commit y en CADA respuesta
- **SIEMPRE** sube `VERSION` en `core/constants.js` en cada commit (incremento de patch:
  `1.51.49` → `1.51.50`). Nunca bajar la versión, siempre hacia adelante (la caché y el
  service worker dependen de que la versión avance).
- **SIEMPRE** indica el número de versión en la respuesta del chat cuando termines un
  cambio, en formato `(vX.Y.Z)`, para poder referenciar exactamente por versión.
- El número de versión del commit y el de la respuesta deben coincidir.

### 2. Push a AMBAS ramas
Tras commitear, hacer push a las dos ramas:
```
git push -u origin claude/admiring-shannon-06ioqo
git push origin claude/admiring-shannon-06ioqo:ACTIVIDAD2
```
`ACTIVIDAD2` es la rama que sirve GitHub Pages (estático).

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

## Estándares transversales (no romper)
- **Pantalla de inicio** (`views/startScreen.js`): todo modo Individual pasa por ella (título +
  instrucciones + ajustes + Iniciar→fullscreen). El ejercicio queda oculto hasta Iniciar.
- **Registro de plantillas y arranque**: `core/registerTemplates.js` (las 11, punto único) +
  `core/boot.js` (sonidos/efectos al bus, versión, mute). Las 3 `main.*.js` NO repiten ese wiring.
- **Gama baja** (`core/perf.js`): `ww-lite` en `<html>` si ≤4 núcleos o ≤2GB → sin bucles de
  animación en reposo (cuerda Lottie estática, marquesina arcade quieta). El VS debe ser fluido en
  pizarras A55; nunca añadir bucles rAF continuos en el hilo principal sin gate `ww-lite`.
- **Filtros PocketBase**: SIEMPRE `pbEscape`/`pbFilterParam` (`core/pbFilter.js`), nunca
  `encodeURIComponent` a pelo (no escapa la comilla simple).
- **Puntos**: convención en `core/scoreHelpers.js` (basePoints/wrongPoints/useKahoot); Tildes VS
  puntúa 1 punto fijo por tilde buena (`scoreMarksPerHit`, las marcas de más restan).
- **Testeo**: mapa de suites + receta headless (Playwright) en `docs/testing.md`.

## Deuda técnica registrada

### 🔴 DEUDA DETECTADA EN REVISIÓN (caza de bugs live/session) — PENDIENTE

#### A. Lost-update en el blob `state` de `live_sessions` (CRÍTICO, arquitectónico)
- **Qué**: cada `submitAnswer`/`setSessionState`/`settleItem`/`join` hace load→mutate→PATCH del JSON
  `state` COMPLETO, sin concurrencia optimista. Con 30 alumnos respondiendo en la misma ventana de 1-2s,
  el PATCH de B pisa el de A → la respuesta de A se pierde en silencio (el PATCH devolvió 200, así que
  `submitQueue` NO reintenta). Igual al unirse (dos alumnos a la vez se clobbean en `players[]`).
- **Por qué no se arregló aún**: requiere cambio de esquema/diseño, no un parche. Opciones: (a) mover
  respuestas/scores a su propia colección PB (un registro por envío → sin colisión), o (b) merge/optimistic
  concurrency con `updated`/version y reintento. La opción (a) es la correcta para "nunca perder respuestas".
- **Mitigado parcialmente**: la cola offline (`core/offlineQueue.js`) ya evita pérdidas por reintentos
  concurrentes en el cliente; pero NO el clobber server-side. Es el siguiente gran objetivo.

#### B. Doble puntuación en modo carrera (`'race'`) (alto, código sin tests)
- **Qué**: en fase `'race'` el lock de primera respuesta se omite, así que un reenvío resetea
  `correct: null` y un `settle` posterior vuelve a sumar puntos. Reachable si hay un settle intermedio.
- **Por qué no se arregló**: el fix obvio (bloquear reenvío de respuestas ya puntuadas) podría romper el
  reintento legítimo de carrera; necesita entender el flujo `hostLive` race a fondo + un test que cubra
  `submit/settle` en `'race'` (hoy 0 cobertura). 

#### C. `autoScore` colapsa `correct: null` → `false` (medio)
- **Qué**: `engine.js autoScore` hace `correct: !!r.correct`; un ítem sin clave de respuesta
  (`scoreSubmission` devuelve `null`) marca a TODA la clase como incorrecta en vez de tratarse como
  no puntuable. Riesgo de cambiarlo: el `null` fluye a UI (✓/✗); requiere verificación visual.

#### D. Menores: ~~filtros PB sin escapar comilla simple~~ ✅ RESUELTO (`core/pbFilter.js`, ambos
  adaptadores lo usan). Quedan: `saveResult` remoto sin cola propia (un resultado final puede
  perderse en blip; la cola de `results.js` cubre el caso local) y sin idempotency key en
  resultados (posibles filas duplicadas si se pierde el ACK).

#### E. Hallazgos de la auditoría v2 — restantes (los demás ya aplicados)
- ✅ Aplicado: `SYNCED_KEY` con tope+LRU vía ls.js · podium/scoreboard de Equipos unificado en
  core/teams.js (`teamsScoreboardHtml`/`teamsPodiumHtml`) · `.vs-done` por tokens
  `--vs-done-fg/muted` (una regla base, skins solo definen tokens) · ritmo de juego con nombre
  en `core/timings.js` (FLASH_MS/COVER_MS/RACE_FLASH_MS/WIN_HOLD_MS/CONFETTI_ENCORE_MS).
- **CSS**: bloque "keypad-fit" duplicado 4× (vs.css, teams.css, tv-show, colegios — ya derivan);
  crossword.css con estados hardcodeados + 6 `!important` en cadena (tokenizar a `--ww-*`);
  scaffolding portrait del scoreboard copiado en los 3 skins.
- **Vistas**: timer de carrera + poll-fallback duplicados dentro de hostLive (paintRace ↔
  paintLiveBoardHost); los pacing internos de hostLive siguen como literales (pase propio);
  studentLive lleva doble contabilidad (`myScore`/`raceQueue`) que puede discrepar del
  leaderboard del servidor; varios `catch {}` en hostLive esconden errores reales de settle.
- **Core**: deadlines de hostLive/studentLive aún con `Date.now()` (migrar a clock en pase
  propio); load-guard + wiring 'online' duplicado entre submitQueue y results (absorber en la
  factory de offlineQueue; NO fusionar las colas — identidad/evicción distintas es correcto).

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
