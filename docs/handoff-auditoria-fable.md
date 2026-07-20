# HANDOFF — Auditoría integral (Fable, 2026-07-20) → tareas para Opus 4.8

Auditoría con 4 agentes en paralelo (datos/sync · live/tiempo real · seguridad ·
robustez UI), hallazgos verificados en código antes de registrarse. **Excluye** lo ya
documentado en CLAUDE.md como deuda A (lost-update `state`), B (doble puntuación race),
C (`autoScore` null→false), F (`submitProgress` no atómico) — eso sigue en su sección.

## Reglas de ejecución (Opus: leer antes de tocar nada)
- Un commit por bloque coherente; `VERSION` bump en CADA commit; `node tests/run.mjs`
  verde antes de commitear; push a rama de trabajo + **`main`** (sirve aulareto.com) +
  `ACTIVIDAD2`. TODO AL MAIN.
- Si es norma, es test: cada fix de esta lista debe dejar un test que lo bloquee
  (o justificar en el commit por qué no es testeable con el driver local).
- Verificar los fixes de UI headless (receta `docs/testing.md`, Chromium preinstalado).
- Los cambios de **collection rules de PocketBase** (P0-1..3) requieren acción en el
  SERVIDOR del usuario (pb.lanube.uno): preparar el cambio en `views/adminView.js` +
  instrucciones/comandos listos para que el usuario los aplique. NO se pueden verificar
  desde el sandbox — dejarlo explícito al usuario.
- Ir marcando cada ítem aquí como ✅ con la versión del fix.

---

## P0 — SEGURIDAD (lo más grave del repo)

### P0-1 🔴 CRÍTICO — Reglas de PocketBase 100% abiertas en TODAS las colecciones
`views/adminView.js:535`: `publicRules = { listRule:'', viewRule:'', createRule:'',
updateRule:'', deleteRule:'' }` aplicado a `activities, results, live_sessions,
live_answers, assignments, assignment_attempts`. En PB, `''` = acceso público total.
**Explotable por un alumno con DevTools**: `PATCH` al `state` de `live_sessions`
(ponerse 9999 pts, cambiar fase, terminar la sala — el shape exacto está a la vista en
`adapters/pocketbase/realtime.js:68,240`); `POST` a `results`/`assignment_attempts` con
score arbitrario; **modificar o borrar actividades de otros autores** (`activities` con
update/delete públicos).
**Fix**: reglas reales en el setup de `adminView.js` — mínimo:
`activities.updateRule/deleteRule = "@request.auth.id != '' && author.id = @request.auth.id"`
(ajustar al esquema real de author), `live_sessions.deleteRule` restringida, y valorar
qué mutaciones de `state` deben pasar por el host. Entregar al usuario el paso a paso
para re-aplicar reglas en su PB (tiene `gh`/PowerShell; el panel `#/admin` ya tiene el
botón de setup — que el botón aplique las reglas NUEVAS y documente la migración).

### P0-2 🔴 CRÍTICO — Las respuestas correctas viajan al móvil del alumno
`adapters/pocketbase/realtime.js:138` guarda el `activity` ÍNTEGRO (con
`answer`/`answerIdx`) en la sala; `findRoomByCode:159`/`fetchSession:182` lo devuelven a
CUALQUIERA (agravado por P0-1: `listRule` pública). Un alumno abre la pestaña Network o
hace un fetch por `code` y lee las respuestas antes de contestar. El comentario de
`hostLive.js:60-63` sobre snapshot "sanitizado" + `session_keys` es ASPIRACIONAL:
`fetchSessionKey` (`realtime.js:204`) devuelve el mismo `rec.activity`.
**Fix**: al crear la sala, guardar en `activity` un snapshot SIN claves (reutilizar la
lógica de `getRoundPayload` por plantilla para strippear) y las claves reales en un
campo/colección solo accesible al host. Es el fix con más diseño de este bloque —
coordinarlo con la deuda A si se toca el esquema.

### P0-3 🟠 ALTO — Salas enumerables + PIN de baja entropía
`live_sessions.listRule=''` permite listar TODAS las salas (con `code`, `activity` con
respuestas y `state`) sin conocer ningún PIN (`GET /api/collections/live_sessions/records`).
Además los códigos son palabras cortas de un diccionario pequeño (`core/liveWords.js`) sin
rate-limiting. **Fix**: cae junto con P0-1 (sin listRule pública; join por `code` exacto).

