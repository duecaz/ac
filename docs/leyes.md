# LEYES del proyecto — índice único (qué · dónde está escrito · qué test la vigila)

> "Si es norma, es test." Aquí está TODA la ley en un sitio, con el archivo donde se
> explica y el test que la hace fallar en CI si la rompes. Antes de dudar de una
> convención, mira aquí. Verificación de todo: `node tests/run.mjs` (y `#/admin` →
> "Ejecutar tests" corre el mismo escáner en el navegador).

## 0) ⚖️ EL MODELO DE CUATRO CAPAS — el norte de la arquitectura
Cuatro capas, cada una con UN dueño y UNA prohibición. Toda decisión de diseño
se contrasta contra este cuadro ANTES de escribir código; si un cambio necesita
violar una prohibición, el diseño está mal planteado.

| Capa | Vive en | Dueña de | PROHIBIDO |
|---|---|---|---|
| **CONTENIDO** | `kernel/content` | modelos + validación + conversores | saber de mecánicas o modos |
| **PLANTILLA** | `templates/*` | UNA mecánica: el MÉRITO (scorer) + el render + sus políticas (`meta.play`) | saber en qué modo corre (lo DECLARA, no lo pregunta) |
| **MODO** | `core/modes` + `kernel/session` + shells (`core/soloPlayer`) | el arreglo social: quién juega · quién puntúa cuándo · qué persiste · qué reloj | conocer una plantilla concreta (solo consume el contrato) |
| **PLATAFORMA** | `views/` + editor + biblioteca | navegación, setup, resultados (chrome) | decidir reglas de juego (el bug del `raceToFinish` fue esto) |

- **El norte medible**: plantilla nueva = 1 carpeta · modo nuevo = 1 módulo ·
  **ninguna celda de la matriz plantilla×modo se programa a mano** — la matriz
  EMERGE del contrato.
- **Fronteras que no se cruzan**: el mérito NUNCA sube al kernel (la plantilla
  decide qué es correcto; el kernel cuándo se liquida). Un "game mode" con
  mecánica propia (p.ej. tipo Blooket) es una PLANTILLA live, no un modo.
- **Todo modo responde 5 preguntas** antes de existir (ficha en
  `docs/modos-de-juego.md` §9): quién puntúa · quién decide el fin · qué
  persiste · qué reloj · hay identidad de alumno.
- **Tests que lo vigilan**: `scoringSources` (el mérito vive en la plantilla) ·
  `persistPolicy` (qué persiste cada modo) · `templateContract` (meta.play
  declarado) · `moduleRefs` + matriz jugable (`tools/matrix-smoke.mjs`).

## 1) Versión — en CADA commit y en CADA respuesta
- Sube `VERSION` en `core/constants.js` (patch: `x.y.z → x.y.z+1`), nunca hacia atrás.
- Indica la versión `(vX.Y.Z)` en la respuesta del chat; commit y respuesta deben coincidir.
- **Dónde**: `CLAUDE.md §1` · **Por qué**: caché + service worker dependen de que avance.

## 2) Todo a `main` (sirve la web)
- `main` es GitHub Pages → **aulareto.com** (CNAME). Cada commit se propaga a `main`
  (permiso permanente) y por legado a `ACTIVIDAD2`.
- **Dónde**: `CLAUDE.md §2`.

## 3) ⚖️ LEY DE ESTILO — las cuatro capas del píxel
El contrato de estilos del PLAYER, en el mismo formato del §0: cada capa con UN
dueño y UNA prohibición. Un cambio visual se ubica en su capa ANTES de
escribirse; si necesita violar una prohibición, está en la capa equivocada.

