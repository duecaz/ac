# Deuda RESUELTA — crónica (movida de CLAUDE.md el 2026-08-11)

> **Tipo**: histórico · **Sube a**: [README](README.md) · **Vigila**: nadie (congelado)

CLAUDE.md es el MAPA del repo y esta crónica lo estaba convirtiendo en diario:
cada bloque «✅ RESUELTO» se quedaba para siempre y había que scrollear 400
líneas de pasado para llegar a la deuda VIVA. Aquí está ÍNTEGRA, en el orden en
que estaba; en CLAUDE.md queda solo lo abierto. La nota del PASO DEL USUARIO
(v1.51.428) también vive aquí porque se aplicó en la Pi el 2026-08-10.

### ✅ RESUELTO (v1.51.217 → v1.51.235) — Sistema de usuarios + biblioteca pública
Biblioteca tipo Wordwall + cuentas de profe, ejecutado y verificado en real:
- **S1-S3** (gate/claim/almacén por usuario · portada+explore+likes+publicar · reglas duras
  + admin + reportes) → `docs/historico/handoff-biblioteca-publica.md`.
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

### ✅ RESUELTO (v1.51.390) — Equipos + Sopa de Letras: el hallazgo se perdía
El diagnóstico inicial ("una respuesta por turno vs onSubmit por palabra") era la
capa de ENCIMA; al reproducirlo con el arrastre real se vio la causa primera:
**la rejilla colapsaba a 4×4 px** — `#teams-round` no entraba en la cadena de
flex de `.teams-card`, la Sopa mide su tablero contra la altura del contenedor
(`height:100%` + cqb) y el arrastre nunca llegaba a las celdas (caían fuera,
sobre la tarjeta). Dos fixes:
- `styles/teams.css`: `#teams-round` entra en la cadena de flex (las rondas de
  contenido natural —opciones, teclado— no se estiran; solo la Sopa llena).
- `kernel/session/engine.js`: el `roundPayload` de Equipos pasa `found` (los
  valores ya respondidos en turnos anteriores), MISMO contrato que VS — la Sopa
  pre-marca lo encontrado y un equipo no puede re-usar la misma palabra cada
  turno. La semántica de turno ya era correcta: el scorer acepta CUALQUIER
  palabra de la lista, un hallazgo = una respuesta.
La entrada de `CONOCIDOS` en `tools/matrix-smoke.mjs` se retiró: la matriz juega
ahora 30/30 y una regresión aquí la tumba.

### ✅ HECHO (v1.51.427) — PASE DE SKINS mirando capturas: 3 fallos reales
Sonda que captura las superficies tocadas (quiz · globos · sopa · tildes) × 3 skins y se
REVISAN las imágenes (no solo números). Encontró y arregló:
- **Tokens de TINTA por forma** (`--ww-shape-N-fg`) en los 7 skins, con el valor CALCULADO
  contra cada paleta: en arcade el cian y el amarillo llevaban letra blanca (1,4-1,8:1 →
  ahora 8-10:1); en retro/jungle/tv-show, sus combinaciones. `skins.test` exige el set
  completo, así que un skin nuevo no puede olvidarlos.
- **Kahoot no ponía `color:`** en su marco (retro y jungle sí): la pregunta del quiz salía
  en tinta oscura sobre su degradado morado, casi ilegible en pizarra. Una línea.
- Ese arreglo DESTAPÓ un hueco viejo: la tinta de la hoja de Tildes/Comas solo estaba
  fijada para `body.bg-notebook`, no para el MARCO → texto blanco sobre crema (invisible)
  con kahoot. Quien pinta el papel pone la tinta: regla ampliada al frame.
Verificado con capturas antes/después (kahoot y arcade legibles en quiz, globos y tildes).

### ✅ HECHO (v1.51.425) — los tests que vigilan la REDACCIÓN, medidos y en ratchet
Descubierto trabajando, no auditando: al mover los relojes a la hora común (§22-5) —un
refactor correcto— una suite falló porque exigía la línea literal
`lastQuestionShownAt = openAtMs || clock.now()`. Una cita de fuente da TRABAJO cuando
cambias algo bien hecho, y SILENCIO cuando rompes el comportamiento por otro camino.
`tests/citasFuente.test.mjs` las cuenta (86 en 22 suites) y las congela: **el número solo
baja**. No se pueden eliminar todas —hay invariantes de estructura que solo se ven
leyendo—, pero cada una nueva tiene que justificar por qué no es un test de comportamiento
(`citaDeFuente()` en `tests/helpers/fuente.mjs` las marca y, al fallar, explica las dos
posibilidades en vez de gritar "roto").
**El patrón a repetir** (ejemplar hecho): `roundsLoop` bajó de 12 a 8 porque el cálculo del
puesto y la distancia del alumno se extrajo de la vista a `core/liveRank.js standingOf`
(§21, el dueño del ranking) — ahora el test comprueba NÚMEROS (empate, primero, ausente),
no líneas. No se borra la cita: se mueve el cálculo a donde se puede ejecutar.

