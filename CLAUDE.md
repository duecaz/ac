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

### 4. LAS DOCE LEYES — contrastar TODO diseño contra ellas ANTES de escribir código
Cada ley es un cuadro **dueño → PROHIBIDO** con su test que rompe CI. Si un cambio
necesita violar una prohibición, el diseño está mal planteado: no se parchea, se
replantea. Texto completo en **`docs/leyes.md`** (índice único de normas).

| Ley | En una frase | Vigilada por |
|---|---|---|
| **§0 · CUATRO CAPAS** | contenido · plantilla · modo · plataforma: una plantilla no sabe en qué modo corre (lo DECLARA), un modo no conoce plantillas concretas | `scoringSources` · `persistPolicy` · `templateContract` · matriz jugable |
| **§3 · ESTILO** | 4 capas del píxel: el skin cambia TOKENS, la actividad consume TOKENS; nada de tamaños fijos en el juego | `styles` (ratchet + gate de themes) · `skins` |
| **§21 · DATOS** | cada colección PB **y cada clave `ww.*` del almacén** tiene UN módulo dueño; quien necesite datos **pide un método al dueño**, nunca hace fetch ni `lsGet` propio | reglas `pb-dueno` + `ls-dueno` (`norms`) |
| **§21b · UN DUEÑO** | la misma regla escrita dos veces siempre acaba diciendo dos cosas: se quita la copia, no se vigila | `ajusteConectado` (un ajuste, una casilla) · `skinContract` · `editor-puertas` |
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
| **§31 · COSTURAS** | toda declaración tiene lector · toda regla un dueño · toda red se comprueba en rojo antes de creerla verde | los seis `tools/costuras-*.mjs` en `tools/auditoria.mjs` (ratchet: solo baja) |

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
| **TEMAS y FONDOS**: qué declara cada eje, quién gana al cruzarse y cómo se garantiza el contraste | **[`docs/leyes.md`](docs/leyes.md) §3c** — `tests/contrast.test.mjs` + `tools/contrast-torture.mjs` |
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
| **QUÉ PIEZAS tiene cada actividad y cuánto ocupan** (en hueco ancho y en hueco alto) | **[`docs/piezas-por-actividad.md`](docs/piezas-por-actividad.md)** — GENERADO: `node tools/piezas.mjs` (es el dato de D8) |
| **QUÉ TOKEN declara cada tema y quién lo consume** (la interfaz tema↔juego, §3) | **[`docs/tokens.md`](docs/tokens.md)** — GENERADO: `node tools/tokens.mjs` (lo vigila `tests/tokenConectado.test.mjs`) |
| **Por qué Bootstrap está COPIADO en el repo** (nada de CDN: aula sin internet + el arnés medía otra pantalla) | **[`vendor/README.md`](vendor/README.md)** — lo vigila `tests/vendor.test.mjs` |
| **QUÉ PRODUCE CONVERTIR de una plantilla a otra** (las 36, con lo que la conversión no puede inventar) | **[`docs/conversiones.md`](docs/conversiones.md)** — GENERADO: `node tools/conversiones.mjs --md` |
| **Matriz JUGABLE** (cada plantilla × cada modo arranca sin crash) | `node tools/matrix-smoke.mjs` + `tests/moduleRefs.test.mjs` (imports olvidados) |
| **EN VIVO e2e** (host+alumno en dos páginas: sala→PIN→respuesta→settle→podio) | `node tools/live-smoke.mjs` |
| **TAREAS e2e** (crear tarea → PIN → el alumno juega → tope de intentos → informe) | `node tools/task-smoke.mjs` |
| **CARRERA e2e contra PocketBase REAL** (puntos planos · gana quien acabó antes · meta del servidor · la trampa rebota) | `node tools/race-e2e.mjs [PB_URL]` (credenciales por entorno `WW_EMAIL`/`WW_PASS`) |
| **¿Editar el contenido pierde la respuesta correcta?** (teclea en los 13 editores y re-pregunta al scorer) | `node tools/edit-audit.mjs` |
| **Prueba de CARGA** (N alumnos concurrentes live+tareas contra PB real) | `core/stressTest.js` · botón `#/admin` "Simular carga" · `node tools/stress-live.mjs [N]` |
| Modo SOLO (Wordwall) por dentro · identidad/auth · dev local | [`docs/modo-wordwall.md`](docs/modo-wordwall.md) · [`docs/identidad.md`](docs/identidad.md) · [`docs/dev-local.md`](docs/dev-local.md) |
| **La IA que ESCRIBE el contenido** (por modelo · módulo aparte · el hook de la Pi) | **[`docs/handoff-ia-contenido.md`](docs/handoff-ia-contenido.md)** — FUNCIONANDO desde v1.51.548; su §7b guarda las tres trampas que costaron ponerlo en pie (los 5xx que se come Cloudflare, el ámbito de los handlers, el modelo con caducidad) |
| **Plan del EDITOR** (márgenes · «+ Añadir» · imagen↔pines · nacer en blanco · buscador) | **[`docs/handoff-editor-general.md`](docs/handoff-editor-general.md)** (decidido 2026-08-13, sin ejecutar) |
| **LOS TRES JUEGOS DE INICIAL** (Colorear · Tangram · Rompecabezas: leyes contrastadas, decisiones técnicas, banco compartido, lo que decide el dueño) | **[`docs/handoff-juegos-inicial.md`](docs/handoff-juegos-inicial.md)** |
| **DETECTAR LAS COSTURAS** (basura · duplicados · declaraciones sin lector · polimorfismo a medias · cableado sin extremo): los 7 barridos, ejecutados a cero | **[`docs/handoff-costuras.md`](docs/handoff-costuras.md)** §1b — ley §31 |
| **DECISIONES de producto pendientes** (contrastadas con Wordwall y similares: identidad del alumno, imprimible, cuotas…) | **[`docs/decisiones-pendientes.md`](docs/decisiones-pendientes.md)** |
| **Cuántos bucles de juego en vivo hay y qué cuestan** (estudio D7, medido) | **[`docs/estudio-bucles-live.md`](docs/estudio-bucles-live.md)** + ley §26 |
| Índice completo de docs | [`docs/README.md`](docs/README.md) (lo histórico vive en `docs/historico/`) |
| **Cómo se puntúa CADA actividad** | `core/scoring/` + el scorer de cada plantilla; la ley y su test, en [`docs/leyes.md`](docs/leyes.md) (`scoringSources`). El plan original, ya ejecutado, en `docs/historico/handoff-puntuacion.md` |
| **Bugs abiertos / deuda** | la sección "Deuda técnica registrada" (abajo) + notas `docs/handoff-*.md` |
| **Configurar Google Classroom** (pasos en Google Cloud) | [`docs/handoff-google-classroom.md`](docs/handoff-google-classroom.md) |
| **Seguridad de PocketBase por fases** | [`docs/handoff-seguridad-pb.md`](docs/handoff-seguridad-pb.md) — su Fase 3 es hoy un LÍMITE declarado en `leyes.md` §22 |
| **Verificar la Pi contra el esquema del código** (13 colecciones · campos mudos · índices · tope §25) | `PB=https://pb.lanube.uno bash tools/check-pb.sh` — lo cruza `tests/pbSchema.test.mjs` |
| **Cómo está la BD/Pi de VERDAD** (PocketBase, Docker, backups, OAuth Google, quirks) y **los ajustes de CLOUDFLARE** (HTTP/3 apagado: con él, el modo en vivo se corta) | **[`docs/infraestructura-pb.md`](docs/infraestructura-pb.md)** (fuente de infra; actualizar si cambia el servidor) |
| **Plan de usuarios/acceso docente** (endurecer reglas, PIN, NFC, pizarras, panel profes) | **[`docs/handoff-acceso-docente.md`](docs/handoff-acceso-docente.md)** (incluye auditoría del sistema de usuarios) |

