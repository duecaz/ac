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
**`main` es la rama que sirve GitHub Pages (aulareto.com)** — es LA rama de producción. El
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
- `main` **debe quedar siempre al día**: es lo que ve el usuario en aulareto.com y lo que otros
  proyectos consultan. Se dejó desincronizada 154 commits una vez y "el otro proyecto no
  encontraba nada". No vuelva a pasar.
- `ACTIVIDAD2` fue la rama de Pages; **ya NO sirve la web** (se movió a `main`). Se
  mantiene sincronizada por inercia/legado, pero lo crítico es `main`.

### 3. Entorno del usuario
- El usuario trabaja en **Windows (PowerShell)** y tiene **GitHub CLI (`gh`) instalado y
  autenticado**: para acciones sobre sus repos fuera del alcance de la sesión (p.ej.
  `duecaz/ww-assets`), pásale los comandos `gh`/PS listos para pegar y él los ejecuta.

### 4. LAS ONCE LEYES — contrastar TODO diseño contra ellas ANTES de escribir código
Cada ley es un cuadro **dueño → PROHIBIDO** con su test que rompe CI. Si un cambio
necesita violar una prohibición, el diseño está mal planteado: no se parchea, se
replantea. Texto completo en **`docs/leyes.md`** (índice único de normas).

| Ley | En una frase | Vigilada por |
|---|---|---|
| **§0 · CUATRO CAPAS** | contenido · plantilla · modo · plataforma: una plantilla no sabe en qué modo corre (lo DECLARA), un modo no conoce plantillas concretas | `scoringSources` · `persistPolicy` · `templateContract` · matriz jugable |
| **§3 · ESTILO** | 4 capas del píxel: el skin cambia TOKENS, la actividad consume TOKENS; nada de tamaños fijos en el juego | `styles` (ratchet + gate de themes) · `skins` |
| **§21 · DATOS** | cada colección PB **y cada clave `ww.*` del almacén** tiene UN módulo dueño; quien necesite datos **pide un método al dueño**, nunca hace fetch ni `lsGet` propio | reglas `pb-dueno` + `ls-dueno` (`norms`) |
| **§22 · CONFIANZA** | el cliente **AFIRMA**, el veredicto lo pone el host o una regla del servidor | `pbRules` + `liveRules` (evaluador de reglas) · `confianza-alumno` · `answerSafety` · `modeAuth` (avisar ANTES) |
| **§23 · VISTA** | la vista posee su render y sus handlers; el router el ciclo de vida; los relojes van por su primitivo | regla `reloj-primitivo` · `events` · `deadlineTicker` |
| **§24 · CONTENIDO** | el contenido es del usuario: cambia solo por migración versionada, conversión declarada e ids con `rid()` | regla `id-rid` · `templateContract` (versión>1 ⇒ migrate) |
| **§25 · CAPACIDAD** | el sistema tiene límites y son UNO (`core/quotas.js`): 200 actividades · 2 MB por actividad · 120 días de salas | `quotas` (paridad módulo↔panel↔ps1) |
| **§26 · BUCLES LIVE** | el catálogo (rondas·carrera·tablero·pedir la palabra) está CONGELADO: fase nueva = decisión escrita | `liveLoops` |
| **§27 · VIAJES** | cada tramo del norte tiene su RECORRIDO con navegador; se comprueba lo que toca el dedo, no lo que existe en el DOM | `journeys` + `tools/preflight.mjs` |
| **§28 · EN CLASE** | R2: máx. 2 opciones de partida, ya elegidas (el techo lo exige el contrato) · R2b: dentro del marco de juego, ningún control destructivo ni de identidad | `templateContract` · escaneo R2b de `matrix-smoke` |
| **§29 · PRESUPUESTO** | el coste de conducir se MIDE: jugar sin diálogos · nadie revela solo · de la lista a jugar ≤3 toques | `matrix-smoke` (presupuesto) · `find-smoke` (toques) |
| **§30 · ALCANZABLE** | lo que no tiene puerta de entrada se BORRA: ni módulo sin importador, ni ruta sin enlace, ni CSS que nadie cargue | `huerfanos` (escaneo + `PUERTAS` con motivo) |
| **§30b · DECIDIDA** | toda ruta cita la sección del norte que la justifica — el sorteo tenía enlace y aun así no respondía a ninguna decisión | `rutasNorte` (escaneo + `DECIDIDA_EN`) |