| Capa | Vive en | Dueña de | PROHIBIDO |
|---|---|---|---|
| **TOKENS** | `core/skins.js` (`cssVars` de `default`) + `styles/theme.css :root` | el VOCABULARIO: los 14 `--ww-*` (bg/bg-soft/fg · card-* · accent · shape-1..4 · success/danger/warning) | que un token viva solo en `:root` (es red de seguridad, no fuente); añadir un token a `default` obliga a TODOS los skins |
| **SKIN** | `core/skins.js` (`registerSkin`) + `themes/<name>/skin.css` | dar VALOR a los 14 tokens (+ layout VS opcional) | tocar reglas de una actividad · pintar fuera de su scope `.skin-<name>`/`.vs-skin-<name>` · declarar `stylesheet:` sin archivo |
| **CSS DE PLANTILLA** (el juego) | `styles/<actividad>.css` (lista `GAME`) | la maquetación del ejercicio: RELATIVA (`cq*`, `%`, `fitLayout`/`fitPassage`) y pintada SOLO con `var(--ww-*)` | `px`/`rem` que congelen (`max(12px, Xcqmin)` vale como PISO, nunca techo) · `#hex` a pelo salvo neutros y acierto/error |
| **CHROME** | `styles/` en `EXCLUDED` (player, scaffold, editor, home, live, touch…) | el marco: `#ww-player-widget{container-type:size}`, el andamio `ww-scaffold/rail/stage/bar`, formularios | decidir el aspecto del EJERCICIO (el editor sí puede usar px: es formulario) |

- **La frontera que no se cruza**: el skin cambia TOKENS, nunca reglas; la
  actividad consume TOKENS, nunca hex. Si un trozo queda gris al cambiar de
  piel, ese `#6c757d` es el bug.
- **Ratchet, no formateador**: la deuda vive congelada en `BASELINE` por
  archivo+valor; actividad nueva (sin entrada) nace limpia; al arreglar deuda se
  BORRA su entrada; nunca se añade una violación para callar el test.
- **Dónde se explica**: `docs/estilos-de-actividad.md` (contrato + ejemplares
  `math.css`/`quiz.css` con assert duro a cero; §3b andamio de regiones).
- **Tests que lo vigilan**: `tests/styles.test.mjs` (ratchet + completeness gate
  23/23 + **gate de themes**: todo `stylesheet:` declarado existe y ningún
  `themes/*/skin.css` queda huérfano sin documentar) · `tests/skins.test.mjs`
  (set COMPLETO de tokens por skin).
- **Deuda registrada**: `themes/colegios/skin.css` huérfano (en disco, sin
  `registerSkin` — decidir si se registra o se retira; fijado en
  `KNOWN_ORPHANS`) · deuda de ratchet en vs/teams/wordsearch (la mayor) +
  match/memory/ballsort/crossword/textCorrection/question-live ·
  `themes/*/skin.css` aún fuera del escáner de px (27 font-size fijos entre
  arcade/tv-show/colegios) · el escape por selector `.mem-`/`-ed\b` exime más de
  lo que debería (todo memory) · `rgba()` de superficie sin vigilar.
  (Las reglas muertas del skin `space` no registrado se retiraron en L5.)

## 4) ResizeObserver → `observeResize()`
- Nunca `new ResizeObserver(cb)` directo si el callback muta layout: usa
  `observeResize()` (`core/observeResize.js`, rAF-debounced).
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/norms.test.mjs`.

## 5) Filtros PocketBase → `pbEscape`/`pbFilterParam`
- SIEMPRE `core/pbFilter.js`, NUNCA `encodeURIComponent` a pelo sobre el valor (no
  escapa la comilla simple de `campo='valor'`).
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/norms.test.mjs`.

## 6) `kernel/` sin `Date.now()` → `clock.now()`
- La lógica de dominio usa `core/clock.js` (`clock.now()`), inyectable → tests
  deterministas. (Pendiente: deadlines de hostLive/studentLive.)
- **Dónde**: `CLAUDE.md` deuda §2 · **Test**: `tests/norms.test.mjs` + `tests/clock.test.mjs`.

## 7) IDs con `rid()` (`core/ids.js`)
- Nunca `Math.random().toString(36)` a mano. Prefijos: `q_ p_ it_ w_ ps_ pin_`.
- **Dónde**: `CLAUDE.md` estándares.