### P0-4 ✅ HECHO (v1.51.205) — XSS almacenado vía `presentation.backgroundImage` (roba la sesión del profe)
Fix aplicado: `isSafeBgImage()` en `core/backgrounds.js` (whitelist `data:image/<raster>;base64`),
`backgroundPreviewHtml` usa `url('…')` en comillas simples + whitelist (arregla también el
bug de render por comillas dobles anidadas), `applyBackground` solo pinta si es seguro, y
`core/io.js` descarta un `backgroundImage` no válido al importar. Test: `tests/security.test.mjs`.
`core/backgrounds.js:77` (`backgroundPreviewHtml`) interpola `imageUrl` SIN escapar dentro
de `style="...url("${imageUrl}")"`. Llega desde JSON importado (`core/io.js`, sin
sanitizar) o actividad pública forkeada (y con P0-1 cualquiera puede publicar). Payload
que rompe el atributo → script en el navegador del profesor → exfiltra el token PB de
`localStorage` (`core/auth.js:13`). **Fix (one-liner + validación)**: `escapeHtml(imageUrl)`
en `backgrounds.js:77` y validar prefijo `data:image/` al importar (`core/io.js`) y al
subir (`readBackgroundImage`). Revisar el mismo patrón en `views/playerView.js:216` y
`core/editorShell.js:51`. Test: importar actividad con `backgroundImage` malicioso →
el HTML resultante no contiene el payload sin escapar.

### P0-5 ✅ FALSO POSITIVO (verificado v1.51.205) — `vsView.js:313,397` usan `label.textContent`, no `innerHTML`. `textContent` NO parsea HTML → ya es seguro; añadir `escapeHtml` haría doble-escape. El resto de `vsView` (incl. `vsBarHtml`) escapa correctamente. Sin cambio.

Nota (verificado, NO tocar): `escapeHtml` es consistente en el proyector (nicknames en
hostLive/podium/teams/reports escapados) y `pbFilter` se usa bien en todos los filtros.

---

## P1 — PÉRDIDA DE DATOS (profesor)

### P1-1 🔴 CRÍTICO — Actividades borradas RESUCITAN vía sync (sin tombstones)
`core/storage.js:76-88` + `core/storageMerge.js:20`. `remove()` borra local y lanza el
DELETE remoto en background sin cola de reintento; si falla (offline, blip, cierre de
pestaña), el registro sigue en PB y el próximo `sync()` lo RE-AÑADE (`mergeRemote` mete
toda fila remota que no exista en local). Igual en multi-dispositivo.
**Fix**: lista de tombstones persistente (ids borrados pendientes de confirmar) que
(a) `mergeRemote` consulte para no reintroducir y (b) una cola estilo `offlineQueue`
reintente el DELETE. Test en `storageMerge`/`storage`.

### P1-2 🔴 CRÍTICO — localStorage lleno = fallo SILENCIOSO de todos los saves
`core/storage.js:17` (`writeLS`) ignora el booleano de `lsSet` (`core/ls.js`). Todas las
actividades viven en UNA clave; cuando el blob supera la cuota (fácil con imágenes
inline, ver P1-5), NINGÚN save/remove/sync local persiste y `save()` finge éxito.
**Fix**: `save()` comprueba el retorno de `lsSet`; si falla, conserva `_unsynced`,
lanza/avisa (toast persistente, no once-per-session) y no finge éxito. Test: mock de
`lsSet` que devuelve false.

### P1-3 🟠 ALTO — Edición guardada que nunca llegó al servidor no se reintenta
`core/storage.js:38-54`: `save()` borra `_unsynced` ANTES de que el PATCH remoto
confirme; si la pestaña se cierra con el PATCH en vuelo, el registro queda divergente
sin flag → `retryUnsynced()` lo ignora para siempre. **Fix**: marcar `_unsynced=true`
optimista antes del remoto y limpiarlo solo en el `.then` de confirmación. Test directo.

### P1-4 🟠 ALTO — `mergeRemote` pisa ediciones locales pendientes (`_unsynced`) por reloj de pared
`core/storageMerge.js:20`: criterio `remote.updatedAt >= local.updatedAt` sin mirar
`_unsynced`. Reloj atrasado en un dispositivo → su edición más nueva pierde el LWW y se
borra en silencio. **Fix mínimo**: si `local._unsynced`, remoto NO pisa (conservar local
o marcar conflicto). Test en `storageMerge.test.mjs`.