- **Si es norma, es test**: una regla nueva se escribe como test, no solo en un MD.
- **Si una ley cierra una puerta, la UI lo DICE ANTES**: dirigir en vivo / crear
  tareas exige sesión (§22) → el botón lleva candado con su frase y el router
  gatea; jugar/PIN/tarea siguen sin cuenta. La política vive en `MODE_DEFS`
  (`writes` + `hostAction`) y la frase sale de `modeAuthHint()` — una sola
  redacción para botón, modal y gate (`tests/modeAuth.test.mjs`). Nunca esconder
  el modo, nunca dejar que falle para explicarlo después.
- **La contra-prueba importa igual que la prueba**: al endurecer algo, el test debe
  comprobar TAMBIÉN que el camino legítimo sigue funcionando (una regla demasiado
  cerrada se descubre con la clase delante — eso es lo que hace `liveRules`).

## MAPA — dónde mirar (lee ESTO antes de cargar medio repo)

Este archivo es el índice. **No leas todos los MD ni todo el código de golpe**: identifica
la tarea, abre SOLO el doc/módulo que corresponde. Regla de oro del proyecto: *si es norma,
es test* — antes de dudar de una convención, mira si hay un test que la fija.

| Quiero… | Voy a… |
|---|---|
| **SABER PARA QUIÉN ES LA APP y cómo se decide** (la escena, restricciones, qué NO somos, referentes, **de dónde se desprende cada ley**, y la COLA de trabajo derivada) | **[`docs/norte.md`](docs/norte.md)** — manda sobre el resto: las leyes dicen CÓMO, el norte dice QUÉ y PARA QUIÉN |
| **Ver TODAS las leyes/normas del proyecto** (px/token del juego, PB, XSS, versión…) | **[`docs/leyes.md`](docs/leyes.md)** (índice único: qué · dónde · qué test la vigila) |
| **VER EL MAPA DE MÓDULOS** (capas, quién importa a quién, dónde está el tamaño) | **[`docs/arquitectura-modulos.md`](docs/arquitectura-modulos.md)** — GENERADO: `node tools/module-map.mjs` (lo vigila `tests/layers.test.mjs`) |
| **Tocar un cuadro de bucles/modos en un MD** | NO se edita a mano: sale del código con `node tools/docgen.mjs` (lo vigila `tests/docs.test.mjs`) |
| **EL NORTE: modelo de 4 capas** (contenido·plantilla·modo·plataforma, dueños y prohibiciones) | **[`docs/leyes.md`](docs/leyes.md) §0** — contrastar TODO diseño contra ese cuadro |
| **Quién escribe cada colección PB** (dueño único, prohibiciones, deuda) | **[`docs/leyes.md`](docs/leyes.md) §21** — vigilada por la regla `pb-dueno` (`tests/norms.test.mjs`) |
| **Qué palabra del cliente vale** (afirmación vs veredicto, fase de reglas live) | **[`docs/leyes.md`](docs/leyes.md) §22** — regla `confianza-alumno` + C6 + answer-safety |
| **Ciclo de vida de una pantalla** (relojes, guards, overlays, disposers) | **[`docs/leyes.md`](docs/leyes.md) §23** — regla `reloj-primitivo`; ejemplar: `views/studentLive.js` |
| **Cómo evoluciona el contenido** (migraciones, formatos, ids, editor=CRUD) | **[`docs/leyes.md`](docs/leyes.md) §24** — reglas `id-rid` + contrato versión>1⇒migrate |
| Entender el sistema de plantillas (crear/validar/jugar, qué módulo hace qué) | **[`docs/sistema-de-plantillas.md`](docs/sistema-de-plantillas.md)** (mapa vivo) |
| **Crear una actividad nueva** | `node tools/new-template.mjs <name> --model qa [--vs] [--live]` + `templates/HOW_TO_ADD.md` |
| **Diagnosticar** una plantilla existente | `node tools/check-template.mjs [name]` (contrato + normas) |
| Contrato de CSS + **responsive / andamio de regiones** (ww-scaffold/rail/stage) | [`docs/estilos-de-actividad.md`](docs/estilos-de-actividad.md) (§3b andamio) |
| Contrato de **modos** (Solo/VS/Equipos/Live/Tarea) y su gateo | [`docs/modos-de-juego.md`](docs/modos-de-juego.md) · `core/modes.js` |
| **ESTRUCTURA de los modos y de los 4 bucles en vivo** (quién puntúa, cómo se gana, qué persiste) | cuadro corto abajo en este archivo · completo en [`docs/modos-de-juego.md`](docs/modos-de-juego.md) §9.4 |
| **DECIDIR el diseño de un modo** (ficha + escenarios Gherkin + preguntas abiertas) | **[`docs/modos-de-juego.md`](docs/modos-de-juego.md) §9** |
| **Modelo de contenido** JSON por plantilla | [`docs/ESTRUCTURA.md`](docs/ESTRUCTURA.md) · modelos en `kernel/content/models.js` |
| Catálogo: qué hace cada actividad y en qué modos | [`docs/panorama-actividades.md`](docs/panorama-actividades.md) |
| **Probar** (suites Node + panel admin + headless Playwright) | [`docs/testing.md`](docs/testing.md) |
| **Testeo MANUAL por un compañero** (recorrido completo, matriz por juego×modo, torturas) | [`docs/plan-de-pruebas-manual.md`](docs/plan-de-pruebas-manual.md) |
| **Guía de testeo PARA ALGUIEN NO TÉCNICO** (paso a paso: Ctrl+F5, versión, carrera, torturas, plantilla de reporte) | [`docs/guia-testeo-companero.md`](docs/guia-testeo-companero.md) |
| **Tocar CSS del juego sin romper nada** (capturas antes/después, diff por píxel) | `node tools/shots.mjs before` → cambios → `node tools/shots.mjs after` |
| **Matriz JUGABLE** (cada plantilla × cada modo arranca sin crash) | `node tools/matrix-smoke.mjs` + `tests/moduleRefs.test.mjs` (imports olvidados) |
| **EN VIVO e2e** (host+alumno en dos páginas: sala→PIN→respuesta→settle→podio) | `node tools/live-smoke.mjs` |
| **TAREAS e2e** (crear tarea → PIN → el alumno juega → tope de intentos → informe) | `node tools/task-smoke.mjs` |
| **CARRERA e2e contra PocketBase REAL** (puntos planos · gana quien acabó antes · meta del servidor · la trampa rebota) | `node tools/race-e2e.mjs [PB_URL]` (credenciales por entorno `WW_EMAIL`/`WW_PASS`) |
| **¿Editar el contenido pierde la respuesta correcta?** (teclea en los 13 editores y re-pregunta al scorer) | `node tools/edit-audit.mjs` |
| **Prueba de CARGA** (N alumnos concurrentes live+tareas contra PB real) | `core/stressTest.js` · botón `#/admin` "Simular carga" · `node tools/stress-live.mjs [N]` |
| Modo SOLO (Wordwall) por dentro · identidad/auth · dev local | [`docs/modo-wordwall.md`](docs/modo-wordwall.md) · [`docs/identidad.md`](docs/identidad.md) · [`docs/dev-local.md`](docs/dev-local.md) |
| **DECISIONES de producto pendientes** (contrastadas con Wordwall/Kahoot: identidad del alumno, imprimible, cuotas…) | **[`docs/decisiones-pendientes.md`](docs/decisiones-pendientes.md)** |
| **Cuántos bucles de juego en vivo hay y qué cuestan** (estudio D7, medido) | **[`docs/estudio-bucles-live.md`](docs/estudio-bucles-live.md)** + ley §26 |
| Índice completo de docs | [`docs/README.md`](docs/README.md) (lo histórico vive en `docs/historico/`) |
| **Cómo se puntúa CADA actividad** | `core/scoring/` + el scorer de cada plantilla; la ley y su test, en [`docs/leyes.md`](docs/leyes.md) (`scoringSources`). El plan original, ya ejecutado, en `docs/historico/handoff-puntuacion.md` |
| **Bugs abiertos / deuda** | la sección "Deuda técnica registrada" (abajo) + notas `docs/handoff-*.md` |
| **Configurar Google Classroom** (pasos en Google Cloud) | [`docs/handoff-google-classroom.md`](docs/handoff-google-classroom.md) |
| **Seguridad de PocketBase por fases** | [`docs/handoff-seguridad-pb.md`](docs/handoff-seguridad-pb.md) — su Fase 3 es hoy un LÍMITE declarado en `leyes.md` §22 |
| **Verificar la Pi contra el esquema del código** (13 colecciones · campos mudos · índices · tope §25) | `PB=https://pb.lanube.uno bash tools/check-pb.sh` — lo cruza `tests/pbSchema.test.mjs` |
| **Cómo está la BD/Pi de VERDAD** (PocketBase, Docker, backups, OAuth Google, quirks) | **[`docs/infraestructura-pb.md`](docs/infraestructura-pb.md)** (fuente de infra; actualizar si cambia el servidor) |
| **Plan de usuarios/acceso docente** (endurecer reglas, PIN, NFC, pizarras, panel profes) | **[`docs/handoff-acceso-docente.md`](docs/handoff-acceso-docente.md)** (incluye auditoría del sistema de usuarios) |