## 8) Contrato de plantilla
- Cada plantilla: `meta.instructions` (obligatorio), modelo registrado, scorer que
  devuelve `{correct, points}`, `migrate` idempotente, carpeta↔registro. Plantillas con
  `modes.live` declaran `getRoundPayload`+`scoreSubmission`.
- **Dónde**: `docs/sistema-de-plantillas.md` · **Test**: `tests/templateContract.test.mjs`.
- **Generador**: `node tools/new-template.mjs <name> --model qa [--vs] [--live]` (nace
  cumpliendo el contrato) · Diagnóstico: `node tools/check-template.mjs`.

## 9) Skins completos
- Cada skin define el set COMPLETO de tokens de `default` (sin caer al fallback `:root`).
- **Test**: `tests/skins.test.mjs` (+ `core/skinContract.js`).

## 10) Handlers delegados + `clearListeners(APP)`
- Las vistas montan en `#app` y registran con `on(APP, …)` (delegación). El router llama
  `clearListeners(APP)` en `setBeforeResolve` antes de cada ruta — NUNCA lo quites.
- **Dónde**: `CLAUDE.md` estándares · **Test**: `tests/events.test.mjs`.

## 11) Pantalla de inicio obligatoria
- Todo modo Individual pasa por `views/startScreen.js` (título + instrucciones + Iniciar
  → fullscreen). El ejercicio queda oculto hasta Iniciar.

## 12) Registro único + arranque
- Las 13 plantillas se registran solo en `core/registerTemplates.js`; sonidos/efectos/
  versión/mute se cablean solo en `core/boot.js`. Los `main.*.js` no repiten ese wiring.

## 13) Gama baja `ww-lite` (`core/perf.js`)
- ≤4 núcleos o ≤2GB → `ww-lite` en `<html>`; sin bucles rAF continuos en reposo. El VS
  debe ir fluido en pizarras A55.

## 14) Puntos (`core/scoring/`)
- `basePoints`/`wrongPoints`/`useKahoot`. Tildes VS: 1 punto fijo por tilde buena
  (`scoreMarksPerHit`).

## ── LEYES DE DATOS / SEGURIDAD (biblioteca pública) ──────────────────────────

## 15) Solo PocketBase (Supabase RETIRADO)
- Backends válidos: `local` (dev) y `pocketbase` (prod, `PB_URL`). Nada de Supabase.
- **Dónde**: `CLAUDE.md` arquitectura · infra real en `docs/infraestructura-pb.md`.

## 16) `owner` (permiso) ≠ `author` (etiqueta) ≠ `profiles` (perfil)
- `owner` = columna PB de permisos (la pone `remoteStore`). `author = {id,name}` =
  etiqueta LIGERA dentro del JSON de la actividad (para las tarjetas). El **perfil rico**
  (colegio/frase/avatar) vive en la colección pública `profiles`, NO en la actividad.
- **Dónde**: `docs/infraestructura-pb.md` · `core/profile.js`.

## 17) Reglas PB endurecidas (U1)
- `activities`: crear exige sesión + ser tu owner; editar/borrar solo owner o admin;
  público lee lo `visibility='public'`. `users`/`profiles`/`likes`/`reports` con sus
  reglas (ver infra). Fuente en código: `views/adminView.js` DEFS = `setup-pocketbase.ps1`.
- **Verificación**: `bash tools/check-pb.sh` (incluye checks negativos: crear anónimo y
  signup DEBEN fallar). **Nunca** `sort=-updated/-created` sobre `activities` (rompe).
- **Dónde**: `docs/infraestructura-pb.md` · `docs/handoff-seguridad-pb.md`.

## 18) XSS: escapar SIEMPRE lo que viene de datos → `escapeHtml`
- Todo valor de la actividad/usuario que entra al DOM pasa por `escapeHtml`
  (`core/html.js`). La defensa del token en localStorage ES esta disciplina.
- **Test**: `tests/security.test.mjs`.

