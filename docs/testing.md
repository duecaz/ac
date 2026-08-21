# Testeo — suites, cómo correrlas y cómo verificar lo visual

> **Tipo**: guía · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha)

> El MD de referencia para probar el proyecto. Tres niveles: **suite Node** (pura,
> CI), **self-tests en navegador** (panel admin) y **verificación headless**
> (Playwright) para lo que la suite no puede ver (DOM, táctil, layout).
>
> Documentos hermanos: qué hace cada actividad y feature → **`docs/panorama-actividades.md`**
> (su §5 tiene una tabla "qué suite prueba qué área") · contrato de CSS de actividad
> (relativo + tokens de skin) → **`docs/estilos-de-actividad.md`**.

<!-- GENERADO:nav -->
### Índice de este documento

- [0. El PREFLIGHT — la orden que hay que teclear (ley §27)](#0-el-preflight--la-orden-que-hay-que-teclear-ley-27)
- [1. Suite Node (la de CI)](#1-suite-node-la-de-ci)
  - [Mapa de suites (qué protege cada una)](#mapa-de-suites-qué-protege-cada-una)
  - [Añadir una suite](#añadir-una-suite)
- [2. Self-tests en navegador (panel admin)](#2-self-tests-en-navegador-panel-admin)
- [2b. Matriz JUGABLE — plantilla × modo (`tools/matrix-smoke.mjs`)](#2b-matriz-jugable--plantilla--modo-toolsmatrix-smokemjs)
- [2c. ¿Editar el contenido rompe la clave? (`tools/edit-audit.mjs`)](#2c-editar-el-contenido-rompe-la-clave-toolsedit-auditmjs)
- [3. Verificación headless (layout, táctil, visual)](#3-verificación-headless-layout-táctil-visual)
- [4. Qué NO está cubierto (y cómo se mitiga)](#4-qué-no-está-cubierto-y-cómo-se-mitiga)

### Ir a otro documento

| Documento | Qué responde |
|---|---|
| [`norte.md`](norte.md) | para quién es la app, la escena real y cómo se decide (**manda sobre el resto**) |
| [`leyes.md`](leyes.md) | TODAS las leyes, cada una con el test que la vigila |
| [`arquitectura-modulos.md`](arquitectura-modulos.md) | la radiografía: capas, imports, esfuerzo por tramo y mapa de datos (GENERADO) |
| [`modos-de-juego.md`](modos-de-juego.md) | contrato de los 5 modos y los 4 bucles en vivo |
| [`decisiones-pendientes.md`](decisiones-pendientes.md) | lo aplazado, con su condición para reabrirlo |
| [`estudio-bucles-live.md`](estudio-bucles-live.md) | por qué el vivo es como es (estudio medido) |
| [`guia-testeo-companero.md`](guia-testeo-companero.md) | guía de pruebas paso a paso, para alguien no técnico |
| [`../CLAUDE.md`](../CLAUDE.md) | el mapa de entrada del repo: "quiero X → voy a Y" |
<!-- /GENERADO:nav -->

## 0. El PREFLIGHT — la orden que hay que teclear (ley §27)

```bash
node tools/preflight.mjs           # suite + los 9 recorridos, ~100 s
node tools/preflight.mjs --rapido  # solo la suite (NO basta si tocas vistas/CSS/router)
```

Encadena las nueve redes y **para en la primera que falle**, enseñando su salida
y el comando para reproducirla. Existe porque `tests/run.mjs` verifica PIEZAS: los
cinco fallos que la clase encontró en una semana vivían en la COSTURA entre piezas
correctas (el enlace contra el router, el veredicto del móvil contra el snapshot,
el botón contra el marcador que se pintaba encima). Ninguno se ve sin abrir un
navegador y caminar el viaje.

| Red | Qué camina | Segundos |
|---|---|---|
| `tests/run.mjs` | lógica pura: contrato · normas · leyes · scorers | ~3 |
| `tools/matrix-smoke.mjs` | cada plantilla × cada modo + la ronda JUGADA con gesto real (30/30, 11 mecánicas) + controles tocables + **los 4 roles de la diagramación** (13/13) | ~85 |
| `tools/find-smoke.mjs` | buscar/crear: portada → biblioteca → mis actividades → crear → volver a buscar | ~8 |
| `tools/live-smoke.mjs` | en vivo con dos pantallas: sala → PIN → responder → settle → podio | ~9 |
| `tools/task-smoke.mjs` | tareas/informes: crear tarea → PIN → jugar → tope de intentos → informe del profe | ~8 |
| `tools/edit-audit.mjs` | teclear en los 13 editores y re-preguntar al scorer: la clave correcta sobrevive | ~9 |

Fuera del preflight a propósito: `race-e2e` (PocketBase real + credenciales),
`stress-live` (carga contra la Pi) y `shots` (comparación visual antes/después).

## 1. Suite Node (la de CI)

```bash
node tests/run.mjs          # todas las suites, aborta con exit≠0 al primer fallo
node tests/textMarks.test.mjs   # una suite individual (cualquiera se corre sola)
```

Sin framework: cada suite usa `node:assert` + un contador `ok(msg)` que imprime
`✓`. Un `AssertionError` no capturado corta la ejecución (CI-friendly). Solo se
testea **lógica pura** (sin DOM, sin red): motores, scorers, parsers, colas.

### Mapa de suites (qué protege cada una)

**Registro y modos**
| Suite | Protege |
|---|---|
| `registry` | El registro valida el contrato de plantilla y falla ruidosamente. |
| `modes` | La fuente única de gateo de modos (`core/modes.js`): qué modo se ofrece a qué actividad. |
| `modeMatrix` | La matriz del panel admin se deriva bien del registro (capacidad + métodos). |

**Contenido y puntuación**
| Suite | Protege |
|---|---|
| `content` | Modelos de contenido y conversores (`kernel/content/`). |
| `qaAdapt` | Conversión de contenido `qa` entre Quiz y Matemáticas. |
| `scoring` | Puntuación incremental compartida; piso en 0 en un solo sitio. |
| `textMarks` | Clave de respuesta de Tildes/Comas: parseo de acentos/comas, `scoreMarks`, `scoreMarksPerHit` (1 punto por tilde, anti-trampa). |
| `wheel` | Lógica pura de la ruleta (normalización, selección). |
| `ballsort` | Reglas del tablero (canMove/applyMove/isWin), generador reproducible, scorer y contrato live/VS. |
| `diagram` | Modelo de contenido (`newPin`/`newEmpty`/`validate`), `scoreDiagramSubmission` (etiqueta↔su pin) y contrato de plantilla. |

**Motores de sesión (sin DOM ni backend)**
| Suite | Protege |
|---|---|
| `sessionEngine` | TEAMS (turnos) y VS (duelo paralelo) sobre el motor unificado. |
| `live` | Máquina de fases LIVE + filtro de apodos. |
| `liveEngine` | Una partida LIVE completa simulada en memoria. |
| `liveLocal` | El driver realtime local a través de "pestañas" (KV + canal compartidos). |
| `liveText` | LIVE con plantilla NO-quiz (Tildes) de punta a punta — prueba la generalización. |
| `memory` | El bucle voltear/emparejar/turno de Memoria en Equipos. |
| `simPlay` | Alumnos VIRTUALES jugando VS y En vivo sobre el motor puro (ciclo completo). |

**Modo SOLO (Wordwall)**
| Suite | Protege |
|---|---|
| `solo` | La base no-DOM del modo un-solo-dispositivo. |
| `soloPlayer` | El SequentialShell (`core/soloPlayer.js`): bucle de ítems, submit idempotente, finish temprano. |
| `soloTimer` | El countdown único (`core/soloTimer.js`) con scheduler inyectado → ticks deterministas. |
| `render` | Constructores de HTML puros: markup bien formado, enlaces del final de actividad. |
| `presentation` | Invariante anti-fuga de temas: un apply con scope no pinta el body. |

**Infraestructura**
| Suite | Protege |
|---|---|
| `core` | Plumbing: enrutado de persistencia de resultados, bus pub/sub. |
| `routing` | Rutas puras (`core/routing.js`). |
| `adapters` | Contrato de los drivers de backend (local · pocketbase). |
| `storageMerge` | Regla de merge offline-first. |
| `stability` | Wrappers seguros de localStorage (`ls.js`), pureza del escapador HTML. |
| `offlineQueue` | Garantías anti-pérdida: dedupe al encolar, single-flight, reintento parcial. |
| `clock` | Reloj inyectable: congelar `clock.now` hace determinista la lógica de dominio. |
| `assignments` | Reglas puras de Tareas + flujo del driver local. |
| `penDetector` | Clasificación lápiz/dedo/borrador/palma por tamaño de contacto + derivación de umbrales de calibración. |
| `styles` | Ratchet anti-regresión del CSS de juego: sin `font-size` congelada ni color pintable a pelo (regla → `docs/estilos-de-actividad.md`). `math`/`quiz` limpios; deuda actual en un BASELINE que no puede crecer. |
| `templateContract` | El contrato de plantilla EJECUTABLE (`core/templateContract.js`): las 12 con meta completa (`instructions` obligatorio), `contentModel` registrado, `defaultContent` válido y jugable, scorer con forma `{correct, points}`, `migrateContent` idempotente, `previewHtml` (miniatura del home) y carpeta ↔ registro consistentes. Una plantilla NUEVA queda cubierta sola al registrarse. |
| `norms` | Normas transversales de CLAUDE.md como CI (`core/normsCheck.js`): nunca `new ResizeObserver` directo, nunca `filter=` PB con `encodeURIComponent`, `kernel/` determinista (sin `Date.now()`). Recorre TODO el JS del repo. |
| `skins` | Contrato de skin (`core/skinContract.js`): cada skin define el set COMPLETO de tokens pintables (los del skin `default`), sin apoyarse en el fallback silencioso de `theme.css :root`. Cazó 5 skins que no declaraban `--ww-success/danger/warning`. |
| `newTemplate` | Self-test del generador (`tools/new-template.mjs`): genera en un scratch y corre los checkers reales (contrato, normas, CSS) sobre lo emitido — si el contrato crece y el esqueleto se queda viejo, falla aquí. También guardas del CLI (no pisa carpetas, `--out` no muta el repo). |

> **Los tres checkers de arriba también corren en el panel `#/admin`** ("Ejecutar
> tests", grupos *Contrato*, *Normas* y *Skins*): mismos módulos
> `core/templateContract.js`, `core/normsCheck.js` y `core/skinContract.js`, sin
> duplicar lógica. En el admin, Normas escanea por `fetch` los fuentes SERVIDOS
> (manifest + plantillas del registro) — humo del deploy; la autoridad exhaustiva
> es la suite Node.

### Añadir una suite
1. Crea `tests/mifeature.test.mjs` con el patrón estándar:
   ```js
   import assert from 'node:assert';
   let passed = 0;
   const ok = (m) => { passed++; console.log('  ✓', m); };
   // ... asserts ...
   console.log(`\nmifeature.test: ${passed} checks passed`);
   ```
2. Regístrala en `tests/run.mjs` (una línea `await import`).
3. Regla de oro: si el módulo toca DOM/red, **extrae la lógica pura** a `core/` o
   `kernel/` y testea eso (así nacieron `soloTimer`, `clock`, `penDetector`).

## 2. Self-tests en navegador (panel admin)

`#/admin` → botón **"Ejecutar tests"** corre `core/selftest.js` (`TOTAL_TESTS`
comprobaciones), incluida la simulación de alumnos virtuales VS/En vivo dentro
del navegador real. El mismo panel tiene **"Probar base de datos"**
(`core/dbDiag.js`): conexión, latencia y ciclo real lectura/escritura/borrado
contra el backend activo.

**"Simular carga"** (`core/stressTest.js`) lanza N alumnos (30/50/100) entrando
y respondiendo **A LA VEZ** (live) + N intentos de tarea concurrentes contra el
PB REAL — caza los bugs de concurrencia que el driver local NO puede reproducir
(lost-update del join, throughput de la Pi, colisiones de apodo). Crea datos
`stress_*` desechables y los borra. Mismo motor por CLI: `node tools/stress-live.mjs [N]`.
Blindado por `tests/stressTest.test.mjs` (PB falso en memoria con índice único).

## 2b. Matriz JUGABLE — plantilla × modo (`tools/matrix-smoke.mjs`)

Las dos redes que impiden que un crash de primera pantalla llegue a la pizarra
(«Memoria por equipos NO ABRE», encontrado por QA a mano):

| Red | Qué hace | Cuándo corre |
|---|---|---|
| **`tests/moduleRefs.test.mjs`** | Mapea TODOS los `export` del repo y marca cualquier fichero que USE uno de esos nombres **sin importarlo**. Caza el `ReferenceError` latente que `node --check` no ve (la sintaxis es válida; el módulo importa bien; solo estalla al ejecutar esa línea). | Siempre, en `node tests/run.mjs` |
| **`tools/matrix-smoke.mjs`** | Monta CADA plantilla en CADA modo que declara soportar, pulsa Empezar y comprueba que el juego arranca sin errores de consola. Siembra con el `defaultContent()` **de la propia plantilla** → sin fixtures que mantener. | A mano / antes de publicar |

```bash
node tools/matrix-smoke.mjs              # las 13 × (solo · VS · equipos) — sale 1 si algo falla
node tools/matrix-smoke.mjs memory quiz  # solo esas plantillas
```

Ambas están **verificadas contra el bug real**: reintroduciendo el import que
faltaba en `views/memoryView.js`, el escáner lo señala con archivo:línea y la
matriz pinta ❌ en *Memoria · equipos* con el mensaje `teamsScoreboardHtml is not
defined`. Un test que no puede fallar no vale.

**El runner de dos contextos** (`tools/live-smoke.mjs`) cubre lo que la matriz
no puede: EN VIVO de punta a punta con una página HOST y una página ALUMNO sobre
el backend local (localStorage + BroadcastChannel = multi-pestaña real):
sala → PIN → join → pregunta → respuesta → settle → clasificación → podio.
La aserción clave post-C6: los puntos del podio los puso el settle del host.

```bash
node tools/live-smoke.mjs     # sale 1 si el flujo canónico de una clase se rompe
```

**La CARRERA contra PocketBase de verdad** (`tools/race-e2e.mjs`) cubre lo que el
driver local NO puede reproducir: la costura entre el settle, los autodate del
servidor y el podio. Ahí se colaron **cuatro** fallos seguidos entre v1.51.352 y
v1.51.355 sin que la batería se enterara (bonus de velocidad que hacía ganar a
quien acertaba 2 de 5 · el tiempo lo ponía el móvil · el PATCH del settle pisaba
`updated` y borraba la hora de meta de toda la clase · el podio ordenaba por un
campo que el alumno podía reescribir). Tres CONTEXTOS de navegador = tres
dispositivos (con uno solo, los dos alumnos comparten id anónimo y reconectan
como el MISMO jugador, que es lo correcto y arruina la prueba).

```bash
node tools/race-e2e.mjs http://127.0.0.1:8090          # réplica local
WW_EMAIL=… WW_PASS=… node tools/race-e2e.mjs           # la Pi (credenciales por ENTORNO)
```

Comprueba, en una carrera real de 5 preguntas donde uno va limpio y rápido y el
otro falla-corrige-y-tarda: que la sala GUARDA su bucle (§26) · que los dos
acaban con todas bien (un fallo vuelve a la cola) · **puntos planos** · **gana
quien terminó antes** · que la meta es de la CARRERA y no de la última pregunta ·
que marcador y podio dan el mismo ganador · y que la **trampa rebota** (PATCH
`{ms:0}` con la credencial propia sobre la fila ya liquidada). Nunca toca el
`pocketbase.config.js`: intercepta ese módulo y sirve la URL que se le pase —
editar el config para probar en local es la vía rápida de commitear un apunte a
`127.0.0.1` y dejar la web pública sin backend.

> Detalle útil: PocketBase responde **404** (no 403) cuando una regla de UPDATE
> no casa — no confirma que la fila exista. El simulador de `tests/liveRules`
> usa 403; contra el servidor real, rechazo es 403 **o** 404, y lo que nunca
> puede salir es 200. Si sale 200, ese PocketBase tiene las reglas viejas
> (`#/admin` → "Crear colecciones") y el propio informe lo dice.

**No cubierto todavía**: el modo Tarea end-to-end (mismo patrón de dos páginas,
pendiente).

## 2c. ¿Editar el contenido rompe la clave? (`tools/edit-audit.mjs`)

El bug de v1.51.337 (Quiz: corregir una errata en la opción CORRECTA dejaba la
pregunta con `answer: ''` → todas las respuestas malas, en todos los modos y sin
avisar) es de una CLASE que puede repetirse en cualquier plantilla: la clave de
respuesta re-derivada DESPUÉS de mutar aquello de lo que depende (el texto, la
posición). Esta herramienta la caza a lo bruto: monta el editor de cada
plantilla, teclea en TODOS sus campos de texto —lo que hace el docente al
corregir— y vuelve a preguntar **al scorer** (única verdad) si cada ítem sigue
teniendo respuesta correcta. Si "puntuables antes → después" baja, editar rompió
la clave.

```bash
node tools/edit-audit.mjs     # las 13 plantillas — sale 1 si alguna pierde su clave
```

No se teclea en el campo que ES la respuesta (cambiarlo a mano no es perder la
clave, es cambiarla): esos selectores viven en `ANSWER_FIELDS`, dentro del
script. Una plantilla nueva entra sola (recorre el registro).

## 3. Verificación headless (layout, táctil, visual)

Lo que la suite Node no ve (¿el texto llena el marco?, ¿el trazo marca la
vocal?, ¿el panel VS se corta?) se verifica con Playwright + el Chromium
preinstalado. Receta que usamos en cada cambio visual:

```bash
# 1. Harness: un HTML mínimo que monta SOLO la pieza a probar
#    (importa el módulo real por ES modules + su CSS real).
# 2. Servir el repo (¡localhost, no 127.0.0.1 — el proxy lo intercepta!):
python3 -m http.server 8099 &
# 3. Script Playwright:
node - <<'EOF'
import('/opt/node22/lib/node_modules/playwright/index.mjs').then(async ({ chromium }) => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('http://localhost:8099/_harness.html', { waitUntil: 'networkidle' });
  // medir: p.evaluate(() => ...clientHeight/scrollHeight/getComputedStyle...)
  // simular táctil: el.dispatchEvent(new PointerEvent('pointerdown', { pointerId, width, height, isPrimary, ... }))
  await p.screenshot({ path: 'out.png' });
  await b.close();
});
EOF
```

Trucos aprendidos (no re-descubrir):
- **Medir, no mirar**: `scrollHeight > clientHeight` detecta recortes que un
  screenshot pequeño esconde; `getComputedStyle(el).fontSize` verifica el fitter.
- **PointerEvent sintético** acepta `width/height` (tamaño de contacto) → sirve
  para probar el PenDetector y la palma (≥3 `pointerId` activos).
- **Multitáctil**: dos `pointerdown` con `pointerId` distintos en el mismo tick.
- Probar SIEMPRE en 2 tamaños: marco embebido (~720×450) y fullscreen (1280×800),
  y en vertical si el modo lo permite.
- **Salir de fullscreen = el resize más agresivo**: si un player observa su propio
  tamaño con `ResizeObserver` y el callback MUTA layout (redimensionar tarjetas,
  celdas…), usa `observeResize()` (`core/observeResize.js`, rAF-debounced) — un RO
  directo puede disparar el aviso "ResizeObserver loop…" justo ahí. Repro headless:
  cambiar `#ww-player-widget` de tamaño varias veces seguidas (simula
  fullscreen-enter/exit) y contar el evento `error` de window con ese mensaje.
- El harness es **temporal**: bórralo antes de commitear.

## 4. Qué NO está cubierto (y cómo se mitiga)

- **PocketBase real** (concurrencia del blob `state` en live): deuda documentada
  en CLAUDE.md; los tests usan el driver local.
- **Hardware táctil real** (pizarras que pierden `pointerup`): se simula el
  síntoma (punteros fantasma) en headless, pero la confirmación final es manual.
- **Audio/fullscreen**: requieren gesto de usuario; verificación manual.