Verificar SIEMPRE antes de commitear: **`node tools/preflight.mjs`** — la suite + los
CINCO recorridos (matriz jugable · buscar/crear+EDITAR · editores · en vivo · tareas) en ~100 s, ley §27. `node
tests/run.mjs` solo verifica PIEZAS: los cinco fallos que la clase encontró en una
semana vivían en la COSTURA entre piezas correctas y ninguna suite podía verlos. Si el
cambio toca vistas, CSS o el router, el preflight NO es opcional. El contrato,
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

## ESTRUCTURA DE MODOS (cuadro corto — el completo, en `docs/modos-de-juego.md` §9)

Cinco modos. Los tres embebidos comparten pantalla; los dos con página propia son otro
montaje FÍSICO (proyector+móviles / gestión de entregas).

<!-- GENERADO:modos -->
| Modo | Pantalla | Persiste | ¿Necesita sesión de profe? |
|---|---|---|---|
| **Individual** | esta pantalla (embebido) | `results` | no |
| **VS (duelo)** | esta pantalla (embebido) | nada (por diseño) | no |
| **Equipos** | esta pantalla (embebido) | nada (por diseño) | no |
| **En vivo** | página propia | `live_answers` | sí — crear una sala en vivo |
| **Tarea** | página propia | `assignment_attempts` | sí — crear una tarea |