## 19) Credenciales de PocketBase/Pi — NUNCA en el chat
- Superadmin PB y contraseñas se teclean en la Pi con `read -rsp`; a Claude solo se le
  pega la SALIDA. Claude redacta los comandos, el usuario los ejecuta.
- **Dónde**: `docs/infraestructura-pb.md` (regla de oro).

## 20) OAuth redirect canónico
- `oauthRedirectUrl()` normaliza `/teacher` → `/teacher.html` (una sola URI autorizada en
  Google) y se preserva el `#hash` para volver a donde estabas.
- **Test**: `tests/oauth.test.mjs`.

## 21) ⚖️ LEY DE DATOS — cada colección tiene UN dueño
El equivalente del §0 para la persistencia: si no está declarado quién escribe,
cualquier módulo puede "parchar algo" escribiendo directo a la BD — y eso es
exactamente lo que causó los lost-updates (deuda A) y el guardado doble.

| Colección | DUEÑO (único módulo que la nombra/escribe) | Autoritativo | PROHIBIDO |
|---|---|---|---|
| `activities` | `adapters/pocketbase/remoteStore.js` (entrada: `core/storage.js` save/remove — cola `_unsynced` + tombstones) | PB; LWW por `updatedAt`; `owner` lo sella SOLO remoteStore | que una vista haga fetch propio a la colección |
| `results` | `remoteStore.js` (entrada ÚNICA: `trySaveResult` de `core/results.js`, gateado por `persistPolicy`) | append-only | escribir results desde un modo que `persistPolicy` no declare |
| `live_sessions` | `adapters/pocketbase/realtime.js` (blob `state` = host-only) | la fase la manda el host | que una vista/el alumno toque el blob por fetch propio |
| `live_answers` | `realtime.js` (`postAnswer` upsert atómico; índice único session+player+item) | los PUNTOS los pone el settle del host (C6) | POST/PATCH fuera de `postAnswer`/settle |
| `live_players` | `realtime.js` (fila por jugador; apodo único por índice) | la fila ES el playerId | tocar `players[]` del blob (retirado) |
| `assignments` / `assignment_attempts` | `adapters/pocketbase/assignments.js` (fachada: `core/assignmentsTransport.js`) | attempts append-only; NUNCA results+attempts a la vez | reimplementar el gateo fuera de `assignmentGate` |
| `reports` · `activity_likes` · `profiles` | `core/reports.js` · `core/likes.js` · `core/profile.js` (upsert `id=uid`) | PB (el perfil local es cache declarada) | duplicar el wrapper `pb()` en un módulo nuevo — pídele el método al dueño |
| `users` | `core/auth.js` (alta/está/patch) + `core/teachers.js` (rol, panel admin) | token PB | leer/escribir users desde vistas |
| _esquema_ | `views/adminView.js` (DEFS + reglas = `tools/setup-pocketbase.ps1`) | el DEFS del admin | migrar esquema desde otro sitio |

- **La regla de oro**: un módulo nuevo que necesite datos NO hace fetch a la
  colección — **le pide un método al dueño**. El dueño concentra firma
  (`signedFetch`), filtros (`pbFilter`), reintentos e idempotencia.
- **Excepción sancionada**: `core/stressTest.js` (prueba de carga: escribe filas
  `stress_*` y las borra; replica adrede el camino del alumno).
- **Test que lo vigila**: regla `pb-dueno` en `core/normsCheck.js` +
  `tests/norms.test.mjs` — nombrar una colección (URL o literal) fuera de su
  allowlist rompe CI. El allowlist es RATCHET: solo encoge.
- **Deuda registrada** (en el allowlist, marcada): lectores directos de
  `activities` (`explore`/`landing`/`author`/`teachers`/`dbDiag`) y de
  `live_sessions` (`views/reports.js`, que además rompe el seam local|pb);
  `recordAttempt` sin cola offline (un intento de tarea puede perderse en blip —
  candidato a `createOfflineQueue`); `results` y `assignment_attempts` sin clave
  de idempotencia (reintento tras ACK perdido puede duplicar fila; el fix bueno
  es índice único + campo `qid`, requiere "Crear colecciones"); 7 copias del
  wrapper `pb()` (unificar en `pbHttp`).