### 5. EL RITUAL DE ENTREGA ESTÁ ESCRITO — `/entregar`
No hay que acordarse de los pasos: son un skill del proyecto
(`.claude/skills/entregar/SKILL.md`). Al terminar un cambio, `/entregar` recorre
versión → regenerados → preflight → `/code-review` → `/simplify` → sonda en
navegador → docs → push a las tres ramas → qué queda sin verificar y por quién.
Y lo que de verdad no se puede olvidar está ATADO, no confiado a la memoria:
- **`.githooks/pre-push`** para el push a `main`. `tools/preflight.mjs` sella
  `.preflight-ok` con el hash del árbol que verificó; el hook lo compara con lo
  que se empuja y PARA si no coinciden. Se instala una vez por copia del repo
  (también en Windows): `git config core.hooksPath .githooks`. Salida de
  emergencia con la clase delante: `git push --no-verify`.

Verificar SIEMPRE antes de commitear: **`node tools/preflight.mjs`** — suite + auditoría
de basura (`tools/auditoria.mjs`) + los ONCE recorridos (matriz jugable · cq sin contenedor · lápiz y borrador · la PIZARRA LENTA del aula · tema×fondo legible · márgenes del panel · puertas del editor · buscar/crear+EDITAR · editores · en vivo · tareas · entregar la hoja de pruebas) en ~350 s, ley §27. `node
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
| `rounds` · Rondas juntas | `question` | el profe o el reloj | más puntos | bonus: base×500 + bonus por velocidad | al agotar las preguntas | Comas · Operaciones · Quiz · Tildes |
| `race` · Carrera libre | `race` | cada alumno | **terminar primero con todas bien** (empate ⇒ hora de meta) | **planos**: el puntaje ES el nº de aciertos | política declarada: todos · primeros N · tiempo | Comas · Operaciones · Quiz · Tildes |
| `board` · Tablero | `race` | cada alumno | avanzar más en el tablero | escala propia de la plantilla (Pelotas: 0-1000 por eficiencia) | igual que la carrera | Ordena las Pelotas |
| `claim` · Pedir la palabra | `question-live` | el profe (a quien pide turno) | los puntos que da el docente | manuales (+10/+50), sin clave de respuesta | lo cierra el docente | Abre Cajas · Ruleta |

> Generado de `core/liveLoops.js` + `meta.play.live` de las 16 plantillas.
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
  `build()`, falla en CI). El antiguo `activityThumb` (render real escalado) se BORRÓ
  al quedarse sin importadores (§30): el home dejó de usarlo por rendimiento y nada más lo pedía. Pendiente: que el preview respete tema/fondo de la actividad (ver
  `docs/historico/handoff-previews-home.md` Fase 2b).
- En móvil (≤640px) la barra superior colapsa en un **menú hamburguesa** (`.ww-topbar__burger`
  → clase `.open`); las acciones (incl. `#ww-mute-slot`/`#ww-auth-slot`) caen en el desplegable.
  Lo cablea **`wireTopbarMenu()`** (`core/boot.js`), que lo llaman las dos `main.*` con
  barra — NUNCA un `onclick` en el HTML (estaba repetido en los dos y ninguno cerraba al
  tocar fuera). Cierra por las cuatro vías que el usuario espera: el botón, una acción,
  un toque FUERA y Escape; y al navegar, para no quedarse encima de la vista siguiente
  (§23). Vigilado ejecutando el cableado en `tests/menu.test.mjs`.