> Generado de `core/modes.js` (`MODE_DEFS`) + `core/persistPolicy.js`.
> Ningún modo escribe en dos sitios a la vez: lo vigila `tests/persistPolicy.test.mjs`.
<!-- /GENERADO:modos -->

Y lo que no deriva del código — quién pone los puntos y cómo se gana:

| Modo | Puntúa | Cómo se gana |
|---|---|---|
| **Individual** | la plantilla (shell solo) | tu puntaje |
| **VS (duelo)** | la plantilla (kernel) | `meta.play.vs`: `race` o `points` |
| **Equipos** | la plantilla o el docente | `meta.play.teams`: `turns` o `board` |
| **En vivo** | el **host** al liquidar | **según el BUCLE** ↓ |
| **Tarea** | la plantilla | tu puntaje |

**«En vivo» son CUATRO bucles** (`core/liveLoops.js`, ley §26; los DECLARA la plantilla en
`meta.play.live`, nunca un `<select>` fijo ni el nombre de la plantilla dentro de una vista):

<!-- GENERADO:bucles -->
| Bucle | Fase | Quién avanza | **Cómo se gana** | Puntos | Fin | Plantillas que lo declaran |
|---|---|---|---|---|---|---|
| `rounds` · Rondas juntas | `question` | el profe o el reloj | más puntos | Kahoot: base×500 + bonus por velocidad | al agotar las preguntas | Comas · Operaciones · Quiz · Tildes |
| `race` · Carrera libre | `race` | cada alumno | **terminar primero con todas bien** (empate ⇒ hora de meta) | **planos**: el puntaje ES el nº de aciertos | política declarada: todos · primeros N · tiempo | Comas · Operaciones · Quiz · Tildes |
| `board` · Tablero | `race` | cada alumno | avanzar más en el tablero | escala propia de la plantilla (Pelotas: 0-1000 por eficiencia) | igual que la carrera | Ordena las Pelotas |
| `claim` · Pedir la palabra | `question-live` | el profe (a quien pide turno) | los puntos que da el docente | manuales (+10/+50), sin clave de respuesta | lo cierra el docente | Abre Cajas · Ruleta |

> Generado de `core/liveLoops.js` + `meta.play.live` de las 13 plantillas.
> El modelo de puntos lo decide `pointsModeFor(loop)`: `rounds`→`live` · `race`→`race` · `board`→`race` · `claim`→`live`.
<!-- /GENERADO:bucles -->

- **El BUCLE se DECLARA y se GUARDA** en el blob de la sala (`state.loop`, sin migración) al
  arrancar. De ahí lo leen el settle (modelo de puntos vía `pointsModeFor()` de
  `core/liveLoops.js`), el podio, la tabla y el CSV. Antes cada uno lo re-adivinaba: de la fase
  (ambigua: `race` y `board` la comparten, y el barrido de cierre liquida con la sala en
  `ended`), del sello de apertura, o con `mode:'race'` cableado en tres vistas.