## 22) ⚖️ LEY DE CONFIANZA — el cliente AFIRMA, el veredicto lo pone otro
El principio que ya aplicamos tres veces sin nombrarlo (C6, answer-safety R5,
reglas U1/S3), ahora como ley: **lo que llega de un cliente es una AFIRMACIÓN;
el veredicto (correcto/puntos/fin) solo lo pone el host o una regla del
servidor.** Una feature nueva que confíe en el móvil está mal diseñada.

| Actor | AFIRMA (se acepta como dato) | PROHIBIDO decidir |
|---|---|---|
| **ALUMNO en vivo** (anónimo) | apodo · `value` · `ms` · abrir pregunta en QL (`ql_open`, sancionado) | su veredicto/puntos (los pone el settle del host — C6) · la fase/fin de la sala · expulsar · responder por otro `playerId` |
| **PROFESOR (host)** | fase · deadlines · settle · `ql_award` (acto docente manual) | responder por un alumno · re-abrir lo liquidado (candado del engine) |
| **CLIENTE Individual** (`results`) | score/techo/tiempo (append-only; deuda: autodeclarado) | editar/borrar lo ya guardado (reglas append-only) |
| **CLIENTE Tarea** (`assignment_attempts`) | intento con score y `answers` (deuda: autodeclarado, re-puntuable desde `answers[].v`) | crear/cerrar/rotar la TAREA (exige sesión de profe — regla L2) · editar intentos ajenos |

- **Dónde vive el veredicto**: settle del host (`realtime.js settleItem`/
  `settlePendingInto` sobre `engine.settle`, idempotente) **+ las reglas de
  PocketBase**, declaradas UNA vez en **`core/pbRules.js`** (fuente única que
  leen el panel `#/admin` y `tools/setup-pocketbase.ps1`).
- **Reglas EJECUTABLES** (esto es lo que las saca de "configuración que nadie
  mira"): `tests/pbRules.test.mjs` fija los invariantes (nadie con update/delete
  abierto · el veredicto `scored`/`points` es host-only · el blob de la sala es
  host-only · append-only donde el dato es un hecho entregado) **y compara regla
  a regla con el script de PowerShell** (la divergencia silenciosa era un bug
  real). `tests/liveRules.test.mjs` va más lejos: un **evaluador del dialecto de
  reglas PB** hace de servidor y el **adaptador REAL** juega contra él, así se
  vigilan los dos fallos posibles — que la regla sea muy ABIERTA (9 trampas
  deben rebotar) y que sea muy CERRADA (el alumno anónimo debe poder jugar
  entero: entrar · responder · reintentar en carrera · mover el tablero · pedir
  la palabra). En la Pi de verdad: `bash tools/check-pb.sh` (6 chequeos live,
  negativos Y positivos).
- **Otros tests**: regla `confianza-alumno` en `core/normsCheck.js` (el código de
  `views/student*` no puede ni NOMBRAR los verbos del host, `setSessionState`
  incluido) · `tests/liveAnswers.test.mjs` (C6) · `tests/answerSafety.test.mjs`.