### ✅ HECHO (v1.51.423) — R1 «se lee a 3 m» deja de ser una promesa sin red
La matriz MIDE ahora el **contraste real** (color computado contra el fondo real, componiendo
alfa y saltando degradados) de todo el texto del marco, en las 13 plantillas × 3 modos.
Umbral 3:1. Nació encontrando **tres fallos reales**, todos invisibles hasta hoy:
- **Opciones del quiz** (`.ww-kahoot-grid`): letra blanca sobre ámbar = **2,4:1**, y además
  `font-size: 1.5rem` **FIJO** — 24 px lo mismo en un móvil que en una pizarra 4K, en el texto
  que la clase entera lee. Ahora escala con el marco y va a 6,2:1.
- **Globos** (`.gl-c3`): el mismo blanco sobre ámbar, 2,4:1 → 4,5:1 medido.
- **Sopa, palabra encontrada**: verde claro sobre verde claro, 2,4:1 → 5,1:1.
Por qué el ratchet de §3 no lo veía: **`styles/live.css` estaba en EXCLUDED como "chrome"** y
dentro vive el juego. Ya está en la lista escaneada, con su deuda restante congelada.
El **tamaño** se mide y se PUBLICA pero NO es veredicto, con el motivo escrito: el texto más
pequeño casi siempre es chrome (contadores, botones, títulos). Juzgarlo pide que la plantilla
DECLARE su texto de lectura (`data-ww-read`) — decisión de contrato pendiente en §29.

### ✅ HECHO (v1.51.419) — LÁPIZ / BORRADOR en Tildes y Comas
La herramienta se detecta por el TAMAÑO del contacto (`core/penDetector.js`: punta dibuja,
palma borra) y acierta casi siempre — pero en una pizarra sin calibrar, o con un lápiz que
no reporta área de contacto, BORRAR era imposible. Y aquí una marca de más RESTA
(`scoreMarksPerHit`, puntaje neto): no poder borrar es perder puntos por algo que el alumno
sabía. Ahora la ronda de dibujo trae **dos botones** (Lápiz · Borrador) cableados al
`setEraser()` del canvas — que existía desde el primer día y **no lo llamaba nadie**.
Arranca en LÁPIZ (§29: cero toques extra para responder), tamaños en unidades de contenedor
y color por token (§3 · R1). Vigilado por `tests/tcTools.test.mjs` (5, con contra-prueba
§28 R2b: borra el TRAZO, nunca contenido del profe) y probado con toque real (CDP): dibujar
→ borrar con el botón → se entrega sin marcas.

### ✅ RESUELTO (v1.51.418) — el reloj de CADA aparato (§22-5) → `docs/handoff-reloj-aparatos.md`
Los DOS fallos de la ronda del compañero eran UNO: los instantes de la sala
(`answers_open_at`/`deadline`) se estampaban con el reloj del PROFE y se comparaban contra el
reloj de CADA móvil. Reproducido con sonda de dos pantallas: −10 s → el profe ve
«Preparados… 9» y el alumno «19»; −25 s → las respuestas no se abren nunca y la pregunta se
liquida «sin respuesta · 0 puntos»; +10 s → la ventana de lectura desaparece.
DOS defensas: **`core/serverNow.js`** (hora común — desfase medido con la cabecera `Date` de
PB en `core/pbHttp.js`, mediana de 5 muestras, re-medido en cada respuesta; sin servidor = 0
= como antes; R7: en memoria) y **`core/liveGate.js`** (cinturón — la espera de lectura se
acota y una pregunta cerrada no hace leer a nadie; `studentLive` recuerda por ítem que ya
cumplió su lectura). Regla **`reloj-sala`** en `core/normsCheck.js` + ley §22-5.
`live-smoke` gana la pasada del RELOJ DESFASADO (paridad con servidor · cinturón sin él), y
se verificó que la red FALLA sin el arreglo. Suites: `serverNow` (7) · `liveGate` (5).