- **Carrera**: un fallo VUELVE A LA COLA ⇒ todo el que termina lo hace con TODAS bien ⇒ el
  puntaje no ordena y **manda la hora de meta** (reloj del SERVIDOR). Va en dos sitios:
  `core/liveRank.js` (marcador) y `views/sessionTable.js` `finishMs` (podio/tabla del profe).
  El podio la MUESTRA (`0:47`) o la clase ve un empate. Test: `tests/raceRank.test.mjs`.
- Durante el juego la pizarra muestra **AVANCE, no ranking** (C-2); la clasificación, en el podio.
- El **ritmo** (ventana de lectura, cierre) es un INSTANTE en la fila de la sala, nunca un
  `setTimeout` del cliente → sobrevive a recargas y a llegar tarde.

## Notas de plantillas
- `sessionItems(activity)` lee `items ?? entries ?? pairs ?? groups ?? words ?? passages ?? []`.
- Plantillas con `modes.live: true` deben declarar `getRoundPayload` y `scoreSubmission` (aunque sean stubs).
- Las columnas de rejillas se ponen inline (`grid-template-columns: repeat(N, 1fr)`); las variables CSS se ignoran en algunos móviles.
- **`meta.instructions` es obligatorio** (frase corta de cómo se juega): lo muestra la pantalla de inicio.
- **`meta.panelFit`** declara la maquetación del panel VS: `'fill'` (defecto, llena y escala) ·
  `'block'` (bloque único con tope, p.ej. la calculadora) · `'center'`. Ver docs/modos-de-juego.md §5c.
- **`meta.play` = POLÍTICA DE JUEGO declarada** (obligatoria, la valida el contrato). Cómo se
  comporta la plantilla en cada modo, para que el motor y las vistas la LEAN en vez de adivinarla:
  - `play.vs`: `'race'` (el primero que termina gana y cierra: Operaciones/Sopa/Pelotas) ·
    `'points'` (espera a AMBOS y gana quien más suma: Quiz/Globos/Emparejar/Tildes/Comas) · `'none'`.
    Antes `views/vsView.js` forzaba carrera a las 13 → en Quiz/Tildes el primero en acabar cortaba
    al otro y le robaba lo hecho (bug de QA). Ahora lo aplica `createVsSession` desde el meta.
  - `play.teams`: `'turns'` · `'board'` (tablero compartido) · `'none'`.

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
  `docs/historico/handoff-previews-home.md` Fase 2b).
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
- **Envío de una respuesta en la ronda**: la plantilla lo DECLARA en `meta.play.submit` —
  `'gesto'` (el toque ES la respuesta: opción, globo, tablero → CERO botones) o `'boton'`
  (se construye y se confirma → EXACTAMENTE UNO, marcado `data-ww-submit`). Ninguna vista
  añade un control de envío encima del de la plantilla. Auditado de verdad por
  `node tools/matrix-smoke.mjs`, que cuenta los `[data-ww-submit]` del panel VS y los
  compara con lo declarado ("cuántos toques cuesta responder" es producto, no detalle).
- **Opciones de PARTIDA vs ajustes de CONTENIDO**: lo que cambia el juego para ESTA vez
  (Pelotas: ganar por tiempo o por movimientos) se declara en `meta.play.options`
  (`core/playOptions.js`) y lo pintan la pantalla de inicio y el setup de VS/Equipos —
  ninguna vista conoce la plantilla. `set` es PURO: se aplica a la copia de juego y la
  actividad guardada NO se toca (§24). Lo del editor sigue siendo contenido. Tope: la
  opción viene SIEMPRE ya elegida (R2: el profe no configura nada para empezar).
  Vigilado por `tests/playOptions.test.mjs`.
- **En CARRERA la vara es COMPLETA**: `racePassed()` (`core/liveLoops.js`) — una hoja de
  Tildes/Comas a medias VUELVE A LA COLA (su scorer da crédito por marca, `correct: net>0`).
  Sin esto la premisa del podio es falsa: ordena por hora de meta PORQUE todos terminan con
  todas bien. Y el móvil **nunca juzga sin clave**: `hasClientKey()` (`core/liveSnapshot.js`)
  + el guard de `paintRace`. Vigilado por `tests/raceKey.test.mjs`.
- **Tarjeta de actividad**: una sola (`core/activityCard.js`) y con VARIANTE, no con
  banderitas sueltas: `variant: 'mine' | 'library' | 'plain'`. Los campos informativos
  (subtítulo · etiquetas · autor · nº de páginas) van ENCENDIDOS por defecto y se pintan
  si el dato existe — "qué muestra una tarjeta" lo decide el componente, no cada vista.
  Unificar el markup no bastó: la CONFIGURACIÓN divergió igual (el badge de páginas solo
  lo pedía la home y el profe preguntó por qué no salía en la portada).
  Vigilado por `tests/activityCard.test.mjs` (ninguna vista puede apagar un campo).