## Estándares transversales (no romper)
- **LA ANTESALA ES UNA** (`views/antesala.js`): todo lo de «antes de jugar» —Individual, VS,
  Equipos, Memoria, Lista y Tarea— pasa por la misma pantalla. Había CUATRO y cada una decidía
  por su cuenta: **UN** control de arranque (`data-ww-start`) y **siempre** pantalla completa
  (la elección no es del que juega: en clase se proyecta, y salir es Esc); las **instrucciones**
  a la vista (`meta.instructions` es obligatorio y lo leía 1 modo de 4); el **ambiente**
  (sonido·efectos + lo que añada el modo) como pastillas iguales en todas. Si el marco nace al
  arrancar (la tarea), se monta y se pide la pantalla completa después, en el mismo gesto.
  Cada modo aporta SOLO su cuerpo (avatares, nº de equipos, intentos). Lo vigilan
  `tests/antesala.test.mjs` (código) y `matrix-smoke` (DOM montado, cada plantilla × modo).
  OJO: una utilidad de Bootstrap (`p-2`) en la raíz del juego lleva `!important` y pisa las
  reglas del propio juego (tapó la reserva del HUD) — el relleno va en la hoja de la plantilla.
- **Registro de plantillas y arranque**: `core/registerTemplates.js` (las 16 —13 ejercicios + 3 juegos—, punto único) +
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
  (`core/playOptions.js`), y los pintan la pantalla de inicio y el setup de VS/Equipos. `set` es PURO: la actividad guardada NO se toca
  (§24) y lo del editor sigue siendo contenido. Tope: la
  opción viene SIEMPRE ya elegida (R2: nada que configurar para empezar). Lo vigila
  `tests/playOptions.test.mjs`.