### ✅ RESUELTO (v1.51.438-439, aplicado en la Pi el 2026-08-11) — §22-1: el sello NO se guardaba porque a 7 colecciones les faltaban `created`/`updated`
En PocketBase ≥0.23 los autodate **hay que declararlos**; el panel los declaraba al
CREAR pero al REPARAR una colección existente los excluía igual que en <0.23 (donde
declararlos sí revienta) → las colecciones VIEJAS no se arreglaban nunca. `live_sessions`
era una: sin `updated` en la respuesta del PATCH, `noteItemOpened` salía por `!rec.updated`
y **el sello de apertura ni se intentaba, en silencio** → el tiempo de una carrera caía al
`ms` que AFIRMA el móvil (con dos alumnos empatados, el podio ordenaba por nombre).
- Lo cazó el botón `#/admin` → **Probar carrera**, tras tres pasadas en las que el aviso
  fue afinándose hasta señalar la causa; el `catch` mudo del sello (R6) era lo que lo
  había mantenido invisible durante versiones.
- Arreglo: `core/pbSchema.js camposQueFaltan()` (en ≥0.23 los autodate SÍ se reparan) +
  respaldo `origenServidor()` en `core/serverMs.js`, para que el ORDEN de una carrera no
  dependa nunca de un PATCH best-effort. Tests: `pbSchema`, `serverMs`, `sessionTable`.
- Detalle completo (qué colecciones, qué rompía, qué apaños se quedan) en
  **`docs/infraestructura-pb.md` → Quirks de PB 0.23**.
- Verificado en la Pi: sello con fecha y 10/10 en «Probar carrera».

### 🟠 PASO DEL USUARIO (v1.51.428) — re-correr "Crear colecciones" UNA vez (la v1.51.427 tenía un ReferenceError de ámbito en el corrector, cazado por el usuario y arreglado con sonda E2E contra un PB simulado)
El panel ahora **CORRIGE él mismo** los atributos declarados que hayan derivado
(autorizado por el dueño, 2026-08-09: «establécelo de una vez»): al pulsar
`#/admin` → "Crear colecciones", `activities.data.maxSize` pasa de 0 a **2097152**
y `data.required` se alinea a `false`. Solo toca atributos que el DEFS declara
explícitamente (`__declara`) y solo en NUESTRAS colecciones — nada de otros
proyectos de la Pi. Subir/fijar `maxSize` no reescribe filas: PocketBase lo aplica
en las escrituras siguientes. La salida lo nombra («atributo data.maxSize: 0 →
2097152»); si tras aplicar sigue saliendo «AJUSTAR A MANO», eso ya sería un fallo
nuestro y hay que reportarlo.
Además (misma versión): **las imágenes se COMPRIMEN solas** al subirlas
(`core/upload.js`): reescala a 1280 px de lado mayor y recodifica a WebP bajando
calidad hasta entrar en los 200 KB. SIN librería externa a propósito — el
navegador lo trae nativo (canvas) y una dependencia añadiría justo el peso que
queremos quitar (R1). GIF (animación) y SVG no se recomprimen. Una foto de móvil
de 3-8 MB ya no rebota: entra convertida.

### ✅ RESUELTO (v1.51.414 → v1.51.415) — CAZA DE TUMORES + ley §30
Código que la app NO PODÍA ALCANZAR, y ninguna ley lo veía (`layers` mira la dirección de
los imports, `moduleRefs` que lo importado exista; nadie miraba los nodos sueltos):
- `views/sorteoView.js` + ruta `#/sorteo` (107) — ruleta de aula sin un solo enlace.
- `core/tts.js` (38) · `themes/colegios/skin.css` (135, skin que ningún `registerSkin`
  cargaba) · `tools/test.html` (154, SEGUNDA suite en el navegador que nadie abría) ·
  `kernel/contracts/index.js` + `kernel/contracts/realtimePort.js` (el typedef `RoomChange`
  se mudó a `core/liveTransport.js`, junto al código que lo cumple) · alias de ruta `#/modos`.
- **Ley §30 · ALCANZABLE** (`tests/huerfanos.test.mjs`): escanea el repo y exige que todo
  módulo/ruta/CSS sea alcanzable o esté en `PUERTAS` con su motivo. Con contra-prueba.