- **La esquina superior derecha del marco de juego es DEL MARCO**: ahí va el botón de
  pantalla completa (`.ww-fs-btn--corner`, z-index 30). Un modo que pinte una barra a
  todo el ancho dentro del marco debe respetar `--ww-fs-reserve` (lo hace el marcador
  del duelo). El marcador VS lo tapaba: el botón existía y NO se podía tocar. Vigilado
  por `node tools/matrix-smoke.mjs` con hit-testing real, no con `querySelector`.
- **Buscar actividades**: SIEMPRE `searchActivities` (`core/search.js`) — uno solo para la
  home y la biblioteca (estaba copiado en las dos, con `includes` sobre título/subtítulo/tags).
  Buscar es BINARIO (norte §2b): sin tildes ni mayúsculas, por PALABRAS en cualquier orden, y
  también DENTRO del contenido (el tema suele estar en las preguntas). El "no hay" no es un
  callejón: lleva a CREAR. Vigilado por `tests/search.test.mjs` — cada caso es un falso
  negativo que mandaría al profe a rehacer algo que ya tiene, con la clase delante.
- **Fallar en silencio está PROHIBIDO** (R6): un `catch {}` vacío alrededor de algo
  que el usuario pidió (guardar · borrar · entregar · sincronizar) rompe CI por la regla
  `fallo-mudo`. El best-effort sigue permitido, pero con su motivo ESCRITO al lado —
  escribirlo es cuando se ve si de verdad lo era. Cazó "Borrar todo" del admin, que
  decía «Listo: N borradas» aunque hubieran fallado las N.
- **Claves del almacén** (`ww.*`): cada una con UN dueño declarado en `LS_OWNERS`
  (`core/normsCheck.js`), igual que las colecciones PB. Una vista NUNCA declara su
  propia clave: `ww.nick` acabó definida en `studentLive` y `studentTask` a la vez
  (el apodo es de `core/identity.js`), y `ww.skin` se leía sin que nadie la escribiera.
  Vigilado por la regla `ls-dueno`; una clave nueva sin declarar rompe CI.
- **Filtros PocketBase**: SIEMPRE `pbEscape`/`pbFilterParam` (`core/pbFilter.js`), nunca
  `encodeURIComponent` a pelo (no escapa la comilla simple).
- **Qué persiste cada modo**: cuadro único en `core/persistPolicy.js` (Individual → `results`;
  Tarea → `assignment_attempts` y NUNCA `results` a la vez; Live → `live_answers`; VS y Equipos →
  nada, POR DISEÑO: pizarra compartida sin identidad de alumno y sin vista que lo lea). Lo lee
  `trySaveResult`; un modo desconocido no guarda (fail-safe). Vigilado por `tests/persistPolicy.test.mjs`.
  El **techo** (`maxScore`) sale de `defaultMaxScore` (`core/scoring`) y el shell lo ENTREGA en
  `onFinish` → el "X / max" de la pantalla y el registrado son el mismo número.
- **Gateo de tareas** (cerrada / vencida / sin intentos): SIEMPRE `assignmentGate`
  (`core/assignmentRules.js`, puro y testeado). `views/studentTask.js` lo reimplementaba con otra
  semántica (`max_attempts` nulo = ilimitado vs 1).