- **En CARRERA la vara es COMPLETA**: `racePassed()` (`core/liveLoops.js`) — una hoja de
  Tildes/Comas a medias VUELVE A LA COLA (su scorer da crédito por marca, `correct: net>0`).
  Sin esto la premisa del podio es falsa: ordena por hora de meta PORQUE todos terminan con
  todas bien. Y el móvil **nunca juzga sin clave**: `hasClientKey()` + el guard de
  `paintRace` (`core/liveSnapshot.js`). Lo vigila `tests/raceKey.test.mjs`.
- **Tarjeta de actividad**: una sola (`core/activityCard.js`) y con VARIANTE, no con
  banderitas sueltas: `variant: 'mine' | 'library' | 'plain'`. Los campos informativos
  (subtítulo · etiquetas · autor · páginas) van ENCENDIDOS y se pintan si el dato existe:
  "qué muestra una tarjeta" lo decide el componente, no cada vista.
  Unificar el markup no bastó (divergió la CONFIGURACIÓN) ni la configuración (los CLICS
  seguían copiados en las 5 vistas, y por eso Live/Tarea no salían de "Mis actividades").
  Cada botón declara su modo (`data-mode`), `rutaDeModo()` pone la ruta y
  **`views/activityCardWire.js`** cablea; `authed` es fail-CLOSED. Lo vigila
  `activityCard.test` (nadie apaga un campo ni recablea modos).
- **LA FORMA DEL MARCO DE JUEGO** (`core/frameAspect.js`): la PLANTILLA declara su
  proporción (`meta.aspectRatio`, def. 4/3) y la plataforma OBEDECE — profe, alumno en
  vivo y tarea llevan la MISMA (§0). El tamaño sale del hueco: ancho máx. = alto libre ×
  proporción (`--ww-ar`), nunca un alto absoluto. La SUELTAN tres casos: pantalla
  completa (100vw×100vh), VS/Equipos (`.is-expanded`) y **la ventana claramente
  vertical** (`max-aspect-ratio: 3/4`) — con 4:3 a la fuerza, un móvil dejaba al
  juego en el 29 % de la pantalla. Por eso la proporción viaja como VARIABLE
  (`--ww-ar-css`), nunca como estilo en línea: en línea no se puede soltar. El panel del docente en vivo
  no lleva proporción: no es un juego en una página, es un tablero con pantallas de alturas
  distintas (`caja:false`) — con 4:3 le cortaba el QR del lobby. Vigilado en `live-smoke`
  (proporción declarada = la del marco · sin scroll en cuatro ventanas).