- Lo que NO se tocó (falsos positivos comprobados): `assets/js/lottie_light.min.js` (se
  inyecta con un `<script>` en runtime), los 13 `templates/*/index.js` (import de efecto
  secundario desde `registerTemplates.js`), `$`/`$$` de `core/html.js` (sí se usan).
- Queda como observación, no como deuda: ~25 `export` de funciones que solo usa su propio
  módulo (API pública más ancha de lo necesario). Tocarlas es churn sin valor: no son código
  muerto, solo visibilidad de más.

### ✅ RESUELTO (v1.51.178 → v1.51.180) — Emparejar no conectaba en VERTICAL → `docs/historico/handoff-emparejar-vertical.md`
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

#### A. ✅ RESUELTO (v1.51.272) — Lost-update en el blob `state` de `live_sessions` → `docs/historico/handoff-deuda-a.md`
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

#### C. ✅ RESUELTO (v1.51.318) — `autoScore` colapsaba `correct: null` → `false`
- **Qué era**: `engine.js autoScore` hacía `correct: !!r.correct`; un ítem sin clave de respuesta
  (Pregunta en Vivo / Ruleta: `scoreSubmission` devuelve `null` porque los puntos los da el docente)
  marcaba a TODA la clase como incorrecta — en la tabla, en la analítica y en la cara del alumno.
- **Fix**: el motor PRESERVA el null. PocketBase no guarda booleanos nulos, así que el settle marca
  el campo propio `unscorable` y `answerRows` restaura el null; `cellScore` deja la celda en "—" y
  con `total: 0` (no entra en el denominador: antes contaba como fallo); `studentLive` pinta
  "¡Respuesta enviada! · la valora tu profe" en vez de "Incorrecto", y un ítem no puntuable no
  rompe ni sube la racha. Test: `tests/unscorable.test.mjs` (cadena entera + contra-prueba de que
  un ítem normal puntúa igual). **PASO DEL USUARIO**: re-correr "Crear colecciones" (campo nuevo).

#### D. ✅ RESUELTO — filtros PB (`core/pbFilter.js`) y, en R1 (v1.51.324), la robustez de
  escritura: intentos de tarea con cola offline (`core/attemptQueue.js`), idempotencia por `qid`
  en `results`/`assignment_attempts` (índice único parcial + comprobación en el adaptador; un
  ACK perdido ya no duplica ni gasta intentos), y el wrapper JSON de PB unificado en
  `pbJson` (`core/pbHttp.js`; auth.js conserva el suyo por ciclo de imports). Test:
  `tests/idempotency.test.mjs`. Requiere re-correr "Crear colecciones" (campo `qid` + índices).

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
  - **CSS**: ✅ RESUELTO (v1.51.320) — el reparto del teclado vive UNA vez en
    `styles/scaffold.css` (vs.css/teams.css/tv-show solo ponen tamaños), verificado con
    **`node tools/shots.mjs`** (capturas VS/Equipos × 3 skins × 2 orientaciones, diff por
    píxel: 12/12 sin cambios). El andamio portrait del scoreboard se queda EN CADA SKIN
    a propósito: cada skin define su `.vs-skin-X .vss-bar`, así que una regla compartida
    pierde por especificidad — se intentó y el marcador de tv-show se descuadró (razón
    escrita en vs.css).
  - **Vistas**: ✅ RESUELTO (v1.51.321) — `startRaceLoop()` en hostLive une el cronómetro y el
    repintado de respaldo de las DOS pantallas de carrera, y sus ritmos tienen nombre en
    `core/timings.js` (`RACE_POLL_MS`/`BOARD_POLL_MS`). `tools/live-smoke.mjs` cubre ahora
    también la CARRERA (cronómetro vivo → progreso del alumno → podio).
  - **Core**: ✅ los deadlines de hostLive/studentLive ya van por `clock.now()` y los primitivos
    de `core/deadlineTicker.js` (lo fija `tests/clock.test.mjs`, que falla si vuelve un
    `Date.now()` crudo). ✅ RESUELTO (v1.51.393): el wiring 'online' vive UNA vez en la
    factory (`core/offlineQueue.js`, R2) y el load-guard (parse+array) UNA vez en
    `lsGetJsonArray` (`core/ls.js`) — las tres colas lo consumen. Las colas siguen
    separadas A PROPÓSITO (identidad/evicción distintas es correcto).
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