- **Reglas aplicadas (L2 + L6)** — re-correr `#/admin` → "Crear colecciones":
  - `live_answers`: el alumno crea su respuesta (forzosamente `scored:false`,
    `points:0`) y puede corregir `value`/`ms`, pero **no puede ni mencionar
    `scored`/`points`** en un PATCH. Sin esto, C6 se saltaba entero desde
    DevTools: `{scored:true, points:9999}` entraba y el marcador lo sumaba.
  - `live_sessions`: **el blob `state` es host-only** (fase, ítem, deadline,
    puntajes) y crear/borrar sala exige sesión. Para que eso fuera posible, el
    "pedir la palabra" de Pregunta en Vivo salió del blob a un campo propio
    `ql` con su verbo propio (`claimQuestion`) — el alumno escribe ESO y nada
    más. (Se lee con respaldo al blob: las salas creadas antes siguen bien.)
  - `live_players`: solo el profe **expulsa** (antes cualquier alumno echaba a
    un compañero) y nadie renombra.
  - `assignments`: crear/cerrar/rotar/borrar exige sesión (un alumno ya no
    reabre una tarea cerrada, ni mueve `due_at`, ni se sube el tope).
  - `results`: **leer exige sesión** (privacidad: nombres y notas de menores).
  - **Consecuencia operativa — AUTORIDAD DE MODO, y hay que DECIRLO ANTES**:
    dirigir una sala en vivo o crear tareas EXIGE haber entrado con la cuenta de
    profe (el servidor solo distingue host de alumno por el token). **Jugar,
    explorar, entrar con PIN y hacer una tarea siguen SIN cuenta.** Esa
    autoridad no se re-escribe en cada vista: el modo declara en qué colección
    escribe (`MODE_DEFS[].writes`) y qué acto docente hace (`hostAction`), y
    `modeNeedsAuth()`/`modeAuthHint()` (`core/modes.js`) lo **derivan** de
    `HOST_ONLY_WRITES` (`core/pbRules.js`) → una sola redacción
    ("Inicia sesión para crear una sala en vivo") para el **botón** (candado en
    la tarjeta y en la barra de modos), el **modal** (`openLoginModal({reason})`)
    y el **gate del router** (`requireTeacher` en `#/launch`, `#/host`,
    `#/tasks`). Prohibido **esconder** el modo (esconderlo enseña que no existe)
    y prohibido **dejar que falle** para explicarlo después: `views/hostLive.js`
    conserva el mensaje del 403 solo como red para la sesión caducada.
    Lo vigila `tests/modeAuth.test.mjs` (incluida la anti-divergencia
    `HOST_ONLY_WRITES` ↔ `MODE_DEFS.writes` en ambos sentidos).
- **① `ms` de SERVIDOR — CERRADO (M1)**: el bonus de velocidad ya no se fía del
  reloj del móvil. Al abrir un ítem, el host SELLA en el blob (host-only) el
  `updated` que devuelve PocketBase = instante servidor de la apertura; al
  liquidar, el tiempo se DERIVA de los autodate de la fila contra ese sello
  (`core/serverMs.js`: `created` en fase pregunta, `updated` en carrera, donde
  cuenta el instante del acierto). Las dos marcas son del MISMO reloj, así que no
  hay desfase entre dispositivos, y el `ms` del cliente queda como respaldo
  MARCADO (`source:'claimed'`) para el blob legado / driver local / host recargado
  a mitad de pregunta. El tiempo que ve el profe en el informe sale de la misma
  derivación (`rowsFromLiveAnswers(rows, i, {itemOpenedAt, phase})`) → un solo
  tiempo por respuesta. Test: `tests/serverMs.test.mjs` (mentir con `ms:0` no
  cobra bonus **y** el alumno rápido de verdad conserva el suyo).
- **② LA CLAVE NO VIAJA EN LA SALA — CERRADO (M2)**: `live_sessions` tiene
  lectura ABIERTA por necesidad (el alumno anónimo entra con el PIN) y ahí se
  guardaba la actividad ENTERA → cualquiera con el PIN se leía todas las
  respuestas, y R5 no protegía nada porque el propio móvil se construía el
  payload en local desde ese snapshot. Ahora la sala guarda el **snapshot
  saneado** (`core/liveSnapshot.js studentSnapshot`: whitelist de metadatos +
  los payloads de ronda ya sin solución + huecos vacíos para contar ítems) y el
  contenido completo vive en **`live_keys`**, colección con las CINCO reglas
  cerradas a quien no tiene sesión. Lo que el alumno puede leer de un ítem sale
  de `visibleItem()` (payload), no de `content`. El host trae la clave de
  `live_keys` con caché por sala; si no puede (sesión caducada, colección sin
  crear) lo DICE al entrar en vez de fallar al revelar.
  **Excepción declarada**: en *carrera libre* el móvil juzga cada intento en
  local (colorea y re-encola al instante), así que esa sala sí sube el contenido
  completo al arrancar y vuelve al snapshot saneado al cerrar. Cerrarlo del todo
  pide un **validador en el servidor** (hook de PocketBase en la Pi): sin él,
  cualquier alternativa de cliente es cosmética — con 4 opciones visibles, un
  hash de la correcta se rompe probando las 4.
  Test: `tests/liveSnapshot.test.mjs` (las 13 plantillas: del contenido solo
  viaja el payload; fugas comprobables como cadena cerradas; contra-prueba de
  que con el snapshot aún se juega; `live_keys` cerrada).
  **PASO DEL USUARIO**: `#/admin` → "Crear colecciones" (añade `live_keys`).
  Sin ella, crear sala falla con ese mensaje exacto.
