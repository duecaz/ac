# Plan · SIMPLIFICAR — un dueño por regla, un módulo por responsabilidad

> **Tipo**: plan · **Sube a**: [`docs/README.md`](README.md) · **Vigila**: `tests/docs.test.mjs` (enlaces y ficha) · las fases, `tools/preflight.mjs`

> Revisión de 2026-09-11, pedida por el dueño tras la pasada de tipos: «lo veo más
> complejo y deberíamos hacer lo contrario».

Cinco lecturas en paralelo de todo el código servido (core en dos mitades ·
plantillas · vistas · kernel+adapters), con el mismo guion: complejidad de
tipado sobrante, complejidad previa, «de qué se encarga cada módulo» en una
línea, y qué partir en los ficheros de más de 400 líneas. Aquí está lo que
coincidió entre lecturas y el orden en que conviene hacerlo. Cada fase es un
commit con preflight; cada hallazgo cita fichero y línea del día de la lectura.

**Lo que NO es complejidad** (las cinco lecturas coincidieron): los comentarios
largos que guardan un bug con fecha, el reparto por bucle de `views/live/*`, la
trinidad `registry`/`templateContract`/`templateCapability`, `podium`/
`resultScreen`/`playerHud` (tres cosas distintas), los relojes por primitivo,
`game/`+`render/` de Pelotas y Tangram (el modelo a imitar), los `index.js` de
4 líneas de cada plantilla. No se tocan.

## Los temas que aparecieron en dos o más lecturas

| Tema | Qué es | Dónde |
|---|---|---|
| **T1 · un dueño para estrechar lo de fuera** | `e instanceof Error ? e.message : String(e)` tecleado **47 veces**; `saco`/`esObjeto`/`fila` 8 copias; `estadoDe` (status de un error PB) 3 formas. `adapters/frontera.js` es dueño solo para adaptadores: `core/` no puede importarlo (capas) y lo re-teclea | `core/aiContent.js:75` · `core/imageSearch.js:50` · `core/aiContentModal.js:23` · `core/io.js:24` · `core/storage.js:50,59` · `core/submitQueue.js:65` · `core/attemptQueue.js:81` · `templates/tildes|comas/template.js:22` · 5 copias en `views/admin/*` |
| **T2 · el DOM tiene dueño (`core/html.js`) y no se usa** | resolver `string\|Element` escrito **20 veces** (ya mordió dos veces: `memoryView` leía `isConnected` de un string); ~70 casts `/** @type {HTMLInputElement\|null} */ (getElementById…)`; `campo()`/`valorDe()`/`marcado()` en 6 sitios | `core/html.js:55` (`mount`) · `core/events.js:28,64` · `core/soloPlayer.js:171` · `core/fullscreen.js:242` · 13 players · `views/memoryView.js:42` · `listView.js:38` · `editList.js:44` · `editorPanels.js:38` · `editorModes.js:38` · `textCorrectionEditor.js:36` |
| **T3 · el editor tiene primitivas y cada plantilla las re-escribe** | `wireCampoTexto` lo usan 2 editores de 8; `wireItemList` copiado en `textCorrectionEditor.js:132` y `quiz/editor.js:86`; «la lista del contenido» definida 7 veces (4 sin `?? []`); **«cuál es la correcta» escrita 3 veces y 2 con `===` crudo** → el editor de Quiz DESMARCA una respuesta que el juego da por buena si difiere en tilde o mayúscula | `core/contentModels/qa.js:93` (dueño) vs `quiz/editor.js:155` y `quiz/template.js:~185` |
| **T4 · los dos shells de `soloPlayer.js` no comparten lo que deberían** | cierre (`finish`) y reanudación escritos dos veces con orden distinto; el shell libre **no emite `PODIUM`**: 6 juegos lo copian a mano y **otros 6 (memory, match, diagram, ballsort, wheel, question-live) se quedan sin sonido, confeti ni meta de la rana** | `core/soloPlayer.js:218-279, 342-356, 447-475` |
| **T5 · copias literales que ya divergieron** | la ruleta gira en dos sitios y la segunda **se dejó el guard §23** (`question-live/player.js:197` vs `wheel/player.js:99`); dos tableros de Sopa (solo normaliza, ronda no); dos máquinas de arrastre de cuerdas (match/diagram); **dos colas de entrega gemelas con la regla del 403 escrita dos veces** (`submitQueue`/`attemptQueue`); `LiveRoom` construido a mano dos veces (`realtimeRooms.js:273-322`, ya divergió con `started_at`); `dispatch`/filtro de apodo/`leaderboard` copiados entre máquinas; «quién gana un duelo» en 3 vistas; antesala de Equipos en `teamsView` y `memoryView`; boot copiado en `main.teacher`/`main.student`; `defaultKV` ×3, `genCode` ×2, upsert PATCH→404→POST ×2, «sort y si falla sin sort» ×2, `colecciónExiste` ×2, `aplicarParche` de sala ×2 | ver por fase |
| **T6 · módulos que hacen varias cosas** | los que ninguna lectura pudo describir en una línea (abajo, Fase 6) | |
| **T7 · basura y andamio** | **byte NUL literal en `core/answerRows.js`** (ripgrep lo trata como binario: ninguna búsqueda de texto ve el módulo); 16 imports muertos en plantillas; `scoreMarks` sin consumidor en producción; `soltarFs` vacío; comentarios que citan Supabase o funciones que ya no existen; `cargarBanco` dinámico «porque otro agente lo escribe» (ya existe); 7 typedefs sin lector, 4 de ellos re-escritos en línea por su productor; `startScreen.js` = 10 líneas con un caller; `currentStorageUser` solo para un test | |
| **T8 · arranque** | `main.teacher.js:25` importa `#/admin` **estáticamente**: cada carga del profe (también la pizarra lenta) arrastra ≈2 500 líneas de diagnóstico | |
| **T9 · decisiones del dueño** | las ramas «sin `live_answers`» de `realtimeAnswers.js` (~70 líneas, un tercer driver escondido: medir la Pi antes); una sola ruleta jugable (Abre Cajas en modo ruleta usa una copia); cuatro maneras de poner imagen a un ítem (`imagePicker`, `imageTile`, match propio, diagram propio); `qaAdapt.js` conoce Quiz y Operaciones (excepción a §0 que hay que ESCRIBIR, no arreglar) | |