- **LA DIAGRAMACIÓN DEL PLAYER: TRES roles** (detalle en
  `docs/estilos-de-actividad.md` §3b0): **`edu-cabecera`** (UNA, la misma en las
  13 — `cabeceraHtml` de `core/playerHud.js`: herramientas · página/racha/extra ·
  RELOJ centrado · pantalla completa; el aspecto lo pone la superficie de debajo,
  por tokens `--cab-*`) · **el juego** (`edu-sec--*`, subsecciones con nombre que
  refluyen) · **`edu-send`**. Eran cuatro (los indicadores flotaban y solo 3 de 13
  llevaban barra: tres tratamientos de la misma franja). El TÍTULO vive en la
  ANTESALA; el enunciado no es barra. `edu-send` sale del PLAYER, no de
  `meta.play.submit`: lo vigila `matrix-smoke` montando las 13, con 3 excepciones
  donde el control ES la mecánica (teclado · Girar · caja abierta).
- **PANTALLA COMPLETA: un solo mando, y lo aloja la CABECERA** cuando esa cabecera
  manda en el marco (Individual/Tarea); entonces la esquina flotante
  (`.ww-fs-btn--corner`, z-index 30) se retira por CSS. En el duelo se montan DOS
  rondas y la esquina —que es UNA— sigue mandando; un modo que pinte una barra a
  todo el ancho debe respetar `--ww-fs-reserve` (el marcador VS lo tapaba: el
  botón existía y NO se podía tocar). Se cablea UNA vez en el marco, por
  DELEGACIÓN (`core/fullscreen.js`), así que un botón pintado después de un
  re-render responde igual; y el icono lo decide el CSS (`:fullscreen`), no un
  intercambio en JS que se desincronizaba. Lo mide `matrix-smoke` con
  hit-testing real y estilos computados, no con `querySelector`.
- **Buscar actividades**: SIEMPRE `searchActivities` (`core/search.js`) — uno solo para la
  home y la biblioteca (estaba copiado en las dos, con `includes` sobre título/subtítulo/tags).
  Buscar es BINARIO (norte §2b): sin tildes ni mayúsculas, por PALABRAS en cualquier orden, y
  también DENTRO del contenido (el tema suele estar en las preguntas). El "no hay" no es un
  callejón: lleva a CREAR. Vigilado por `tests/search.test.mjs` — cada caso es un falso
  negativo que mandaría al profe a rehacer algo que ya tiene, con la clase delante.
- **Toda puerta de imagen ofrece BUSCARLA**, no solo subirla: `core/imageSearchModal.js`
  (`abrirBuscadorImagenes`) sobre el núcleo puro `core/imageSearch.js` (Wikimedia
  Commons + Openverse, sin clave; el `fetch` se INYECTA, por eso se prueba entero sin
  red). La imagen elegida entra por `core/upload.js` igual que un archivo local → el
  tope de §25 se respeta solo. La **atribución** viaja con el píxel (`imageCredit` /
  `backgroundImageCredit`, §24) porque con Creative Commons el crédito es la condición
  de uso — y se borra al cambiar de imagen. Vigilado por la regla `imagen-buscable`
  (`core/normsCheck.js`): quien llame a `uploadMedia`/`readBackgroundImage` sin ofrecer
  el buscador rompe CI. Excepciones DECLARADAS con motivo (perfil, avatar del duelo,
  fondo de esta partida): no son contenido. Nació de «Etiqueta el diagrama», que solo
  dejaba subir: sin un corazón humano en el móvil, la actividad no se podía ni empezar.
- **Fallar en silencio está PROHIBIDO** (R6): un `catch {}` vacío alrededor de algo
  que el usuario pidió (guardar · borrar · entregar · sincronizar) rompe CI por la regla
  `fallo-mudo`. El best-effort sigue permitido, pero con su motivo ESCRITO al lado —
  escribirlo es cuando se ve si de verdad lo era. Cazó "Borrar todo" del admin, que
  decía «Listo: N borradas» aunque hubieran fallado las N.