- **Sigue pendiente (diseño en `docs/handoff-seguridad-pb.md`)**: ③ tope de intentos
  server-side (índice único) — hoy borrar `ww.anonId` da intentos ∞; ④ que la
  fila de respuesta esté atada al dispositivo (un alumno puede responder en
  nombre de otro si adivina su `playerId`).

## 23) ⚖️ LEY DE VISTA — ciclo de vida de una pantalla
Las normas 4, 6 y 10 son piezas de esta ley; aquí está el cuadro completo de
dueños. El síntoma de violarla siempre es el mismo: algo del pasado (un reloj,
un handler, un observer, un modal) sigue vivo pintando encima del presente.

| Pieza | Dueña de | PROHIBIDO |
|---|---|---|
| **VISTA** (`views/*`, montada en `#app`) | su render + sus handlers `on(APP,…)` + sus disposers (`acquire()`/`ctx`) | listeners globales sin remove · guardar referencias DOM entre montajes · estado module-level salvo preferencia declarada (filtro de home) |
| **ROUTER** (`core/router` + `setBeforeResolve`) | el ciclo de vida: `clearListeners(APP)` antes de CADA ruta | que una vista lo esquive colgando handlers "para siempre" |
| **RELOJES** | `createCountdown` (duración) · `startDeadlineTicker` (hasta instante del servidor) · `startElapsedTicker` (ascendente) · `ctx.setInterval` (polling con limpieza) | `setInterval` a pelo (regla `reloj-primitivo`) · `Date.now()` en dominio (→ `clock.now()`) |
| **CALLBACKS DIFERIDOS** (`setTimeout` que repinta) | guard de vida: `if (!rootEl()) return` / `host.isConnected` / `ctx.setTimeout` | repintar sin comprobar que la ruta sigue viva (el patrón wheel es el ejemplar) |
| **OVERLAYS en `<body>`** (toast, modales, banner) | cierre propio + **cierre en `hashchange`** si sobrevive a la ruta (loginModal) | quedar huérfanos encima de la vista siguiente |

- **Ejemplares** (así se hace): `views/studentLive.js` (100% ctx + primitivos +
  disposer de suscripción) · `views/playerView.js` (token de generación
  anti-carrera async) · `views/editView.js` (único listener de window en views/,
  con remove en el disposer).
- **Tests que lo vigilan**: `reloj-primitivo` + `resize-observer` en
  `core/normsCheck.js`/`tests/norms.test.mjs` · `tests/events.test.mjs`
  (delegación + clearListeners) · `tests/deadlineTicker.test.mjs` (guard
  anti-zombi).
- **Arreglado en L3**: `started_at` de hostLive con `clock.now()` (era el único
  `new Date()` vivo de la vista → relojes de carrera testeables con tiempo
  congelado) · guard de vida en el giro de Abre-Cajas y en el "cubrir" de
  Memoria-Equipos · loginModal se cierra al navegar (quedaba huérfano y
  bloqueaba reabrirse).