## Las fases, en orden

**Fase 1 · cero riesgo (T7).** ✅ HECHA (v1.51.684). NUL → ` `; 16 imports muertos (+ el barrido en
`auditoria`); `soltarFs`; comentarios caducos; `cargarBanco` estático; typedefs
sin lector (o usados por su productor); `startScreen` dentro de `playerView`.

**Fase 2 · un dueño para estrechar y para el DOM (T1 + T2).** ✅ HECHA (v1.51.685). Un `frontera` NUEVO en
`core/` (`esObjeto`·`saco`·`texto`·`numero`·`estadoDe`·`mensajeDe`) del que
`adapters/frontera.js` re-exporta quedándose solo con el blob de sala;
`core/html.js` gana `raizDe(rootSel)`, `$input/$val/$checked`, `valorDe/marcado`.
Reemplazo mecánico en ~60 ficheros; el verificador de tipos y la suite lo vigilan.

**Fase 3 · shells y podio (T4).** ✅ HECHA (v1.51.686). `cerrarPartida` + `crearProgreso` compartidos
por los dos shells; `PODIUM` en `runFreeformPlayer.finish()` y fuera las 6 copias
(las 6 a la vez, o suena dos veces). Es el que más producto arregla por menos
líneas.

**Fase 4 · editores y modelos (T3).** ✅ HECHA (v1.51.686). `answerIndices()` única (con la contra-prueba
de la tilde); accesores por modelo en `core/contentModels/*`; `wireCampoTexto` en
los 6 que faltan; `wireItemList` en los 2; `renderPairsEditor` fuera de
`contentModels/pairs.js` (el kernel deja de arrastrar el editor); `ensureContent`
fuera de los editores de los tres juegos.

**Fase 5 · copias con divergencia (T5).** ✅ HECHA (v1.51.687). Por orden de riesgo: `girar()` en
`core/ruleta/spin.js` (arregla el guard); `apodoLimpio`, `aplicarPlan`,
`leaderboard` en el kernel; `salaDesde` en `realtimeRooms`; `kv.js` local;
`genCode`/`uid` en `assignmentRules`; upsert y `pbListar` en PB; `ganador(st)` en
`vsMachine`; antesala de Equipos en `core/teams.js`; `bootApp` en `core/boot.js`;
colas de entrega en una factoría sobre `offlineQueue` (medio: camino del alumno);
tablero de Sopa y arrastre de cuerdas (medio: gesto táctil, lo cubre la matriz).

**Fase 6 · responsabilidades (T6), un módulo por commit.**
- `core/textCorrectionRound.js` (892) → passage · round · review · solo.
- `core/editorShell.js` (436) → chasis + `editorPresentacion.js` + `editorIA.js`.
- `views/playerView.js` (568, 8 cosas) → orquestador + `player/apariencia.js` + `player/otraPlantilla.js` + `player/cabecera.js`.
- `views/admin/collections.js` (517) → `core/pbSchema.js` (los DEFS como dato: el test deja de rasparlos con `indexOf`) + un `pbProvision` nuevo en `core/` + vista.
- `adapters/pocketbase/realtime.js` → la máquina SSE (184 líneas) a `realtimeStream.js`.
- `realtimeRooms.setSessionState` (105 líneas, cinco cosas) → `aplicarParche` (en kernel, compartido con el local) + `registrarPuntoDocente` + `subirClaveSiCarrera`.
- `core/templateContract.js` → seis revisores puros; `core/normsCheck.js` → dueños (dato) + escáner.
- `kernel/contracts/session.js` (466) → `session.js` + `persistencia.js`; `createLiveRoom` tipado con `LiveOpts`/`LiveEngine` (borra `paraHidratar` y 5 casts).
- `core/skins.js` → los 7 skins a `themes/builtin/`; `core/fullscreen.js` → `fullscreenRepair.js`; `state.js` → `identity.js`; `views/switchTemplate.js` → `core/`.
- `crossword/player.js` (523) → view · cursor · check (130 líneas de lógica pasan a ser comprobables desde Node); `quiz/template.js` → hostView + migrate; `vsView.startMatch` (286) → `vs/arena.js`.

**Fase 7 · arranque (T8).** ✅ HECHA (v1.51.686). `#/admin` por `import()` dinámico; `views/admin/diagnostico/`.

**Fase 8 · lo que decide el dueño (T9).** Medir en la Pi si queda algún despliegue
sin `live_answers`; una ruleta; un picker de imagen; escribir la excepción de `qaAdapt`.

## Cifras de la lectura

Ahorro estimado por las cinco lecturas: ~600 líneas en plantillas, ~300 en core,
~250 en vistas, ~200 en kernel+adapters, sin tocar producto, CSS ni el modo de
tipado. Más importante que las líneas: 9 módulos que hoy no caben en una línea
pasan a caber, y 5 defectos reales salen a la luz (podio ausente en 6 juegos,
guard §23 de la segunda ruleta, la correcta de Quiz con tildes, el 403 escrito
dos veces, el NUL que esconde un módulo a las búsquedas).