### P1-5 🟠 ALTO — Import `preserve` re-sella `updatedAt` → un backup VIEJO machaca lo nuevo
`core/io.js:50`: con `strategy:'preserve'` se conserva el id pero se pone `updatedAt`
fresco → el import gana el LWW local y remoto sin confirmación. **Fix**: conservar el
`updatedAt` del JSON; si el id existe con `updatedAt` mayor, confirmar o duplicar.

### P1-6 🟡 MEDIO — Presupuesto de imágenes por ACTIVIDAD inexistente
`core/upload.js` limita 200 KB POR imagen; 20 ítems con imagen ≈ 4 MB en un registro →
(a) revienta la cuota del blob localStorage (cae en P1-2), (b) puede superar el límite
de PB → `_unsynced` pegado para siempre. **Fix**: validar tamaño total del JSON de la
actividad al guardar y avisar antes de que sea insincronizable.

### P1-7 🟡 MEDIO — `results.js` recorta la cola a 60 SIEMPRE (descarta resultados viejos aunque haya espacio). Subir tope / avisar al descartar.
### P1-8 🔵 BAJO — `toId()` (`adapters/pocketbase/remoteStore.js:12`) lowercasea+trunca a 15 → ids distintos pueden colisionar y pisarse en PB. Fix: hash del id completo.
### P1-9 🔵 BAJO — `core/io.js:39` no valida `parsed.version` del wrapper de import.

---

## P2 — LIVE / TIEMPO REAL (aula con 30 alumnos)

### P2-1 🔴 CRÍTICO — `submitAnswer` no valida fase/ítem/deadline en servidor; `ms` lo mide el reloj del ALUMNO
`adapters/pocketbase/realtime.js:302-321`: el path de colección solo comprueba "ya existe
fila" — no `phase==='question'`, ni `itemIndex` vigente, ni deadline (el guard del engine
puro `kernel/session/engine.js:117-119` NO corre aquí). Y `ms = Date.now() −
lastQuestionShownAt` del móvil (`studentLive.js:333`): un alumno con SSE retrasada 3 s
recibe bonus máximo por contestar lento; respuestas tras el timer puntúan; filas
huérfanas post-settle alimentan la deuda B. **Fix**: rechazar en `submitAnswer` si
fase/ítem no coinciden o `now > deadline+gracia`; derivar `ms` del `deadline` del
servidor. Coordinarlo con la deuda A (misma zona).

### P2-2 🟠 ALTO — Unicidad de PIN frágil + salas terminadas nunca se purgan
`realtime.js:126-130,159-163`: los códigos en uso se recogen con `perPage=200` SIN
filtrar `status`, los reintentos usan un set VACÍO, y `endSession` nunca borra → con el
tiempo el fetch se trunca y dos salas pueden compartir PIN (los alumnos se reparten
entre las dos). **Fix**: filtrar `status!='ended'`, purga/expiración de salas viejas,
reintentos con el set real, e índice único de `code` OBLIGATORIO en el setup.

### P2-3 🟠 ALTO — Host sin red al expirar el timer → ronda muerta sin auto-reintento
`views/hostLive.js:304-355`: `doSettle` falla, el ticker ya se limpió, y al volver la
red `hostPaintDecision` devuelve skip (fase sin cambio) → nadie reinicia nada; 30
alumnos esperando indefinidamente salvo que el profe encuentre "Reintentar".
**Fix**: backoff de reintento en `doSettle` o que el resync reinicie el ticker.

### P2-4 🟡 MEDIO — Apodos duplicados (`engine.js:92-103` solo dedupe por userId): dos "Juan" indistinguibles al expulsar/revelar. Auto-sufijar.
### P2-5 🟡 MEDIO — Refresh del host pierde el modo elegido en el lobby (`hostLive.js:85,213`: `liveMode` nunca se persiste) → "Automático" vuelve a manual en silencio. Persistir en la sesión.
### P2-6 🟡 MEDIO — `setTimeout` desnudos en `studentLive.js:471` (`paintRace`) y `:292` (`qlSpin`): disparan tras navegar (uno ESCRIBE en servidor, otro pisa `#app`). Usar `ctx.setTimeout`.
### P2-7 🟡 MEDIO — Amplificación SSE ×3 (`realtime.js:470-479`: cada cambio notifica a las 3 tablas virtuales) y en carrera cada evento dispara `loadRaceAnswers()` = N fetches. Debounce + 1 consulta filtrada.
### P2-8 🟡 MEDIO — El alumno no ve countdown si `questionTimer` no está definido pero el host SÍ liquida a los 20 s (`studentLive.js:311` sin default vs `hostLive.js:82` con `||20`). Unificar default.
### P2-9 🔵 BAJO — `advanceMode` vs `liveMode` divergen (`hostLive.js:334`): elegir "Automático" en el lobby NO activa la liquidación temprana al responder todos.
### P2-10 🔵 BAJO — Jugador expulsado no se entera y sigue enviando (`studentLive.js:66-70` confía en sessionStorage sin revalidar contra `players[]`).