- **Puntos**: convención en `core/scoring/` (basePoints/wrongPoints/useKahoot/awardPoints); Tildes/Comas
  puntúan **NETO por marca** (`scoreMarksPerHit`, `pointsPerCorrect` default 1): puntaje =
  `max(0, aciertos − de más) × ppc` — cada marca buena suma, cada marca de MÁS resta, así "marcar
  todo" NO gana (neto 0). `hits`/`over`/`total` se conservan para la tabla ("3/8 · 2 de más") y
  `perfect` = todas y ninguna de más. Así `player.score`, la tabla y el podio muestran el MISMO número.
  **Regla inherente = un solo scorer por plantilla**: TODOS los modos (Solo, Tarea, VS, Equipos, Live
  y cualquier modo futuro) puntúan vía `T.scoreSubmission` (que envuelve `scoreMarksPerHit`); NUNCA
  se reimplementa el conteo en la vista/runner de un modo **ni en el player Individual**. Los
  PARÁMETROS (`scoring.pointsPerCorrect`) los lee el SCORER, nunca el player; la LÓGICA vive en la
  plantilla → imposible que un modo desincronice. El **techo** (`maxScore`) se DERIVA del propio
  scorer ("lo que daría acertarlo todo"), no de una fórmula paralela. Lo vigila
  `tests/scoringSources.test.mjs` (4 reglas ejecutables) — antes match/diagram/crossword/memory
  llevaban aritmética propia en Individual.
  El runner Solo (`runTextCorrectionSolo`) también llama a `scoreMarksPerHit` (no tiene copia propia).
  **En CARRERA los puntos son PLANOS** (`mode:'race'` en el settle → `useKahoot()` no enciende el
  bonus): la carrera la gana *quien termina primero con todas bien*, así que el puntaje ES el
  número de aciertos y el tiempo solo DESEMPATA. El ranking (marcador y podio) sale de
  **`core/liveRank.js`** (`rankPlayers`), compartido por el adaptador PocketBase y el motor; la
  "hora de meta" la pone el servidor (`created`), nunca el `ms` que afirma el móvil (§22).
  Vigilado por `tests/raceRank.test.mjs` (con contra-prueba: en rondas el bonus sigue vivo).
  OJO: en carrera un fallo VUELVE A LA COLA, así que todo el que termina lo hace con TODAS bien
  → el puntaje no ordena y **manda la hora de meta**. Por eso el desempate está también en
  `buildSessionTable` (`views/sessionTable.js`, campo `finishMs`), que es de donde sale el PODIO
  del profe — no de `leaderboard()` —, y el podio la MUESTRA (`m:ss`) para que el orden se entienda.
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
- **Relojes**: hay TRES formas y cada una tiene su primitivo — nunca un `setInterval` a pelo.
  Duración (temporizador por ítem en Individual) → `createCountdown` (`core/soloTimer.js`);
  hasta un instante que manda el servidor (pregunta en vivo) → `startDeadlineTicker`;
  ascendente desde un inicio (carrera, tablero) → `startElapsedTicker` (ambos en
  `core/deadlineTicker.js`, con `clock.now()` y guard `while` para que un reloj zombi no repinte
  sobre la fase siguiente). Las vistas de Live ya NO usan `Date.now()` crudo → son testeables con
  tiempo congelado (`tests/deadlineTicker.test.mjs`).
- **Ficha de ocupación del escenario** (`core/stageClaim.js`, §23): quien monta un modo
  RECLAMA el stage (`claimStage`, lo hace `runMode()` y los dos shells de
  `core/soloPlayer.js`); un timer tardío pregunta `alive()` antes de repintar. Nunca
  guardar "¿existe el selector?" como guard: el selector genérico existe también en la
  página SIGUIENTE (la Ruleta girada pintaba su ganador encima del VS de Emparejar
  montado después — lo cazó la matriz al jugar las rondas). Vigilado por
  `tests/stageClaim.test.mjs` (con contra-prueba: el flujo legítimo termina igual).
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

### 🔴 DEUDA ABIERTA (v1.51.420) — verificación EN APARATOS REALES
Lo que solo se puede comprobar con la pizarra y los móviles delante. Decisión del
usuario: se deja pendiente, no bloquea el resto.
- **§22-5 · el reloj (PASO 5 de la guía, «rondas juntas»)**: el arreglo está probado
  con desfase simulado en `live-smoke`; falta el ✅ de que en un PC + un Android
  REALES la cuenta de «Preparados…» marque el MISMO número. **No es una prueba
  táctil**: el paso 5 es el de la ventana de lectura y el cronómetro.
- **Lápiz / borrador en pizarra REAL** (v1.51.419): probado con toque real headless;
  falta verlo con lápiz y palma de verdad, y revisar los umbrales del detector.
- **Calibrador de pizarra**: el usuario tiene uno propio para adaptar; el que hay
  (`core/penCalibration.js`) funciona pero sus umbrales no se han contrastado.
- **Contra PocketBase REAL**: `race-e2e` y `stress-live 30` nunca se han corrido
  desde aquí (piden credenciales y la Pi).

### 🟠 PENDIENTE EN LA PI (v1.51.420) — un solo ajuste a mano
Tras "Crear colecciones" del usuario, las 13 colecciones existen y sus reglas están
al día. Queda UNA deriva real de atributo, que el panel NO auto-corrige a propósito
(cambiar un campo con datos dentro, en una Pi compartida, es decisión del dueño):
- **`activities.data.maxSize`: el servidor tiene 0 (sin tope) y §25 exige 2097152.**
  Mientras siga en 0, el tope de 2 MB por actividad es solo un aviso del cliente.