- **Deuda registrada**: `views/vsView.js` sin `acquire()` (sus 3 `setTimeout`
  de ritmo repintan sin guard — migrarla a ctx es un pase propio) ·
  disposer de `observeResize` descartado en match/diagram (y crossword solo lo
  suelta al terminar) — RO sobre nodo desconectado no dispara, es fuga de
  referencia, no de repintado · `Date.now()` en expiración de tokens
  (`auth`/`classroomAuth`: legítimo reloj de pared, pero con `clock.now()`
  serían testeables) · timestamps de `editList` con `new Date()` crudo.

## 24) ⚖️ LEY DE CONTENIDO — el modelo evoluciona por caminos declarados
El contenido de una actividad es del USUARIO: sobrevive años en PB/localStorage.
Solo puede cambiar de forma por caminos versionados y testeados — nunca por un
módulo que lo "arregle" al vuelo.

| Camino | Único mecanismo | PROHIBIDO |
|---|---|---|
| **Evolución de forma** | `migrateContent` + subir `meta.templateVersion` (idempotente; `core/migrate.js` lo aplica fail-safe con `?? content`) | cambiar la forma sin migración (contrato: versión >1 EXIGE migrate) · una migración que devuelva `undefined` ya no puede borrar contenido |
| **Cambio de formato** (gesto Wordwall) | `kernel/content/convert.js` (entre modelos) + `adoptContent` de la plantilla destino (afinado de FORMA intra-modelo) | convertir a mano en una vista/editor · un switch "directo" que produzca contenido inservible (era el caso Sopa↔Crucigrama) |
| **IDs** | `rid()` de `core/ids.js` (prefijos `q_ p_ it_ w_ ps_ pin_ m_ cw_`) | `Math.random().toString(36)` a mano (regla `id-rid`) |
| **Edición** | el editor hace CRUD del contenido; los PARÁMETROS los lee el scorer | lógica de juego en el editor (el caso patrón: el Timer muerto de Emparejar) · campos que ningún player/scorer lee |
| **En caliente** | el player LEE; normalizar es de `migrate`/`adoptContent` | mutar `activity.content` durante el juego |

- **Tests que lo vigilan**: `templateContract` (migrate idempotente + versión>1
  ⇒ migrate) · regla `id-rid` en `normsCheck`/`tests/norms.test.mjs` ·
  `tests/switchTemplate.test.mjs` (conversores).
- **Arreglado en L4**: los 9 generadores de id a mano migrados a `rid()`
  (quiz/math/match/memory/crossword + toast/embedModal/adaptadores/stressTest —
  el allowlist de la regla es SOLO `core/ids.js`) · `migrate` fail-safe ·
  contrato versión>1⇒migrate · **Sopa↔Crucigrama por fin convierte de verdad**:
  `adoptContent` en ambas (Crucigrama→Sopa se queda las palabras; Sopa→Crucigrama
  las CRUZA con el auto-layout del generador, pistas vacías para el editor).
- **Deuda registrada**: `ensureContent` de ballsort vive en su editor y lo
  importan player/getRoundPayload (el editor como dependencia del runtime —
  moverlo a template) · campos muertos que aún se escriben (`rules.allowOverflow`
  en tildes/comas, `hintMode` de crossword, `answerIdx`/`kind`/`audio` de quiz,
  `rules.timer`/`livesPerMistake` residuales de match/diagram) · el editor de
  quiz lleva la 3ª copia de la regla de respuesta correcta (las otras:
  template.migrate y qaAdapt) · modelo `entries` huérfano en models.js ·
  `sessionItems`/`activityItemCount` mantienen dos listas paralelas de nombres
  de colección · la pseudo-plantilla `list` de `views/editList.js` define su
  actividad a mano fuera del contrato · Ruleta/Abre-Cajas no pueden VOLVER a
  Quiz (falta `items→qa`).

---
### Cómo se auto-verifica todo
`node tests/run.mjs` corre TODAS las suites. Los escáneres compartidos
(`core/normsCheck.js` / `core/templateContract.js` / `core/skinContract.js`) corren
también en `#/admin` → "Ejecutar tests". Si añades una norma nueva: **escríbela como
test**, no solo en un MD.