---

## P3 — ROBUSTEZ UI

### P3-1 🔴 CRÍTICO — Fullscreen denegado = pantalla ROJA de Error (la clase no puede jugar)
`core/fullscreen.js:5,7`: la promesa de `requestFullscreen()` no se captura; el
`try/catch` síncrono de `startScreen.js:80-86` no atrapa un rechazo async; el boot-guard
de los HTML (`teacher.html:107`, `embed.html:69`) convierte el `unhandledrejection` en
banner rojo que REEMPLAZA la app. Escenario típico: embed en iframe/LMS sin permiso de
fullscreen → pulsar "Iniciar" mata el juego. **Fix**:
`Promise.resolve((el.requestFullscreen||el.webkitRequestFullscreen)?.call(el)).catch(()=>{})`
(ídem rama exit). Test headless: denegar fullscreen y verificar que el juego arranca.

### P3-2 🟠 ALTO — Navegar por hash antes del autosave (2 s) pierde el cambio
`views/editView.js:99,155-162`: el teardown hace `clearTimeout` SIN flush y
`beforeunload` no cubre `hashchange`. Teclear y pulsar "Volver" en <2 s = cambio perdido.
**Fix**: en el disposer, si `dirty` → `save(activity)` (local es síncrono).

### P3-3 🟠 ALTO — Doble toque en "Iniciar" monta el juego DOS veces
`startScreen.js:80-86` sin guard de re-entrada; `mountSoloStart` captura `myToken` una
vez, así que el token no protege el doble tap (pizarras táctiles). **Fix**: flag
`started` en `onStart` / deshabilitar el botón al primer toque.

### P3-4 🟡 MEDIO — Players SOLO sin gancho de teardown: el `setInterval` de Ball Sort vive para siempre
`core/modes.js:110-118` descarta el retorno de `runPlayer`; `templates/ballsort/template.js:114`
descarta el `{unmount}`; `play.js:55` = interval de 250 ms nunca limpiado y "Jugar otra
vez" APILA uno más por partida (jank en pizarras de gama baja). Secundario: disposers de
`observeResize` descartados en match/diagram/crossword. **Fix**: propagar el disposer del
player hasta el `dispose()` real del modo (afecta al contrato — hacerlo con cuidado).

### P3-5 🟡 MEDIO — Tocar un tile de Tema/Fondo a mitad de partida SOLO reinicia el juego
`playerView.js:258-266`: `.skin-pick` llama `selectMode(currentMode)` → re-monta la
pantalla de inicio y pierde el progreso. Para `solo` basta `applySkin` al frame (ya se
hace); re-montar solo en VS/Equipos. **Fix**: condicionar el re-mount al modo.

### P3-6 🟡 MEDIO — Sin cache-busting de CSS/JS en los HTML (no hay SW; caché HTTP de Pages puede mezclar CSS viejo + JS nuevo tras deploy). Versionar `<link>`/import raíz con `?v=VERSION`.
### P3-7 🔵 BAJO — `templates/match/player.js:41-52` conserva los logs `dbg` marcados "TEMPORAL". Quitarlos.

---

## Orden sugerido para Opus
1. **Quick wins de una sesión** (bajo riesgo, alto valor): P0-4, P0-5, P3-1, P3-2,
   P3-3, P3-5, P3-7, P2-6, P2-8, P1-2, P1-3, P1-4, P1-9.
2. **P0-1/P0-3** (reglas PB): preparar código+instrucciones; requiere al usuario en el servidor.
3. **P1-1** (tombstones) y **P1-5/P1-6/P1-7**: bloque de storage con tests.
4. **P2-2/P2-3/P2-5/P2-7**: bloque live "operabilidad" (sin tocar esquema).
5. **P0-2 y P2-1**: los grandes — diseño junto con la deuda A (misma zona/esquema).
   No parchear a medias: proponer el diseño al usuario antes.