- `activities.data.required` está en `true` y el esquema dice `false`: el servidor es
  MÁS estricto, así que no rompe nada hoy (siempre se escribe `data`). Alinearlo es
  higiene, no urgencia.
- Los avisos de `tags.maxSize` y `overrides.maxSize` eran **falsa alarma del propio
  verificador** (comparaba rellenos por defecto, no lo declarado): corregido en
  v1.51.420 — solo se reportan los atributos que el DEFS declara.

### 🟡 DEUDA CONDICIONADA — partir los 4 módulos grandes (TRAS los tests del compañero)
Registrada en la cola del norte (#5). NO ejecutar hasta que el compañero termine su ronda
rigurosa de pruebas manuales: partir es cirugía y se opera sobre un cuerpo verificado.
Los cortes ya están mapeados (no re-diseñar al ejecutar):
- `adapters/pocketbase/realtime.js` (1106) → **POR COLECCIÓN**: claims / answers / rooms / mantenimiento.
- `views/hostLive.js` (1031) + `views/studentLive.js` → **POR BUCLE**: lobby / rondas / carrera / tablero / pedir-la-palabra / informe.
- `views/adminView.js` (953) → **POR PANEL** (precedente ya en el repo: `views/admin/matrix.js`).
- `kernel/session/engine.js` (540) → **POR MÁQUINA**: items / score / live / teams / vs.
Al partir: `node tools/module-map.mjs` + preflight completo; los guardianes (layers, moduleRefs,
realtimePort) deben seguir verdes sin tocar sus listas.

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

### 🟡 FUERA DE LA ESCENA — embeber en otra web (`embed.html`), BETA declarada
Decisión del usuario (v1.51.412): embeber **no se soporta por ahora**. El código existe y
pinta (la matriz lo abre en local para que no muera en silencio), pero nadie lo ha validado
dentro de un blog ni de un LMS — cookies de terceros, fullscreen denegado en iframe y PB
desde otro origen están SIN probar. **Se reabre solo si Google Classroom lo necesita.**
La UI lo dice antes: botón «Embed **beta**» + aviso en el diálogo. Detalle y condición de
reapertura en `docs/norte.md` §7c.

### 🟡 DECISIONES APLAZADAS (D1-D5) — deuda de PRODUCTO, no de código
Decisión del usuario (v1.51.340): se ejecutan solo las estructurales. **D6 hecha**
(ley §25 · cuotas y retención) y **D7 estudiada y congelada** (ley §26 + estudio medido
en `docs/estudio-bucles-live.md`). Quedan como módulos que se pueden añadir DESPUÉS sin
rediseñar nada — ficha completa y recomendación en **`docs/decisiones-pendientes.md`**:
- **D1 · identidad del alumno** (clases con lista de nombres): sin esto no hay seguimiento
  del alumno en el año y los informes por alumno se quedan a medias. Es la más estructural
  de las aplazadas; prerequisito del PIN/NFC (U2-U4).
- **D3 · imprimible** (hoja de trabajo por MODELO de contenido, no por plantilla).
- **D5 · taxonomía de la biblioteca** (grado·área·tema con vocabulario cerrado).
- **D2 · "duplicar como otra plantilla"** (hoy el cambio de plantilla es destructivo).
- **D4 · aula sin internet** (PWA): solo tras estabilizar la caché (ver v1.51.336).

### 🟡 AUDITORÍA INTEGRAL (Fable, 2026-07) — EJECUTADA en su mayoría → `docs/historico/handoff-auditoria-fable.md`
4 agentes en paralelo (datos/sync · live · seguridad · UI). **20+ ítems ✅ hechos**
(XSS de backgroundImage, tombstones, localStorage lleno, fullscreen denegado,
robustez de colas, batches A-H completos) — el detalle con versión de cada fix
está en el handoff. QUEDA, y es **paso del usuario o diseño**, no código pendiente:
- **P0-1**: reglas endurecidas EN CÓDIGO (v1.51.214+, U1) — falta **aplicarlas en
  la Pi** (`#/admin` → "Crear colecciones" + verificación `tools/check-pb.sh`).
- **P0-2/P0-3**: la clave viaja al móvil SOLO en carrera (excepción declarada
  §22-2); cerrarla del todo pide un validador en el SERVIDOR (hook PocketBase en
  la Pi) → diseño en `docs/handoff-seguridad-pb.md` Fase 3.
> Este bloque decía "PENDIENTE · reglas 100% abiertas" cuando había 20 ✅: un doc
> de entrada que grita una urgencia falsa entrena a ignorar los avisos reales.

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
