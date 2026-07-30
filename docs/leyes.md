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

## 3) ⚖️ LEYES DE MAQUETACIÓN Y COLOR DEL JUEGO ("las leyes de los input")
Esto es lo que buscabas: el **contrato de estilos del PLAYER**.
- **NADA con tamaño fijo en el player**: todo relativo — unidades de contenedor (`cq*`),
  `%`, o cálculo JS (`fitLayout`/`fitPassage`). Prohibido `px`/`rem` que congelen el
  crecimiento. `max(12px, Xcqmin)` vale como PISO de legibilidad, nunca como techo.
  (El EDITOR sí puede usar `px`: es un formulario, no el juego.)
- **Colores pintables por token `var(--ww-*)`** para que los skins recoloreen — nunca
  `#hex` a pelo, salvo neutros (`#fff/#000`) y acierto/error (verde/rojo).
- **Dónde se explica**: `docs/estilos-de-actividad.md` (contrato completo + ejemplares
  `math.css`/`quiz.css`; §3b andamio de regiones ww-scaffold/rail/stage).
- **Test que lo vigila**: `tests/styles.test.mjs` (ratchet: una actividad nueva nace
  limpia; lista `GAME` = CSS de juego escaneado, `EXCLUDED` = chrome/paletas).

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

- **Dónde vive el veredicto hoy**: settle del host (`realtime.js settleItem`/
  `settlePendingInto` sobre `engine.settle`, idempotente) + reglas PB
  (`views/adminView.js` DEFS = `tools/setup-pocketbase.ps1`, unificados en L2).
- **Tests que lo vigilan**: regla `confianza-alumno` en `core/normsCheck.js`
  (el código de `views/student*` no puede ni NOMBRAR settleItem/endSession/
  startSession/kickPlayer/fetchSessionKey/Blob) · `tests/liveAnswers.test.mjs`
  (C6: carrera persiste sin puntuar) · `tests/answerSafety.test.mjs` (la clave
  no viaja) · `bash tools/check-pb.sh` (reglas negativas contra la Pi).
- **Reglas aplicadas en L2** (re-correr "Crear colecciones"): `assignments`
  crear/cerrar/rotar/borrar exige sesión (el gateo de tareas deja de ser solo
  de cliente en su mitad más grave: reabrir/mover due_at/subir intentos);
  `setup-pocketbase.ps1` re-sincronizado con el DEFS del admin (divergía en
  `assignment_attempts.list/view` — la variante ps1 rompía el tope de intentos
  del alumno anónimo — y en `live_players.update`).
- **FASE DE REGLAS LIVE (pendiente, diseño en `docs/handoff-seguridad-pb.md`)**
  — requiere probarse en aula, no se aplica a ciegas: ① `live_answers.update`
  con guarda de campos (`@request.body.scored/points/correct:isset = false` para
  anónimos; el host firmado sí liquida) — hoy un PATCH de DevTools puede
  auto-puntuarse saltándose C6; ② blob de `live_sessions` host-only compatible
  con el handshake QL; ③ `live_players.delete` a sesión (hoy cualquiera
  expulsa); ④ `ms` de servidor (autodate de la fila vs `started_at`) para el
  bonus de velocidad; ⑤ el snapshot con clave que viaja al móvil en carrera
  (R5 cubre el payload de ronda, no `activity_snap`); ⑥ tope de intentos
  server-side (índice único attempt) — hoy borrar `ww.anonId` = intentos ∞.

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

---
### Cómo se auto-verifica todo
`node tests/run.mjs` corre TODAS las suites. Los escáneres compartidos
(`core/normsCheck.js` / `core/templateContract.js` / `core/skinContract.js`) corren
también en `#/admin` → "Ejecutar tests". Si añades una norma nueva: **escríbela como
test**, no solo en un MD.