- **Claves del almacén** (`ww.*`): cada una con UN dueño declarado en `LS_OWNERS`
  (`core/normsCheck.js`), igual que las colecciones PB. Una vista NUNCA declara su
  propia clave: `ww.nick` acabó definida en `studentLive` y `studentTask` a la vez, y
  `ww.skin` se leía sin que nadie la escribiera. Vigilado por `ls-dueno`; `core/ls.js`
  es el ÚNICO que puede nombrar `localStorage`/`sessionStorage` a pelo (`almacen-crudo`,
  §21) y tiene el GEMELO DE SESIÓN `ssGet`/`ssSet`/`ssDel`.
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
- **Puntos**: convención en `core/scoring/` (basePoints/wrongPoints/usaBonusVelocidad/awardPoints); Tildes/Comas
  puntúan **NETO por marca** (`scoreMarksPerHit`; `pointsPerCorrect` **10** en las nuevas desde v1.51.612, las viejas conservan el suyo §24): puntaje =
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
  **En CARRERA los puntos son PLANOS** (`mode:'race'` en el settle → `usaBonusVelocidad()` no enciende el
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
- **Azar**: gemelo del reloj — el primitivo `azar.random()` (`core/azar.js`, con
  `semilla(n)`) y su `shuffle()`, dueño único del barajado. `Math.random` no se
  nombra en NINGÚN sitio salvo lo declarado en `ALLOW` con su motivo: IDs,
  confeti, partículas, jitter y los PIN (impredecibles a propósito). Un defecto
  que esquiva el primitivo ES el primitivo sin usar. Regla `azar-primitivo`.
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

> La crónica de lo YA RESUELTO (sistema de usuarios, reloj §22-5, lápiz,
> skins, deudas A-G, Supabase, players…) vive ÍNTEGRA en
> **[docs/historico/deuda-resuelta.md](docs/historico/deuda-resuelta.md)** —
> aquí queda SOLO lo abierto, para que la deuda viva se lea de una pasada.

### 🔴 DEUDA ABIERTA (v1.51.420) — verificación EN APARATOS REALES
Lo que solo se puede comprobar con la pizarra y los móviles delante. Decisión del
usuario: se deja pendiente, no bloquea el resto.
- **§22-5 · el reloj (PASO 5 de la guía, «rondas juntas»)**: el arreglo está probado
  con desfase simulado en `live-smoke`; falta el ✅ de que en un PC + un Android
  REALES la cuenta de «Preparados…» marque el MISMO número. **No es una prueba
  táctil**: el paso 5 es el de la ventana de lectura y el cronómetro.
- **Lápiz y palma en pizarra REAL** (v1.51.610: DOS herramientas, frontera única,
  calibración de 2 recuadros; medido headless en `tools/lapiz-sonda.mjs`). Falta la
  mano de verdad: es la Parte 1 de la hoja del compañero.
- **El FIN del Crucigrama y Abre Cajas en navegador** (v1.51.665: salen por la estándar del shell). Pasan la matriz; nadie lo ha MIRADO. Dueño: la regla primero.

### 🟡 UNA FUNCIÓN QUE EL PANEL PROMETÍA Y NO EXISTE (v1.51.482)
El escaneo de «ajustes desconectados» encontró SIETE mandos que el editor
escribía y nadie leía. Cuatro se conectaron (filtro de apodos · leaderboard
entre preguntas · mostrar respuesta tras cada · ayuda del crucigrama). De los
otros tres, dos se RETIRARON del esquema por decisión del dueño (`rules.
allowOverflow`/`showHints` de Tildes y Comas, `rules.livesPerMistake` de
Match, `scoring.penaltyRatio`: prometidos sin mecánica — barrido B1,
2026-09-02). Queda uno como función a decidir:
- **Bonus por racha** (`live.streakBonus` + `streakBonusPerStep`): los puntos
  extra los calculaba una **Edge Function de Supabase**, y Supabase se retiró.
  Para reponerlo hay que decidir dónde se calcula (¿el settle del host?) y si la
  racha cuenta por alumno o por sala. La racha SÍ se sigue viendo (🔥).
> Lo vigila `tests/ajusteConectado.test.mjs`: un ajuste nuevo que nadie lea
> rompe CI. Su lista de excepciones debe quedarse en 1 (el crédito de imagen).

### 🟡 IMÁGENES COMO WORDWALL (Google) — decisión TOMADA, ejecución aplazada
Decisión del dueño (2026-08-14): «al final haremos lo que Wordwall y usaremos la
búsqueda de imágenes de Google, luego lo veremos». Se apunta para no volver a
investigarlo desde cero:
- La rejilla de Wordwall **es Google Imágenes** (sus miniaturas son
  `encrypted-tbn0.gstatic.com/images?q=tbn:…`). Vía real hoy: **Programmable
  Search** con `searchType=image`; 100 consultas/día gratis y ~5 $/1000 después.
  Bing Search API está RETIRADA (2025), así que no es alternativa.
- **La clave NO puede vivir en el repo** (web estática: todo se lee). Va en la
  Pi — `pb_hooks` de PocketBase 0.23 basta, sin montar otro servicio, pero toca
  el compose de un servidor COMPARTIDO con `aportes` y `equipos_activados`.
- El punto medio, si se quiere bajar el riesgo: Google acepta
  `rights=cc_publicdomain|cc_attribute|cc_sharealike` → calidad de búsqueda de
  Google con licencia resuelta.
- **Lo que hay que decidir al ejecutar**: los profes PUBLICAN en la biblioteca,
  así que una imagen con derechos desconocidos viaja con la actividad. Wordwall
  se lo pasa al usuario en sus términos; aquí hace falta decidirlo por escrito.
- Mientras tanto están Wikipedia (es) · Commons · Pixabay (`core/imageKeys.js`).

### 🟡 FUERA DE LA ESCENA — embeber en otra web (`embed.html`), BETA declarada
Decisión del usuario (v1.51.412): embeber **no se soporta por ahora**. El código existe y
pinta (la matriz lo abre en local para que no muera en silencio), pero nadie lo ha validado
dentro de un blog ni de un LMS — cookies de terceros, fullscreen denegado en iframe y PB
desde otro origen están SIN probar. **Se reabre solo si Google Classroom lo necesita.**
La UI lo dice antes: botón «Embed **beta**» + aviso en el diálogo. Detalle y condición de
reapertura en `docs/norte.md` §7c.

### 🟡 DECISIONES APLAZADAS (D1-D3, D5) — deuda de PRODUCTO, no de código
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
  - `next()` / `finish()` — para cores con avance dirigido por animación (Globos avanza al explotar, o termina al agotar los ítems).
- Callers (medido 2026-09-04): Math, Quiz, Globos.

**Shell Libre** `runFreeformPlayer(rootSel, activity, opts)` → devuelve `ctx` ✅:
- El player llama `ctx.finish({score, maxScore, title, stats, after})` al terminar — AÑADE sobre la estándar, nunca la sustituye (`skipResultScreen` no existe: lo caza B8).
- Shell garantiza: `resultScreenHtml()` SIEMPRE, `trySaveResult()`, `onFinish()`.
- Callers (medido 2026-09-04): Wheel, Question-Live, Memory, Match, Wordsearch, Crossword, Diagram, Ballsort; Tildes y Comas vía `runTextCorrectionSolo` (que corre sobre este shell). **Las 13 sobre un shell** — la migración terminó; este cuadro dijo «pendientes» versiones después de estarlo.

**Timer único** `core/soloTimer.js` — `createCountdown(secs, {onTick, onTimeout, setIntervalFn?, clearIntervalFn?})` ✅:
- Cerró 3 implementaciones divergentes (Quiz, Globos, Wordsearch). Scheduler inyectable → tests deterministas.

**Orden de migración** — COMPLETADO (los 5 pasos, en `docs/historico/deuda-resuelta.md`).
